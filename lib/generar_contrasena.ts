/**
 * Generador de contraseñas iniciales para usuarios nuevos.
 *
 * Decisiones que no son cosméticas:
 *
 * - **`crypto.getRandomValues`, nunca `Math.random`.** `Math.random` no es
 *   criptográfico: su estado se puede inferir observando salidas, así que sirve
 *   para repartir cartas pero no para una credencial. Es la clase de atajo que
 *   nadie nota porque la contraseña «se ve» aleatoria igual.
 * - **Sin caracteres ambiguos.** Fuera `O`/`0`, `l`/`1`/`I`, y también `5`/`S`.
 *   Esta contraseña no se pega del portapapeles al usarla: el administrador la
 *   crea y se la dicta al taquillero, o la escribe en un papel. Una `l` que se
 *   lee como `1` es un bloqueo de cuenta en el primer turno.
 * - **Al menos uno de cada clase, y luego se revuelve.** Sin revolver, la
 *   contraseña delataría su plantilla (siempre minúscula al inicio, símbolo al
 *   final), que es exactamente la estructura que un ataque aprovecha.
 * - **Muestreo por rechazo, no `% n`.** Tomar el módulo de un byte sobre un
 *   alfabeto que no divide a 256 hace más probables los primeros caracteres.
 *   Con 54 símbolos el sesgo es de casi 19 % para los primeros 40: real, y
 *   gratis de evitar.
 *
 * El backend solo exige 6 caracteres (`MinLength(6)` en `CreateUsuarioDto`).
 * Estas salen de 16 porque el costo de una contraseña larga lo paga el
 * administrador una vez, y el usuario la cambia después.
 */

const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz' // sin l
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRTUVWXYZ' // sin I, O, S
const DIGITOS = '23456789' // sin 0, 1, 5
const SIMBOLOS = '!@#$%*+-=?'

const ALFABETO = MINUSCULAS + MAYUSCULAS + DIGITOS + SIMBOLOS

export const LARGO_CONTRASENA = 16

/** Hay `crypto.getRandomValues`. Sin esto no se genera nada: no se degrada a `Math.random`. */
export function hayAzarSeguro(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
}

/**
 * Un entero en `[0, tope)` sin sesgo.
 *
 * Descarta los bytes que caen en la cola incompleta del rango en vez de
 * aplicarles módulo. El bucle termina: cada intento tiene al menos 50 % de
 * probabilidad de servir para cualquier tope menor o igual a 128.
 */
function enteroHasta(tope: number): number {
  const limite = Math.floor(256 / tope) * tope
  const byte = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(byte)
    if (byte[0] < limite) return byte[0] % tope
  }
}

function unoDe(conjunto: string): string {
  return conjunto[enteroHasta(conjunto.length)]
}

/** Fisher-Yates con azar criptográfico. */
function revolver(caracteres: string[]): string[] {
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = enteroHasta(i + 1)
    ;[caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]]
  }
  return caracteres
}

export function generarContrasena(largo = LARGO_CONTRASENA): string {
  if (!hayAzarSeguro()) {
    throw new Error('Este navegador no expone un generador de azar seguro.')
  }

  // Uno de cada clase primero, para que la contraseña no salga sin dígitos por
  // casualidad; el resto libre del alfabeto completo.
  const caracteres = [
    unoDe(MINUSCULAS),
    unoDe(MAYUSCULAS),
    unoDe(DIGITOS),
    unoDe(SIMBOLOS),
  ]
  while (caracteres.length < largo) caracteres.push(unoDe(ALFABETO))

  return revolver(caracteres).join('')
}
