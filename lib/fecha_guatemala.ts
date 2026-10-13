/**
 * Fechas del sistema. **Hay dos convenciones y se tratan al revés.**
 *
 * Esta es la trampa más cara del proyecto, así que conviene leerla entera antes
 * de tocar cualquier fecha.
 *
 * ## 1. Fechas que vienen de la API — hora de pared, con una `Z` que miente
 *
 * El backend escribe cada fecha pasándola por `getFechaUTC6()`, que le **resta
 * seis horas al instante** antes de guardarlo (`src/common/utils/date.util.ts`).
 * El valor que queda en la columna `DateTime2` ya es el reloj de pared de
 * Guatemala, solo que sin declararlo. Al leerlo, el driver lo devuelve tal cual
 * y lo serializa con una `Z` al final:
 *
 *     en la taquilla son las 01:41 del 30-sep
 *     la API responde 2026-09-30T01:41:33.574Z   <- la Z es mentira
 *
 * Por eso una fecha de la API **no se convierte de zona: se lee en UTC**. Los
 * componentes UTC de ese `Date` son exactamente la hora de pared. Aplicarle
 * `America/Guatemala` le resta las seis horas por segunda vez y la corre al día
 * anterior entre la medianoche y las 06:00.
 *
 * Es el mismo razonamiento por el que el SQL del backend agrupa por día con un
 * `CONVERT(char(10), ...)` pelado, sin ningún `DATEADD` (`ventas.consulta.ts`).
 *
 * ## 2. Fechas que nacen en el navegador — instantes de verdad
 *
 * Un `new Date()` del navegador, y todo lo que guarda Dexie con él —ventas sin
 * conexión, usos de pase, sincronizaciones— sí es un instante real. Ahí `Z`
 * significa `Z`. Esas **sí** se convierten a `America/Guatemala`, porque el
 * navegador puede estar en cualquier zona.
 *
 * Que la cola de sincronización mande estos instantes tal cual es correcto: el
 * backend les aplica `getFechaUTC6()` al recibirlos (`offline.service.ts:816`),
 * o sea que la conversión a hora de pared la hace él.
 *
 * ## La regla, en una línea
 *
 * **Fecha de la API → `formatearFechaApi()`. Fecha del navegador o de Dexie →
 * `formatearInstante()`.** Si alguna vez el backend guardara instantes reales,
 * las dos familias se funden en la segunda y esta primera desaparece.
 */

export const ZONA_PARQUE = 'America/Guatemala'

/** La zona en la que hay que *leer* una fecha de la API: ninguna. */
const ZONA_HORA_DE_PARED = 'UTC'

type OpcionesFecha = Omit<Intl.DateTimeFormatOptions, 'timeZone'>

const FORMATO_CORTO: OpcionesFecha = { dateStyle: 'medium', timeStyle: 'short' }

// ---------------------------------------------------------------------------
// 1. Fechas que vienen de la API
// ---------------------------------------------------------------------------

/**
 * Formatea una fecha de la API para mostrarla.
 *
 * Se lee en UTC a propósito: los componentes UTC del valor **son** la hora de
 * pared de Guatemala. Ver la explicación de arriba.
 */
export function formatearFechaApi(
  valor: string | null | undefined,
  opciones: OpcionesFecha = FORMATO_CORTO,
  locale = 'es-GT',
): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { ...opciones, timeZone: ZONA_HORA_DE_PARED }).format(
    fecha,
  )
}

/** El día `AAAA-MM-DD` de una fecha de la API, sin conversión de zona. */
export function diaDeFechaApi(valor: string | null | undefined): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return fecha.toISOString().split('T')[0]
}

/**
 * Una fecha de la API lista para exceljs.
 *
 * exceljs arma el serial de Excel con los componentes **UTC** del `Date`, que es
 * justo donde ya está la hora de pared: no hay nada que convertir. Antes acá se
 * hacía una conversión a `America/Guatemala` que restaba seis horas de más.
 */
export function fechaApiParaExcel(valor: string): Date | string {
  const fecha = new Date(valor)
  return isNaN(fecha.getTime()) ? valor : fecha
}

// ---------------------------------------------------------------------------
// 2. Fechas que nacen en el navegador
// ---------------------------------------------------------------------------

/** Los componentes de un instante real, leídos en la zona del parque. */
function partesEnZona(fecha: Date): Record<string, number> {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_PARQUE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha)

  const salida: Record<string, number> = {}
  for (const parte of partes) {
    if (parte.type !== 'literal') salida[parte.type] = Number(parte.value)
  }
  // `hour12: false` puede devolver 24 por la medianoche en algunos motores.
  if (salida.hour === 24) salida.hour = 0
  return salida
}

/**
 * El año en curso en Guatemala. Es el que numera los folios.
 *
 * `getFullYear()` daría el año del aparato: el 31 de diciembre a las 20:00 en
 * Guatemala, una tablet con zona de Tokio ya cree que es enero y numeraría con
 * el año siguiente. El servidor solo acepta el año en curso o el anterior, así
 * que ese folio se rechaza con el pase ya impreso y cobrado. El servidor calcula
 * el suyo con `anioDeNegocio()`, que es esto mismo.
 */
export function anioEnGuatemala(fecha: Date = new Date()): number {
  return partesEnZona(fecha).year
}

/** El día `AAAA-MM-DD` de un instante real, en la zona del parque. */
export function fechaIsoEnGuatemala(fecha: Date = new Date()): string {
  const p = partesEnZona(fecha)
  return [
    String(p.year),
    String(p.month).padStart(2, '0'),
    String(p.day).padStart(2, '0'),
  ].join('-')
}

/** Formatea un instante real (navegador o Dexie) en la zona del parque. */
export function formatearInstante(
  valor: Date | string | null | undefined,
  opciones: OpcionesFecha = FORMATO_CORTO,
  locale = 'es-GT',
): string {
  if (!valor) return '—'
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { ...opciones, timeZone: ZONA_PARQUE }).format(fecha)
}

/** Milisegundos que separan un instante de su lectura como hora de pared. */
function desfaseDelParque(fecha: Date): number {
  const p = partesEnZona(fecha)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - fecha.getTime()
}

/**
 * Un instante real como valor de `<input type="datetime-local">`, en hora del
 * parque.
 *
 * Es el par de `inputDelParqueAInstante`. Las dos existen porque un puñado de
 * campos —`fechaInicio` y `fechaFin` de actividades— **sí** se guardan como
 * instante real: los escribe el usuario y el backend los deja pasar sin
 * `getFechaUTC6()`, justamente para poder compararlos contra la hora real. Son
 * la excepción a todo lo de arriba, y están documentados así en
 * `actividades.service.ts`.
 */
export function instanteParaInput(valor: string | Date | null | undefined): string {
  if (!valor) return ''
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (isNaN(fecha.getTime())) return ''
  return new Date(fecha.getTime() + desfaseDelParque(fecha)).toISOString().slice(0, 16)
}

/**
 * Lo escrito en un `<input type="datetime-local">`, entendido como hora del
 * parque, de vuelta a un instante real.
 *
 * No sirve `new Date(valor)` a secas: eso lo interpreta en la zona del
 * navegador, así que una tablet mal configurada guardaría la actividad a una
 * hora distinta de la que el usuario tiene escrita en pantalla.
 */
export function inputDelParqueAInstante(valor: string): string {
  const [dia = '', hora = '00:00'] = valor.split('T')
  const [anio, mes, diaDelMes] = dia.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  const comoPared = Date.UTC(anio, mes - 1, diaDelMes, horas || 0, minutos || 0)
  // En Guatemala no hay horario de verano, así que evaluarlo en el instante
  // aproximado da el mismo resultado que iterar.
  return new Date(comoPared - desfaseDelParque(new Date(comoPared))).toISOString()
}
