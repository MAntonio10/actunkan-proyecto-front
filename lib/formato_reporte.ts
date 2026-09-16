import type {
  ColumnaReporte,
  DefinicionReporte,
  ValorCeldaReporte,
  ValoresFiltrosReporte,
} from '@/tipos'

/**
 * Formato de las celdas de un reporte y armado de la query string.
 *
 * Vive aparte de los componentes porque lo comparten la tabla, las gráficas y
 * las descargas, y porque son funciones puras: es lo único de este módulo que
 * se puede razonar sin montar nada.
 *
 * Ver `REPORTES_FRONTEND.md` §5 y §7.
 */

const NUMERICOS = new Set<ColumnaReporte['formato']>([
  'entero',
  'decimal',
  'moneda',
  'porcentaje',
])

export function esColumnaNumerica(columna: ColumnaReporte): boolean {
  return NUMERICOS.has(columna.formato)
}

export function esColumnaTemporal(columna: ColumnaReporte): boolean {
  return columna.formato === 'fecha' || columna.formato === 'fechaHora'
}

/** Clase de alineación. Por omisión: números a la derecha, el resto a la izquierda. */
export function claseAlineacion(columna: ColumnaReporte): string {
  if (columna.alineacion) {
    return {
      izquierda: 'text-left',
      centro: 'text-center',
      derecha: 'text-right',
    }[columna.alineacion]
  }
  return esColumnaNumerica(columna) ? 'text-right' : 'text-left'
}

function conSeparadores(valor: ValorCeldaReporte, decimales: number): string {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return String(valor)
  return numero.toLocaleString('es-GT', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/**
 * Pinta una celda según el formato que declara su columna.
 *
 * Tres cosas que el backend deja explícitas y hay que respetar:
 *  - El dinero llega como cadena decimal (`"215.0000"`). Se formatea para
 *    mostrar, pero **no se acumula con `Number`**: los totales ya vienen
 *    calculados en `seccion.totales`, con Decimal y sin error de coma flotante.
 *  - El porcentaje llega como fracción: `0.682540` se lee `68.3%`.
 *  - `null` es "sin dato", y se pinta `—`. En blanco se confunde con un cero.
 */
export function formatearCelda(
  valor: ValorCeldaReporte | undefined,
  columna: ColumnaReporte,
): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'

  switch (columna.formato) {
    case 'moneda':
      return `Q${conSeparadores(valor, columna.decimales ?? 2)}`
    case 'decimal':
      return conSeparadores(valor, columna.decimales ?? 2)
    case 'entero':
      return conSeparadores(valor, 0)
    case 'porcentaje':
      return `${conSeparadores(Number(valor) * 100, columna.decimales ?? 1)}%`
    case 'fecha':
      return String(valor).slice(0, 10)
    case 'fechaHora':
      return String(valor).slice(0, 16).replace('T', ' ')
    default:
      return String(valor)
  }
}

/**
 * Valor numérico de una celda, en la misma escala en que se muestra.
 *
 * Para las gráficas: el porcentaje se lleva a 0-100 igual que en la tabla, o el
 * eje diría `0.68` donde la celda dice `68.3%`. Devuelve `null` si la celda no
 * es un número, para poder descartar la fila en vez de dibujar un cero falso.
 */
export function valorNumerico(
  valor: ValorCeldaReporte | undefined,
  columna: ColumnaReporte,
): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  return columna.formato === 'porcentaje' ? numero * 100 : numero
}

/**
 * Arma la query string a partir de lo que declara el catálogo.
 *
 * Se recorren los `parametros` y no las `clave`: el rango de fechas es un solo
 * control con dos parámetros (`periodo` → `desde`, `hasta`), y mandar
 * `periodo=` devuelve 400. Recorrer la definición también garantiza que no se
 * cuele un parámetro que ese reporte no declara, que la API rechaza igual.
 */
export function construirQueryReporte(
  definicion: DefinicionReporte,
  valores: ValoresFiltrosReporte,
): string {
  const parametros = new URLSearchParams()
  for (const filtro of definicion.filtros) {
    for (const nombre of filtro.parametros) {
      const valor = valores[nombre]
      if (valor !== undefined && valor !== null && valor !== '') {
        parametros.set(nombre, String(valor))
      }
    }
  }
  return parametros.toString()
}

/** Filtros obligatorios sin valor. Vacío = el formulario se puede enviar. */
export function filtrosIncompletos(
  definicion: DefinicionReporte,
  valores: ValoresFiltrosReporte,
): string[] {
  return definicion.filtros
    .filter(
      (filtro) =>
        filtro.requerido &&
        filtro.parametros.some((nombre) => !valores[nombre]),
    )
    .map((filtro) => filtro.etiqueta)
}

/**
 * Mensaje de error de la API, en texto.
 *
 * NestJS manda `message` como cadena o como arreglo cuando fallan varias
 * validaciones a la vez. Se muestra íntegro a propósito: el 422 trae los
 * candidatos cuando un nombre resulta ambiguo ("'Juan' coincide con Juan Pérez,
 * Juan Ramos"), y recortarlo a un genérico le quita al usuario justo el dato
 * que necesita para corregir.
 */
export function mensajeDeError(error: unknown, respaldo: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const mensaje = (error as { message: unknown }).message
    if (Array.isArray(mensaje)) return mensaje.join(' ')
    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje
  }
  return respaldo
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Tope de la API: un rango de más días responde 400. */
export const MAXIMO_DIAS_RANGO = 366

export interface RangoFechas {
  desde: string
  hasta: string
}

/**
 * `AAAA-MM-DD` de una fecha local.
 *
 * Sin `toISOString`: convierte a UTC y en Guatemala (UTC-6) devuelve el día
 * anterior durante toda la tarde.
 */
export function fechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Primer día del mes en curso y hoy, en `AAAA-MM-DD`. */
export function rangoMesEnCurso(): RangoFechas {
  const hoy = new Date()
  return {
    desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: fechaIso(hoy),
  }
}

/**
 * Un mes calendario (`mes` de 0 a 11, como en `Date`), cortado en hoy si es el
 * mes en curso.
 *
 * Se corta en hoy y no en el último día porque el panel compara contra el
 * período anterior de la misma duración: pedir septiembre entero el día 11
 * compararía once días de ventas contra treinta.
 */
export function rangoDelMes(anio: number, mes: number): RangoFechas {
  const hoy = new Date()
  const ultimoDia = new Date(anio, mes + 1, 0)
  return {
    desde: fechaIso(new Date(anio, mes, 1)),
    hasta: fechaIso(ultimoDia > hoy ? hoy : ultimoDia),
  }
}

/** «Septiembre 2026». `mes` va de 0 a 11, como en `Date`. */
export function nombreDelMes(anio: number, mes: number): string {
  const nombre = MESES[mes]
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`
}

/** Atajos del selector de período, para no escribir dos fechas cada vez. */
export function rangosRapidos(): Array<RangoFechas & { etiqueta: string }> {
  const hoy = new Date()
  const haceDias = (dias: number) =>
    fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias))

  return [
    { etiqueta: 'Hoy', desde: fechaIso(hoy), hasta: fechaIso(hoy) },
    { etiqueta: 'Últimos 7 días', desde: haceDias(6), hasta: fechaIso(hoy) },
    { etiqueta: 'Últimos 30 días', desde: haceDias(29), hasta: fechaIso(hoy) },
    { etiqueta: 'Este mes', ...rangoMesEnCurso() },
    // `Date` normaliza el mes -1 a diciembre del año anterior.
    { etiqueta: 'Mes anterior', ...rangoDelMes(hoy.getFullYear(), hoy.getMonth() - 1) },
    { etiqueta: 'Este año', desde: `${hoy.getFullYear()}-01-01`, hasta: fechaIso(hoy) },
  ]
}

/** Días transcurridos desde la época, sin pasar por la zona horaria local. */
function diasDesdeEpoca(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!partes) return null
  const milisegundos = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  return Number.isNaN(milisegundos) ? null : milisegundos / 86_400_000
}

/** Días del rango, con los dos extremos incluidos. `null` si falta una fecha. */
export function diasDelRango({ desde, hasta }: RangoFechas): number | null {
  const inicio = diasDesdeEpoca(desde)
  const fin = diasDesdeEpoca(hasta)
  if (inicio === null || fin === null) return null
  return fin - inicio + 1
}

/**
 * Qué le impide a la API aceptar el rango, o `null` si está bien.
 *
 * Son las mismas reglas con las que el backend responde 400
 * (`rango-negocio.util.ts`); decirlas junto al control ahorra el viaje de ida
 * y vuelta para enterarse.
 */
export function errorDeRango(rango: RangoFechas): string | null {
  const dias = diasDelRango(rango)
  if (dias === null) return 'Elija la fecha inicial y la final.'
  if (dias < 1) return 'La fecha final es anterior a la inicial.'
  if (dias > MAXIMO_DIAS_RANGO) {
    return `El rango abarca ${dias} días y el máximo es ${MAXIMO_DIAS_RANGO}.`
  }
  return null
}

/**
 * «1 al 11 de septiembre de 2026». Mismo texto que `describirPeriodo` del
 * backend, que es el que sale impreso en el PDF. Solo para rangos válidos.
 */
export function describirRango({ desde, hasta }: RangoFechas): string {
  const [anioDesde, mesDesde, diaDesde] = desde.split('-').map(Number)
  const [anioHasta, mesHasta, diaHasta] = hasta.split('-').map(Number)
  const nombreDesde = MESES[mesDesde - 1]
  const nombreHasta = MESES[mesHasta - 1]

  if (desde === hasta) return `${diaDesde} de ${nombreDesde} de ${anioDesde}`
  if (anioDesde === anioHasta && mesDesde === mesHasta) {
    return `${diaDesde} al ${diaHasta} de ${nombreDesde} de ${anioDesde}`
  }
  if (anioDesde === anioHasta) {
    return `${diaDesde} de ${nombreDesde} al ${diaHasta} de ${nombreHasta} de ${anioDesde}`
  }
  return `${diaDesde} de ${nombreDesde} de ${anioDesde} al ${diaHasta} de ${nombreHasta} de ${anioHasta}`
}

/**
 * Formateador para las gráficas: recibe el número ya en escala de pantalla
 * (el que devuelve `valorNumerico`) y lo pinta como la celda equivalente.
 *
 * No se reutiliza `formatearCelda` porque esa espera el valor crudo del
 * backend, donde el porcentaje viene como fracción: pasarle el 68.3 de una
 * gráfica devolvería «6830 %».
 */
export function formateadorDeColumna(
  columna: ColumnaReporte,
): (valor: number) => string {
  return formateadorDe(columna.formato, columna.decimales)
}

/**
 * Formateador a partir del nombre del formato.
 *
 * Lo comparten la tabla de un reporte y las series del panel: las dos escriben
 * el mismo tipo de cifra y no tendría sentido que un mismo monto se viera
 * distinto según de qué pestaña venga.
 */
export function formateadorDe(
  formato: string,
  decimales?: number,
): (valor: number) => string {
  return (valor: number) => {
    if (!Number.isFinite(valor)) return '—'
    switch (formato) {
      case 'moneda':
        return `Q${conSeparadores(valor, decimales ?? 2)}`
      case 'porcentaje':
        return `${conSeparadores(valor, decimales ?? 1)}%`
      case 'decimal':
        return conSeparadores(valor, decimales ?? 2)
      default:
        return conSeparadores(valor, 0)
    }
  }
}
