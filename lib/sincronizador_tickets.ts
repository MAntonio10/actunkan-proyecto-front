import { toast } from 'sonner'

import { api, esErrorDeRed, hayConexion , ApiError } from '@/lib/api'
import { db } from '@/lib/db_tickets'
import { contextoOfflineActual, encolarDescartes } from '@/lib/emision_offline'
import { identidadActual } from '@/lib/dispositivo_taquilla'
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

/** Cuántas veces se intenta sellar un ingreso antes de dejarlo marcado como
 *  fallido. No se da por sellado: se deja de insistir. */
const TOPE_INTENTOS_SELLO = 5

/** Lo mismo para declarar un descarte: se deja de insistir, no se da por
 *  declarado. El folio sigue figurando sin rendir hasta que alguien lo vea. */
const TOPE_INTENTOS_DESCARTE = 5

/** Cuántos días se conserva en el dispositivo lo que ya está en el servidor.
 *  Alcanza para consultar el historial reciente sin red. */
const DIAS_A_CONSERVAR = 7
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
    /*
     * `ERROR_INTERNO` no es un rechazo del dato: es el servidor fallando. Se
     * queda en 'pendiente' para reintentar, y NO pasa a 'rechazada', que es
     * terminal y es el estado en el que /sincronizacion ofrece Descartar —
     * destruir el registro de una venta cobrada por un fallo ajeno.
     *
     * Sigue contando en `recaudacionSinSubir()` y por lo tanto sigue frenando
     * el cierre de caja, que es lo correcto: el dinero está cobrado y fuera del
     * sistema hasta que suba.
     */
    if (resultado.codigo === 'ERROR_INTERNO') {
      await db.ventasPendientes.put({
        ...venta,
        estado: 'pendiente',
        // Sin `codigoRechazo`: ponerlo la pintaría como rechazada en la pantalla
        // de sincronización y volvería a ofrecer el descarte por la puerta de atrás.
        codigoRechazo: undefined,
        ultimoError:
          resultado.mensaje ?? 'El servidor falló al registrarla. Se reintenta más tarde.',
      })
      toast.warning('El servidor no pudo registrar una recaudación', {
        description: `El folio ${venta.venta.numeroTicket} sigue en la cola y se reintenta solo. No lo descarte.`,
        duration: 12000,
      })
      return
    }

    await db.ventasPendientes.put({
      ...venta,
      estado: 'rechazada',
      codigoRechazo: resultado.codigo,
      ultimoError: resultado.mensaje ?? resultado.codigo ?? 'Rechazada por el servidor',
    })

    // Dos rechazos significan dinero cobrado que no va a entrar solo. No pueden
    // quedar en un badge del historial: van con aviso que no se cierra.
    if (resultado.codigo === 'FOLIO_YA_EMITIDO') {
      toast.error('Folio duplicado en una recaudación offline', {
        description: `El folio ${venta.venta.numeroTicket} ya se había emitido. Hay Q${venta.resumen.montoTotal} cobrados sin ticket: revíselo antes de cerrar la caja.`,
        duration: Infinity,
      })
    }

    // La caja de origen se cerró antes de que esta venta llegara. El arqueo ya
    // está congelado sin ella, así que no alcanza con reintentar: hace falta un
    // supervisor que la registre como ajuste posterior al cierre.
    if (resultado.codigo === 'CAJA_YA_CERRADA') {
      toast.error('Recaudación posterior al cierre de caja', {
        description: `El folio ${venta.venta.numeroTicket} por Q${venta.resumen.montoTotal} llegó cuando su caja ya estaba cerrada. Un supervisor debe registrarlo como ajuste posterior: reintentar no lo va a resolver.`,
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
    toast.warning('Diferencia de tarifa en una recaudación offline', {
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
    .filter((v) =>
      Object.values(v.usosLocales ?? {}).some((u) => u.sincronizado !== true),
    )
    .toArray()

  for (const fila of porSellar) {
    // Se recorren los folios usados, no `folios[0]`. Con guía sin carnet hay
    // dos pases y entra cada uno por su cuenta: sellar siempre el primero
    // marcaba como usado al visitante que no entró y dejaba libre el del guía.
    for (const [numeroTicket, uso] of Object.entries(fila.usosLocales ?? {})) {
      if (uso.sincronizado) continue
      if ((uso.intentosSello ?? 0) >= TOPE_INTENTOS_SELLO) continue

      const folio = fila.folios.find((f) => f.numeroTicket === numeroTicket)

      let sellado = false
      let motivo: string | undefined
      try {
        await api.tickets.validar({
          numeroTicket,
          firma: folio?.firma,
          // Redundante desde que el servidor deduce la taquilla del propio
          // folio, pero explícito no cuesta nada y no depende de esa deducción.
          dispositivo: fila.dispositivo,
        })
        sellado = true
      } catch (error) {
        if (esErrorDeRed(error)) return

        /*
         * Solo un rechazo cuenta como sello puesto: que el servidor diga que ese
         * pase YA estaba usado. Cualquier otro error significa que NO se selló.
         *
         * Antes se marcaba sellado ante cualquier fallo, y eso perdía el ingreso
         * en silencio: un 401 por firma —que hasta hace poco pasaba si faltaba
         * identificar la taquilla— se veía igual que el 409 esperado, el pase
         * quedaba sin marcar en el servidor para siempre, y nadie se enteraba.
         * Podía volver a entrar.
         */
        const cuerpo = error instanceof ApiError ? (error.cuerpo as { codigo?: unknown }) : null
        sellado = cuerpo?.codigo === 'TICKET_YA_UTILIZADO'
        if (!sellado) {
          motivo = error instanceof Error ? error.message : 'No se pudo sellar el ingreso'
        }
      }

      const actual = await db.ventasPendientes.get(fila.idLocal)
      if (!actual) break

      const intentos = (uso.intentosSello ?? 0) + 1
      // Se deja de reintentar tras varios fallos para no golpear en cada
      // sincronización, pero NO se da por sellado: queda el motivo escrito, que
      // es la diferencia entre un problema que alguien puede ver y uno que
      // desapareció solo.
      const seguirIntentando = intentos < TOPE_INTENTOS_SELLO

      await db.ventasPendientes.put({
        ...actual,
        usosLocales: {
          ...(actual.usosLocales ?? {}),
          [numeroTicket]: sellado
            ? { fechaUso: uso.fechaUso, sincronizado: true }
            : {
                ...uso,
                intentosSello: intentos,
                errorSello: seguirIntentando
                  ? motivo
                  : `${motivo ?? 'No se pudo sellar'} (se dejó de reintentar tras ${intentos} intentos)`,
              },
        },
      })
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
    // Va primero y fuera del bucle de tandas: tiene que correr aunque no haya
    // ni una venta pendiente, que es justo cuando un descarte sin declarar
    // pasaría inadvertido.
    await declararDescartesPendientes()

    await recuperarVentasInterrumpidas()

    for (;;) {
      const tanda = await db.ventasPendientes
        .where('estado')
        .equals('pendiente')
        .limit(TAMANO_TANDA)
        .toArray()

      if (tanda.length === 0) break

      /*
       * Todas las ventas suben por el mismo camino: el dispositivo que las
       * firmó. Se agrupan por taquilla porque la envoltura lleva una sola.
       */
      const primera = tanda[0]
      const delMismoCamino = tanda.filter((v) => v.dispositivo === primera.dispositivo)

      const contexto = await contextoOfflineActual()
      if (!contexto || !primera.dispositivo) {
        // Sin la caja cacheada no hay a qué apertura asignar el dinero. No se
        // marcan rechazadas: no es culpa de la venta, falta un dato del equipo
        // que vuelve en cuanto se conecte con una caja abierta.
        ultimoError =
          'No se sabe contra qué caja vendió esta taquilla. Conéctese con la caja abierta para poder subir.'
        break
      }

      await db.ventasPendientes.bulkPut(
        delMismoCamino.map((v) => ({
          ...v,
          estado: 'enviando' as const,
          intentos: v.intentos + 1,
        })),
      )
      await notificar()

      try {
        // Se envía exactamente lo que documenta el contrato (18.3). No se
        // agrega `fechaUsoOffline` aunque el dato exista: un DTO con validación
        // estricta rechazaría la tanda entera por un campo de más, y perder 50
        // ventas cobradas es mucho peor que sellar el ingreso en una segunda
        // llamada.
        const ventas = delMismoCamino.map((v) => v.venta)
        const respuesta = await api.tickets.emitirOffline({
          dispositivo: primera.dispositivo,
          idAperturaCaja: contexto.idAperturaCaja,
          ventas,
        })

        const porId = new Map(respuesta.resultados.map((r) => [r.idLocal, r]))
        for (const venta of delMismoCamino) {
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
          delMismoCamino.map((v) => ({ ...v, estado: 'pendiente' as const })),
        )

        if (esErrorDeRed(error)) {
          ultimoError = 'Sin conexión. Se reintentará automáticamente.'
          programarReintento(delMismoCamino[0].intentos + 1)
        } else {
          ultimoError = error instanceof Error ? error.message : 'Error al sincronizar'
        }
        return estadoActual()
      }
    }

    await sincronizarUsosPendientes()

    ultimaSincronizacion = new Date().toISOString()

    // Con la cola al día y red disponible es el momento seguro para recortar.
    await recortarAlmacenamiento()


    return estadoActual()
  } finally {
    sincronizando = false
    await notificar()
  }
}

/**
 * Los dos rechazos que significan "se mandó en el modo equivocado", no "esta
 * venta no vale".
 *
 * Son la única excepción a la regla de que un rechazo del servidor no se
 * reintenta. La regla existe porque reintentar algo que el servidor rechaza a
 * conciencia es un bucle infinito — pero estos dos no discuten la venta, dicen
 * que llegó por el camino que no era. Durante la transición conviven en la misma
 * cola ventas con folio reservado y ventas firmadas por la taquilla, y una mala
 * partición cae acá.
 *
 * Sin esto, al taquillero le quedaba un cobro real en estado terminal y el único
 * botón disponible era Descartar, que borra el registro de ese cobro.
 */
const RECHAZOS_REENVIABLES: ReadonlySet<string> = new Set([
  'FOLIO_DE_OTRA_SERIE',
  'FIRMA_INVALIDA',
])

/*
 * `FOLIO_NO_RESERVADO` NO está en la lista, aunque durante la transición también
 * puede significar "modo equivocado" (una venta firmada por la taquilla enviada
 * en modo lote). Es que hoy, con lotes todavía, significa otra cosa: que el
 * servidor no tiene registro de ese folio, y eso no se arregla reenviando.
 *
 * Ofrecer un botón que no puede funcionar es la misma clase de error que decirle
 * al operador "sincronice el dispositivo" cuando el dispositivo se perdió. Se
 * agrega cuando la emisión por dispositivo esté conectada y la venta lleve
 * consigo con qué modo se emitió, que es lo que permite distinguir los dos
 * significados en vez de adivinar.
 *
 * Los otros dos sí son inequívocos: solo existen en modo dispositivo.
 */

/** ¿Esta venta rechazada se puede volver a encolar, o solo descartar? */
export function esReenviable(venta: VentaPendienteLocal): boolean {
  return (
    venta.estado === 'rechazada' &&
    !!venta.codigoRechazo &&
    RECHAZOS_REENVIABLES.has(venta.codigoRechazo)
  )
}

/**
 * Devuelve una venta rechazada a la cola para que se intente por el camino que
 * corresponde. Solo para los códigos de arriba: el resto sigue siendo terminal.
 */
export async function reenviarVentaRechazada(idLocal: string): Promise<void> {
  const venta = await db.ventasPendientes.get(idLocal)
  if (!venta || !esReenviable(venta)) return

  await db.ventasPendientes.put({
    ...venta,
    estado: 'pendiente',
    codigoRechazo: undefined,
    ultimoError: undefined,
  })
  await notificar()
  void sincronizar()
}

/**
 * Declara al servidor los folios que nunca van a ser ticket.
 *
 * Corre en cada sincronización **aunque la cola de ventas esté vacía**, que es
 * justamente el caso que importa: si no se declara, ese folio figura como sin
 * rendir y se ve igual que un cobro desviado.
 *
 * Una taquilla revocada también declara: al revés que emitir, acá el permiso
 * existe porque lo que ese equipo cobró tiene que poder rendirse igual.
 */
async function declararDescartesPendientes(): Promise<void> {
  const pendientes = await db.descartesPendientes
    .where('declarado')
    .equals(0)
    .filter((d) => d.intentos < TOPE_INTENTOS_DESCARTE)
    .toArray()
  if (pendientes.length === 0) return

  const identidad = await identidadActual()
  const contexto = await contextoOfflineActual()
  if (!identidad?.idDispositivo || !contexto) return

  try {
    const respuesta = await api.tickets.declararDescartes({
      dispositivo: identidad.idDispositivo,
      idAperturaCaja: contexto.idAperturaCaja,
      descartes: pendientes.map(
        ({ numeroTicket, firma, montoCobrado, fechaDescarte, tipo, motivo }) => ({
          numeroTicket,
          firma,
          montoCobrado,
          fechaDescarte,
          tipo,
          motivo,
        }),
      ),
    })

    const porFolio = new Map(respuesta.resultados.map((r) => [r.numeroTicket, r]))
    for (const fila of pendientes) {
      const resultado = porFolio.get(fila.numeroTicket)
      // REGISTRADO y DUPLICADO_IGNORADO son los dos éxitos: el folio quedó
      // rendido. Un RECHAZADO no se reintenta indefinidamente, pero tampoco se
      // da por declarado: queda el motivo a la vista.
      const rendido =
        resultado?.estado === 'REGISTRADO' || resultado?.estado === 'DUPLICADO_IGNORADO'
      await db.descartesPendientes.put({
        ...fila,
        declarado: rendido ? 1 : 0,
        intentos: fila.intentos + 1,
        ultimoError: rendido ? undefined : (resultado?.mensaje ?? resultado?.codigo),
      })
    }
  } catch (error) {
    if (esErrorDeRed(error)) return
    // Un rechazo del endpoint entero (permiso, caja) se cuenta como intento y se
    // deja escrito, sin dar nada por rendido.
    const mensaje = error instanceof Error ? error.message : 'No se pudieron declarar los descartes'
    await db.descartesPendientes.bulkPut(
      pendientes.map((d) => ({ ...d, intentos: d.intentos + 1, ultimoError: mensaje })),
    )
  }
}

/** Descarta una venta rechazada tras revisarla. Requiere decisión humana: la
 *  venta se cobró, así que borrarla sin más deja un descuadre en la caja. */
export async function descartarVentaRechazada(idLocal: string, motivo?: string): Promise<void> {
  const venta = await db.ventasPendientes.get(idLocal)
  // Se encola el descarte ANTES de borrar la fila: después de borrarla ya no
  // quedan ni el folio ni la firma para declararlo, y el folio se contaría como
  // cobro del que nadie respondió.
  if (venta) {
    await encolarDescartes(
      venta,
      motivo ?? 'Rechazada por el servidor y descartada en taquilla',
      'DESCARTADO',
    )
  }

  await db.ventasPendientes.delete(idLocal)
  await notificar()
  void sincronizar()
}

/** Deja las sincronizadas viejas fuera del camino sin tocar la cola viva. */
export async function purgarSincronizadas(diasAtras = DIAS_A_CONSERVAR): Promise<number> {
  const limite = new Date(Date.now() - diasAtras * 86_400_000).toISOString()

  const candidatas = await db.ventasPendientes
    .where('estado')
    .equals('sincronizada')
    .filter((v) => v.fechaCreacion < limite)
    .toArray()

  /*
   * Una venta ya subida puede tener todavia un ingreso sin sellar: alguien entró
   * sin red y el sello no llegó al servidor. Esa fila es lo único que guarda el
   * folio y su firma para poder sellarlo después, así que borrarla perdería el
   * ingreso para siempre — y el pase quedaría libre para volver a entrar.
   *
   * Se conservan también las que fallaron hasta el tope de intentos: ahí hay un
   * problema que alguien tiene que ver, y desaparecerlo es justo lo contrario de
   * lo que hace falta.
   */
  const viejas = candidatas.filter((v) =>
    Object.values(v.usosLocales ?? {}).every((u) => u.sincronizado === true),
  )

  if (viejas.length === 0) return 0

  const folios = viejas.flatMap((v) => v.folios.map((f) => f.numeroTicket))

  await db.transaction('rw', [db.ventasPendientes, db.ticketsLocales], async () => {
    await db.ventasPendientes.bulkDelete(viejas.map((v) => v.idLocal))
    // El espejo del ticket se va con su venta: el historial real vive en el
    // servidor y sin red alcanza con lo reciente.
    if (folios.length > 0) await db.ticketsLocales.where('numeroTicket').anyOf(folios).delete()
  })

  return viejas.length
}

/**
 * Recorta lo que ya no hace falta guardar en el dispositivo.
 *
 * Corre después de una sincronización exitosa, que es el momento seguro: hay
 * red, la cola está al día y lo que se borra ya vive en el servidor.
 *
 * Eso último es una dependencia con el backend, verificada y no supuesta: un
 * ticket sincronizado queda en su tabla para siempre — no hay borrado duro, solo
 * `anulado: true` — y lo mismo los folios, que conservan su estado. Además el
 * historial que ve el taquillero se lee de `GET /tickets`, no de la copia local,
 * así que purgar no le vacía la pantalla; sin red verá los últimos días, que es
 * para lo que sirve la copia. Si alguna vez el backend borrara tickets de
 * verdad, esta purga pasaría a perder datos y hay que repensarla.
 *
 * Sin esto las tablas crecen sin techo. No es urgente por volumen —cada fila
 * pesa poco y la cuota del navegador es holgada— pero es la clase de cosa que
 * nadie nota hasta que una tablet vieja se queda sin espacio en plena jornada,
 * que es cuando ya no hay red para diagnosticar.
 */
async function recortarAlmacenamiento(): Promise<void> {
  try {
    await purgarSincronizadas()

    // Descartes ya declarados: el servidor los tiene, acá no hacen nada.
    const limite = new Date(Date.now() - DIAS_A_CONSERVAR * 86_400_000).toISOString()
    await db.descartesPendientes
      .where('declarado')
      .equals(1)
      .filter((d) => d.fechaDescarte < limite)
      .delete()

    /*
     * Tablas huérfanas del modelo de folios reservados. Ya nadie las lee, pero
     * en una tablet que vendió con ese modelo siguen ocupando lugar. Se vacían
     * una vez y después las consultas cuestan nada.
     */
    if ((await db.folios.count()) > 0) await db.folios.clear()
    if ((await db.lote.count()) > 0) await db.lote.clear()
  } catch {
    // Recortar es higiene, no puede hacer fallar una sincronización que salio
    // bien ni mucho menos una venta.
  }
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
