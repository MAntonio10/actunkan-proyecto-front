/**
 * Criptografía del modo offline, sobre WebCrypto. Sin dependencias externas.
 *
 * Dos usos, derivados de la misma contraseña pero con salts distintos:
 *
 *  1. Verificador — digest PBKDF2 que se guarda y se compara al iniciar sesión
 *     sin conexión. La contraseña nunca se almacena.
 *  2. Llave AES-GCM — cifra el refresh token y los folios pre-firmados en el
 *     almacenamiento local. Un dispositivo robado sin la contraseña no entrega
 *     folios utilizables ni una sesión reutilizable.
 *
 * Los salts son distintos a propósito: si se compartieran, el digest guardado
 * en claro sería la llave de descifrado.
 *
 * REQUIERE CONTEXTO SEGURO. `crypto.subtle` no existe sobre http:// salvo en
 * localhost. La tablet del parque debe servirse por https o el modo offline no
 * arranca (lo mismo aplica al Service Worker).
 */

const ITERACIONES = 600_000
const LONGITUD_SALT = 16
const LONGITUD_IV = 12

export class CriptoNoDisponibleError extends Error {
  constructor() {
    super(
      'El almacenamiento seguro no está disponible. La aplicación debe abrirse por HTTPS para poder operar sin conexión.',
    )
    this.name = 'CriptoNoDisponibleError'
  }
}

export function hayCriptoDisponible(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined'
  )
}

function exigirCripto(): void {
  if (!hayCriptoDisponible()) throw new CriptoNoDisponibleError()
}

// ---- Utilidades de codificación ----

export function aBase64(datos: ArrayBuffer | Uint8Array): string {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos)
  let binario = ''
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i])
  return btoa(binario)
}

export function desdeBase64(texto: string): Uint8Array {
  const binario = atob(texto)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export function generarSalt(): string {
  exigirCripto()
  return aBase64(crypto.getRandomValues(new Uint8Array(LONGITUD_SALT)))
}

// ---- Derivación ----

async function importarContrasena(contrasena: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )
}

/** Digest que se guarda para verificar la contraseña sin conexión. */
export async function derivarVerificador(
  contrasena: string,
  saltBase64: string,
  iteraciones: number = ITERACIONES,
): Promise<string> {
  exigirCripto()
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: desdeBase64(saltBase64) as BufferSource,
      iterations: iteraciones,
      hash: 'SHA-256',
    },
    await importarContrasena(contrasena),
    256,
  )
  return aBase64(bits)
}

/**
 * Llave AES-GCM para cifrar secretos locales.
 *
 * Se crea exportable para poder guardarla en `sessionStorage` y sobrevivir a
 * una recarga; sin eso había que volver a escribir la contraseña cada vez que
 * la pantalla se refrescaba. No debilita el modelo: `sessionStorage` se borra
 * al cerrar la aplicación, y mientras está abierta la llave ya estaba al
 * alcance del código de la página.
 */
export async function derivarLlave(
  contrasena: string,
  saltBase64: string,
  iteraciones: number = ITERACIONES,
): Promise<CryptoKey> {
  exigirCripto()
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: desdeBase64(saltBase64) as BufferSource,
      iterations: iteraciones,
      hash: 'SHA-256',
    },
    await importarContrasena(contrasena),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportarLlave(llave: CryptoKey): Promise<string> {
  exigirCripto()
  return aBase64(await crypto.subtle.exportKey('raw', llave))
}

export async function importarLlave(base64: string): Promise<CryptoKey | null> {
  if (!hayCriptoDisponible()) return null
  try {
    return await crypto.subtle.importKey(
      'raw',
      desdeBase64(base64) as BufferSource,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
  } catch {
    return null
  }
}

/**
 * Comparación en tiempo constante. Con `===` el tiempo de respuesta depende de
 * cuántos caracteres coinciden, lo que filtra información sobre el digest a
 * quien pueda medirlo.
 */
export function sonIguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

// ---- Cifrado de secretos ----

export async function cifrar(llave: CryptoKey, texto: string): Promise<{ iv: string; datos: string }> {
  exigirCripto()
  const iv = crypto.getRandomValues(new Uint8Array(LONGITUD_IV))
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    llave,
    new TextEncoder().encode(texto),
  )
  return { iv: aBase64(iv), datos: aBase64(cifrado) }
}

/** Devuelve null si la llave no corresponde: AES-GCM detecta la manipulación y
 *  lanza, en vez de entregar basura. */
export async function descifrar(
  llave: CryptoKey,
  iv: string,
  datos: string,
): Promise<string | null> {
  exigirCripto()
  try {
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: desdeBase64(iv) as BufferSource },
      llave,
      desdeBase64(datos) as BufferSource,
    )
    return new TextDecoder().decode(plano)
  } catch {
    return null
  }
}

export const ITERACIONES_PBKDF2 = ITERACIONES
