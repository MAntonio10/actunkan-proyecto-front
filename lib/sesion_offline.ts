import { db } from '@/lib/db_tickets'
import {
  ITERACIONES_PBKDF2,
  cifrar,
  derivarLlave,
  derivarVerificador,
  descifrar,
  exportarLlave,
  generarSalt,
  hayCriptoDisponible,
  importarLlave,
  sonIguales,
} from '@/lib/cripto_offline'
import type { CredencialOffline, ModuloMenu, UsuarioBackend } from '@/tipos'

/**
 * Inicio de sesión sin conexión.
 *
 * En el login online el navegador tiene la contraseña en claro: de ahí se
 * deriva un verificador PBKDF2 que queda guardado, y con él se puede validar la
 * contraseña más tarde sin preguntarle nada al servidor. La contraseña no se
 * almacena en ningún momento.
 *
 * La misma contraseña produce además la llave AES-GCM que cifra el refresh
 * token y los folios pre-firmados. Es la pieza que hace que una tablet robada
 * no sirva: sin la contraseña, los folios no se pueden leer.
 *
 * Límites deliberados, ver ESPECIFICACION_OFFLINE.md § 11:
 *  - Solo usuarios que ya entraron online en este dispositivo.
 *  - Ventana máxima desde el último login online.
 *  - Bloqueo por intentos fallidos.
 *  - Un usuario dado de baja mientras el dispositivo está offline sigue
 *    operando hasta reconectar. No hay forma de saberlo sin red.
 */

const MAX_INTENTOS = 5
const DIAS_VALIDEZ = 7

export type CodigoErrorOffline =
  | 'SIN_CRIPTO'
  | 'SIN_CREDENCIAL'
  | 'BLOQUEADA'
  | 'VENCIDA'
  | 'CONTRASENA_INCORRECTA'

export class ErrorSesionOffline extends Error {
  codigo: CodigoErrorOffline
  intentosRestantes?: number

  constructor(codigo: CodigoErrorOffline, mensaje: string, intentosRestantes?: number) {
    super(mensaje)
    this.name = 'ErrorSesionOffline'
    this.codigo = codigo
    this.intentosRestantes = intentosRestantes
  }
}

/**
 * Llave de la sesión en curso.
 *
 * Se respalda en `sessionStorage`, que sobrevive a recargas pero se borra al
 * cerrar la aplicación. Antes vivía solo en memoria y cada refresco de pantalla
 * obligaba a escribir la contraseña otra vez, lo que en taquilla resultaba
 * insufrible.
 *
 * El modelo de protección se mantiene donde importa: un dispositivo apagado o
 * con la aplicación cerrada no entrega la llave, así que los folios
 * pre-firmados siguen ilegibles sin la contraseña. Mientras la aplicación está
 * abierta ya estaba desbloqueada de todos modos.
 */
const CLAVE_LLAVE_SESION = 'llave_offline'
const CLAVE_CORREO_SESION = 'correo_offline'

let llaveSesion: CryptoKey | null = null

export function llaveActual(): CryptoKey | null {
  return llaveSesion
}

export function hayLlaveActiva(): boolean {
  return llaveSesion !== null
}

async function fijarLlave(correo: string, llave: CryptoKey): Promise<void> {
  llaveSesion = llave
  try {
    sessionStorage.setItem(CLAVE_LLAVE_SESION, await exportarLlave(llave))
    sessionStorage.setItem(CLAVE_CORREO_SESION, correo)
  } catch {
    // Sin respaldo se sigue trabajando en memoria; solo se pierde al recargar.
  }
}

export function olvidarLlave(): void {
  llaveSesion = null
  try {
    sessionStorage.removeItem(CLAVE_LLAVE_SESION)
    sessionStorage.removeItem(CLAVE_CORREO_SESION)
  } catch {
    /* nada que limpiar */
  }
}

/**
 * Recupera la llave tras una recarga y devuelve la sesión cacheada del usuario
 * al que pertenece. Devuelve null si no hay respaldo, si la credencial ya no
 * existe o si venció la ventana de trabajo sin conexión.
 */
export async function restaurarSesionDeMemoria(): Promise<{
  usuario: UsuarioBackend
  modulosPermitidos: ModuloMenu[]
} | null> {
  if (typeof window === 'undefined') return null

  const respaldo = sessionStorage.getItem(CLAVE_LLAVE_SESION)
  const correo = sessionStorage.getItem(CLAVE_CORREO_SESION)
  if (!respaldo || !correo) return null

  const credencial = await db.credenciales.get(correo)
  if (!credencial || credencial.bloqueada || estaVencida(credencial)) {
    olvidarLlave()
    return null
  }

  const llave = await importarLlave(respaldo)
  if (!llave) {
    olvidarLlave()
    return null
  }

  llaveSesion = llave
  return {
    usuario: credencial.usuario,
    modulosPermitidos: credencial.modulosPermitidos,
  }
}

function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase()
}

function estaVencida(credencial: CredencialOffline): boolean {
  const limite = new Date(credencial.fechaUltimoLoginOnline).getTime() + DIAS_VALIDEZ * 86_400_000
  return Date.now() > limite
}

export async function obtenerCredencial(correo: string): Promise<CredencialOffline | undefined> {
  return db.credenciales.get(normalizarCorreo(correo))
}

export async function hayAlgunaCredencial(): Promise<boolean> {
  return (await db.credenciales.count()) > 0
}

/** Correos que pueden entrar sin conexión desde este dispositivo. Alimenta la
 *  pista que muestra la pantalla de login cuando no hay red. */
export async function listarCorreosOffline(): Promise<string[]> {
  const todas = await db.credenciales.toArray()
  return todas.filter((c) => !c.bloqueada && !estaVencida(c)).map((c) => c.correo)
}

/**
 * Se llama tras un login online exitoso. Crea o refresca el verificador y deja
 * la llave lista para cifrar secretos durante esta sesión.
 *
 * Si la contraseña cambió desde el último registro, el verificador se regenera
 * con salts nuevos: los secretos cifrados con la llave anterior quedan
 * ilegibles y se descartan, que es el comportamiento correcto.
 */
export async function registrarCredencialOffline(parametros: {
  correo: string
  contrasena: string
  usuario: UsuarioBackend
  modulosPermitidos?: ModuloMenu[]
  refreshToken?: string | null
}): Promise<void> {
  if (!hayCriptoDisponible()) return

  const correo = normalizarCorreo(parametros.correo)
  const previa = await db.credenciales.get(correo)

  // Salts nuevos solo la primera vez. Conservarlos permite que los secretos ya
  // cifrados sigan siendo legibles si la contraseña no cambió.
  let saltVerificador = previa?.saltVerificador ?? generarSalt()
  let saltLlave = previa?.saltLlave ?? generarSalt()

  let digest = await derivarVerificador(parametros.contrasena, saltVerificador)

  const contrasenaCambio = previa != null && !sonIguales(previa.digest, digest)
  if (contrasenaCambio) {
    saltVerificador = generarSalt()
    saltLlave = generarSalt()
    digest = await derivarVerificador(parametros.contrasena, saltVerificador)
    await db.secretos.clear()
  }

  await fijarLlave(correo, await derivarLlave(parametros.contrasena, saltLlave))

  await db.credenciales.put({
    correo,
    idUsuario: parametros.usuario.id,
    saltVerificador,
    digest,
    iteraciones: ITERACIONES_PBKDF2,
    saltLlave,
    usuario: parametros.usuario,
    modulosPermitidos: parametros.modulosPermitidos ?? previa?.modulosPermitidos ?? [],
    fechaUltimoLoginOnline: new Date().toISOString(),
    intentosFallidos: 0,
    bloqueada: false,
  })

  if (parametros.refreshToken) {
    await guardarSecreto('refresh_token', parametros.refreshToken)
  }
}

/** Los módulos llegan en una segunda llamada, después del login. */
export async function actualizarModulosCache(
  correo: string,
  modulos: ModuloMenu[],
): Promise<void> {
  const clave = normalizarCorreo(correo)
  const credencial = await db.credenciales.get(clave)
  if (!credencial) return
  await db.credenciales.put({ ...credencial, modulosPermitidos: modulos })
}

/**
 * Valida la contraseña contra el verificador local y devuelve la sesión
 * cacheada. No toca la red.
 */
export async function iniciarSesionOffline(
  correo: string,
  contrasena: string,
): Promise<{
  usuario: UsuarioBackend
  modulosPermitidos: ModuloMenu[]
  refreshToken: string | null
}> {
  if (!hayCriptoDisponible()) {
    throw new ErrorSesionOffline(
      'SIN_CRIPTO',
      'El almacenamiento seguro no está disponible. Abra la aplicación por HTTPS.',
    )
  }

  const credencial = await obtenerCredencial(correo)
  if (!credencial) {
    throw new ErrorSesionOffline(
      'SIN_CREDENCIAL',
      'Este usuario no ha iniciado sesión con conexión en este dispositivo.',
    )
  }
  if (credencial.bloqueada) {
    throw new ErrorSesionOffline(
      'BLOQUEADA',
      'Acceso sin conexión bloqueado por intentos fallidos. Debe iniciar sesión con internet.',
    )
  }
  if (estaVencida(credencial)) {
    throw new ErrorSesionOffline(
      'VENCIDA',
      `Han pasado más de ${DIAS_VALIDEZ} días desde el último inicio de sesión con internet.`,
    )
  }

  const digest = await derivarVerificador(
    contrasena,
    credencial.saltVerificador,
    credencial.iteraciones,
  )

  if (!sonIguales(digest, credencial.digest)) {
    const intentosFallidos = credencial.intentosFallidos + 1
    const bloqueada = intentosFallidos >= MAX_INTENTOS
    await db.credenciales.put({ ...credencial, intentosFallidos, bloqueada })

    // Al bloquear se borran los secretos: es el escenario de alguien probando
    // contraseñas sobre un dispositivo ajeno, y los folios pre-firmados son
    // justamente lo que no debe quedar a su alcance.
    if (bloqueada) {
      await db.secretos.clear()
      throw new ErrorSesionOffline(
        'BLOQUEADA',
        'Acceso sin conexión bloqueado por intentos fallidos. Debe iniciar sesión con internet.',
      )
    }

    throw new ErrorSesionOffline(
      'CONTRASENA_INCORRECTA',
      'Contraseña incorrecta.',
      MAX_INTENTOS - intentosFallidos,
    )
  }

  await fijarLlave(
    credencial.correo,
    await derivarLlave(contrasena, credencial.saltLlave, credencial.iteraciones),
  )

  if (credencial.intentosFallidos > 0) {
    await db.credenciales.put({ ...credencial, intentosFallidos: 0 })
  }

  return {
    usuario: credencial.usuario,
    modulosPermitidos: credencial.modulosPermitidos,
    refreshToken: await leerSecreto('refresh_token'),
  }
}

/** Tras reconectar: el backend es la autoridad sobre si el usuario sigue
 *  vigente. Si dejó de estarlo, la credencial local no debe sobrevivir. */
export async function revocarCredencial(correo: string): Promise<void> {
  await db.credenciales.delete(normalizarCorreo(correo))
  await db.secretos.clear()
  olvidarLlave()
}

// ---- Secretos cifrados ----

export async function guardarSecreto(clave: string, texto: string): Promise<void> {
  if (!llaveSesion) return
  const { iv, datos } = await cifrar(llaveSesion, texto)
  await db.secretos.put({ clave, iv, datos })
}

export async function leerSecreto(clave: string): Promise<string | null> {
  if (!llaveSesion) return null
  const fila = await db.secretos.get(clave)
  if (!fila) return null
  return descifrar(llaveSesion, fila.iv, fila.datos)
}

export async function borrarSecreto(clave: string): Promise<void> {
  await db.secretos.delete(clave)
}

export const LIMITES_OFFLINE = { MAX_INTENTOS, DIAS_VALIDEZ }
