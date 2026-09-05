import { toast } from 'sonner'

import { api, esErrorDeRed, hayConexion } from '@/lib/api'
import { db } from '@/lib/db_tickets'
import { asegurarFolios } from '@/lib/folios_offline'
import { llaveActual } from '@/lib/sesion_offline'
import type { ResultadoVentaOffline, VentaPendienteLocal } from '@/tipos'

/**
 * Sube la cola de ventas hechas sin conexión.
 *
 * Reglas que definen el comportamiento:
 *
 *  - **Serial.** Una tanda a la vez. El dinero de la caja tiene que cuadrar en
 *    orden y el backend descuenta folios de un lote compartido.
 *  - **Idempotente.** Cada venta lleva su `idLocal`; reintentar una respuesta
 *    perdida devuelve el ticket ya creado en vez de duplicarlo. Es lo que
 *    permite reintentar sin arriesgar cobrar dos veces.
 *  - **Un rechazo del servidor no se reintenta.** Se marca `rechazada` y se le
 *    avisa al taquillero. Un error de red sí se reintenta indefinidamente: la
 *    venta es válida, lo que falta es conexión.
 *
 * Contrato en ESPECIFICACION_OFFLINE.md § 5.
 */

const TAMANO_TANDA = 50
const ESPERA_BASE_MS = 2_000
const ESPERA_MAXIMA_MS = 60_000
const CLAVE_MODO_AUTOMATICO = 'sincronizacion_automatica'

export interface EstadoSincronizacion {
  pendientes: number
  /** Excluidas a mano de la subida. Siguen siendo dinero fuera del sistema. */
  retenidas: number
  rechazadas: number
  /** Anuladas en taquilla. No se suben ni bloquean nada: su folio se cierra al
   *  conciliar. Se cuentan solo para poder mostrarlas. */
  anuladas: number
  sincronizando: boolean
  ultimaSincronizacion: string | null
  ultimoError: string | null
  automatico: boolean
}

let sincronizando = false
let ultimaSincronizacion: string | null = null
let ultimoError: string | null = null
let temporizadorReintento: ReturnType<typeof setTimeout> | null = null

const oyentes = new Set<(estado: EstadoSincronizacion) => void>()

export function modoAutomatico(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(CLAVE_MODO_AUTOMATICO) !== 'false'
}

export function fijarModoAutomatico(activo: boolean): void {
  localStorage.setItem(CLAVE_MODO_AUTOMATICO, activo ? 'true' : 'false')
  void notificar()
  if (activo) void sincronizar()
}

export async function estadoActual(): Promise<EstadoSincronizacion> {
  const pendientes = await db.ventasPendientes
    .where('estado')
    .anyOf('pendiente', 'enviando')
    .count()
  const retenidas = await db.ventasPendientes.where('estado').equals('retenida').count()
  const rechazadas = await db.ventasPendientes.where('estado').equals('rechazada').count()
  const anuladas = await db.ventasPendientes.where('estado').equals('anulada').count()

  return {
    pendientes,
    retenidas,
    rechazadas,
    anuladas,
    sincronizando,
    ultimaSincronizacion,
    ultimoError,
    automatico: modoAutomatico(),
  }
}

async function notificar(): Promise<void> {
  if (oyentes.size === 0) return
  const estado = await estadoActual()
  oyentes.forEach((oyente) => oyente(estado))
}

/**
 * Avisa a los suscriptores de que la cola cambió.
 *
 * Hay que llamarla desde fuera después de tocar `ventasPendientes`: emitir una
 * venta, anularla, retenerla. Sin esto el badge de la barra no se enteraba de
 * las ventas nuevas —solo se actualizaba al sincronizar— y el contador quedaba
 * atrasado hasta que alguien abría el módulo de Sincronización.
 */
export async function refrescarEstado(): Promise<void> {
  await notificar()
}

export function suscribirSincronizacion(
  oyente: (estado: EstadoSincronizacion) => void,
): () => void {
  oyentes.add(oyente)
  void estadoActual().then(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Una venta que quedó `enviando` es de un cierre de la app a media subida. Se
 *  devuelve a la cola: el `idLocal` evita que se duplique si sí había entrado. */
export async function recuperarVentasInterrumpidas(): Promise<void> {
  const colgadas = await db.ventasPendientes.where('estado').equals('enviando').toArray()
  if (colgadas.length === 0) return
  await db.ventasPendientes.bulkPut(
    colgadas.map((v) => ({ ...v, estado: 'pendiente' as const })),
  )
}

async function notificarYDevolver(): Promise<EstadoSincronizacion> {
  await notificar()
  return estadoActual()
}

function esperaDe(intentos: number): number {
  return Math.min(ESPERA_BASE_MS * 2 ** Math.max(0, intentos - 1), ESPERA_MAXIMA_MS)
}

function programarReintento(intentos: number): void {
  if (temporizadorReintento) clearTimeout(temporizadorReintento)
  temporizadorReintento = setTimeout(() => {
    temporizadorReintento = null
    if (modoAutomatico()) void sincronizar()
  }, esperaDe(intentos))
}

async function aplicarResultado(
  venta: VentaPendienteLocal,
  resultado: ResultadoVentaOffline,
): Promise<void> {
  if (resultado.estado === 'RECHAZADO') {
    await db.ventasPendientes.put({
      ...venta,
      estado: 'rechazada',
      codigoRechazo: resultado.codigo,
      ultimoError: resultado.mensaje ?? resultado.codigo ?? 'Rechazada por el servidor',
    })

    // FOLIO_YA_EMITIDO significa que el dispositivo gastó dos veces el mismo
    // folio: hay una venta cobrada que no va a entrar nunca. No puede quedar
    // solo en un badge del historial.
    if (resultado.codigo === 'FOLIO_YA_EMITIDO') {
      toast.error('Folio duplicado en una venta offline', {
        description: `El folio ${venta.venta.numeroTicket} ya se había emitido. Hay Q${venta.resumen.montoTotal} cobrados sin ticket: revíselo antes de cerrar la caja.`,
        duration: Infinity,
      })
    }
    return
  }

  // CREADO o DUPLICADO_IGNORADO: en ambos casos el ticket existe en el backend.
  if (resultado.ticket) {
    await db.ticketsLocales.put(resultado.ticket)
  }
  await db.ventasPendientes.put({
    ...venta,
    estado: 'sincronizada',
    ultimoError: undefined,
    discrepancia: resultado.discrepancia ?? null,
    // El uso NO se da por sellado acá. El contrato publicado de
    // /tickets/emitir-offline no incluye `fechaUsoOffline` entre los campos que
    // procesa, así que un pase validado sin conexión queda sin marcar del lado
    // del servidor. Lo sella `sincronizarUsosPendientes` con /tickets/validar,
    // que es idempotente para este uso: si ya estaba sellado, responde 409.
    fechaSincronizacion: new Date().toISOString(),
  })

  // La venta entró, pero se cobró distinto de la tarifa vigente en su fecha. No
  // es un error que se pueda deshacer —el visitante ya pagó y ya entró— pero el
  // arqueo va a mostrar la diferencia y alguien tiene que saber por qué.
  if (resultado.discrepancia) {
    const { montoCobrado, montoRecalculado, diferencia } = resultado.discrepancia
    toast.warning('Diferencia de tarifa en una venta offline', {
      description: `${venta.venta.numeroTicket}: se cobró Q${montoCobrado} y la tarifa vigente era Q${montoRecalculado} (diferencia Q${diferencia}). Quedará reflejado en el arqueo.`,
      duration: 12_000,
    })
  }
}

/**
 * Sella en el backend los pases que se validaron sin conexión **después** de
 * que su venta ya había subido. En ese caso el sello no puede viajar dentro de
 * la venta, así que se envía por el endpoint normal de validación.
 *
 * Sin esto, un pase usado en la puerta durante un corte breve queda sin marcar
 * en el servidor y puede volver a entrar.
 */
async function sincronizarUsosPendientes(): Promise<void> {
  const porSellar = await db.ventasPendientes
    .where('estado')
    .equals('sincronizada')
    .filter((v) => Boolean(v.fechaUsoLocal) && v.usoSincronizado !== true)
    .toArray()

  for (const fila of porSellar) {
    const folio = fila.folios[0]
    if (!folio) continue
    try {
      await api.tickets.validar({ numeroTicket: folio.numeroTicket, firma: folio.firma })
      await db.ventasPendientes.put({ ...fila, usoSincronizado: true })
    } catch (error) {
      if (esErrorDeRed(error)) return
      // 409 "ya utilizado" es el resultado buscado: el sello ya está puesto.
      await db.ventasPendientes.put({ ...fila, usoSincronizado: true })
    }
  }
}

/**
 * Procesa la cola completa, en tandas. Si ya hay una corrida en curso, no
 * arranca otra: el estado en Dexie es compartido y dos corridas competirían por
 * las mismas filas.
 */
export async function sincronizar(opciones: { forzar?: boolean } = {}): Promise<EstadoSincronizacion> {
  // Las salidas tempranas también notifican: se llega acá justo después de
  // encolar una venta sin red, y si no se avisara, el badge de la barra se
  // quedaría con el conteo anterior.
  if (sincronizando) return notificarYDevolver()
  if (!opciones.forzar && !modoAutomatico()) return notificarYDevolver()
  if (!hayConexion()) return notificarYDevolver()

  sincronizando = true
  ultimoError = null
  await notificar()

  try {
    await recuperarVentasInterrumpidas()

    for (;;) {
      const tanda = await db.ventasPendientes
        .where('estado')
        .equals('pendiente')
        .limit(TAMANO_TANDA)
        .toArray()

      if (tanda.length === 0) break

      const idLote = tanda[0].idLote
      // Una tanda por lote: el endpoint recibe un único `idLote`.
      const delLote = tanda.filter((v) => v.idLote === idLote)

      await db.ventasPendientes.bulkPut(
        delLote.map((v) => ({ ...v, estado: 'enviando' as const, intentos: v.intentos + 1 })),
      )
      await notificar()

      try {
        const respuesta = await api.tickets.emitirOffline({
          idLote,
          // Se envía exactamente lo que documenta el contrato (18.3). No se
          // agrega `fechaUsoOffline` aunque el dato exista: un DTO con
          // validación estricta rechazaría el lote entero por un campo de más,
          // y perder 50 ventas cobradas es mucho peor que sellar el ingreso en
          // una segunda llamada.
          ventas: delLote.map((v) => v.venta),
        })

        const porId = new Map(respuesta.resultados.map((r) => [r.idLocal, r]))
        for (const venta of delLote) {
          const resultado = porId.get(venta.idLocal)
          if (resultado) {
            await aplicarResultado({ ...venta, intentos: venta.intentos + 1 }, resultado)
          } else {
            // El servidor no la mencionó: se devuelve a la cola en vez de darla
            // por buena. Perderla en silencio sería perder dinero cobrado.
            await db.ventasPendientes.put({ ...venta, estado: 'pendiente' })
          }
        }
      } catch (error) {
        // Vuelven a `pendiente` aunque el servidor las hubiera procesado: si ya
        // entraron, el reintento las verá como DUPLICADO_IGNORADO.
        await db.ventasPendientes.bulkPut(
          delLote.map((v) => ({ ...v, estado: 'pendiente' as const })),
        )

        if (esErrorDeRed(error)) {
          ultimoError = 'Sin conexión. Se reintentará automáticamente.'
          programarReintento(delLote[0].intentos + 1)
        } else {
          ultimoError = error instanceof Error ? error.message : 'Error al sincronizar'
        }
        return estadoActual()
      }
    }

    await sincronizarUsosPendientes()

    ultimaSincronizacion = new Date().toISOString()

    // Con la cola vacía y red disponible, es el momento de reponer folios.
    if (llaveActual()) {
      try {
        await asegurarFolios()
      } catch {
        // Que falle la reposición no invalida la subida recién hecha.
      }
    }

    return estadoActual()
  } finally {
    sincronizando = false
    await notificar()
  }
}

/** Descarta una venta rechazada tras revisarla. Requiere decisión humana: la
 *  venta se cobró, así que borrarla sin más deja un descuadre en la caja. */
export async function descartarVentaRechazada(idLocal: string): Promise<void> {
  await db.ventasPendientes.delete(idLocal)
  await notificar()
}

/** Deja las sincronizadas viejas fuera del camino sin tocar la cola viva. */
export async function purgarSincronizadas(diasAtras = 7): Promise<number> {
  const limite = new Date(Date.now() - diasAtras * 86_400_000).toISOString()
  const viejas = await db.ventasPendientes
    .where('estado')
    .equals('sincronizada')
    .filter((v) => v.fechaCreacion < limite)
    .toArray()
  await db.ventasPendientes.bulkDelete(viejas.map((v) => v.idLocal))
  return viejas.length
}

let arrancado = false

/** Engancha la subida automática al evento `online`. Idempotente: la llama el
 *  proveedor de autenticación en cada montaje. */
export function iniciarSincronizacionAutomatica(): () => void {
  if (typeof window === 'undefined') return () => {}

  const alRecuperarConexion = () => {
    if (modoAutomatico()) void sincronizar()
  }

  if (!arrancado) {
    arrancado = true
    void recuperarVentasInterrumpidas().then(() => {
      if (modoAutomatico()) void sincronizar()
    })
  }

  window.addEventListener('online', alRecuperarConexion)
  return () => window.removeEventListener('online', alRecuperarConexion)
}
