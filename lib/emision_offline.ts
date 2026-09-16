import { api } from '@/lib/api'
import { db } from '@/lib/db_tickets'
import { consumirFolios, devolverFolios } from '@/lib/folios_offline'
import { refrescarEstado, sincronizar } from '@/lib/sincronizador_tickets'
import type {
  CatalogosTickets,
  EstadoVentaLocal,
  FolioReservado,
  GuiaCatalogo,
  PayloadEmisionTicket,
  RespuestaEmisionTicket,
  TicketBackend,
  TicketLocalNoSincronizado,
  VentaOffline,
  VentaPendienteLocal,
} from '@/tipos'

/**
 * Emisión de tickets sin conexión.
 *
 * Consume folios pre-firmados del inventario local y devuelve una respuesta con
 * la misma forma que `POST /tickets/emitir`, para que la pantalla de emisión
 * imprima el pase igual que siempre. El QR es válido desde este momento: la
 * firma la generó el servidor al reservar el folio.
 *
 * Lo que no se puede hacer sin conexión:
 *  - Cobrar con tarjeta. Sin pasarela no hay cobro.
 *  - Generar el PDF del pase, que lo arma el backend.
 *  - Anular.
 */

export class ErrorEmisionOffline extends Error {
  codigo: 'SIN_FOLIOS' | 'BLOQUEADO' | 'PAGO_NO_EFECTIVO'
  constructor(codigo: ErrorEmisionOffline['codigo'], mensaje: string) {
    super(mensaje)
    this.name = 'ErrorEmisionOffline'
    this.codigo = codigo
  }
}

/**
 * Ids locales negativos: no chocan con los del backend y hacen evidente en
 * cualquier log que ese ticket todavía no existe del lado del servidor.
 *
 * El contador se persiste. Cuando vivía solo en memoria volvía a -1 en cada
 * recarga, y como `ticketsLocales` está indexada por `id`, el primer ticket
 * emitido después de recargar **sobrescribía** al de la sesión anterior: el
 * historial terminaba mostrando solo la última venta.
 */
const CLAVE_CONTADOR = 'contador_ticket_local'

function siguienteIdLocal(): number {
  const guardado = Number(localStorage.getItem(CLAVE_CONTADOR) ?? '0')
  const siguiente = (Number.isFinite(guardado) ? guardado : 0) - 1
  localStorage.setItem(CLAVE_CONTADOR, String(siguiente))
  return siguiente
}

function comoDecimal(valor: number): string {
  return valor.toFixed(2)
}

function buscarNombre(
  lista: { id: number; nombre: string }[] | undefined,
  id: number | null,
): string | undefined {
  if (id == null) return undefined
  return lista?.find((x) => x.id === id)?.nombre
}

export interface DatosEmisionOffline {
  payload: PayloadEmisionTicket
  catalogos: CatalogosTickets
  /** Total cobrado al visitante, calculado con las tarifas cacheadas. */
  montoVisitantes: number
  /** Ticket aparte del guía sin carnet. 0 si no aplica. */
  montoGuia: number
  /** El guía sin carnet genera su propio ticket y consume un segundo folio. */
  requiereTicketGuia: boolean
  /**
   * Guía acompañante, si lo hay. Se guarda en el ticket porque el historial lo
   * lee de ahí: sin esto, una venta con guía aparecía como "Sin guía" hasta que
   * el backend devolviera el ticket real.
   *
   * En modo "nuevo" el guía todavía no tiene id —lo asigna el backend al
   * subir—, así que va con `id: 0`. Solo se usa para mostrar.
   */
  guia?: GuiaCatalogo
}

function armarTicket(
  folio: FolioReservado,
  tipoTicket: 'VISITANTE' | 'GUIA',
  datos: DatosEmisionOffline,
  fechaEmision: string,
): TicketBackend {
  const { payload, catalogos } = datos
  const esGuia = tipoTicket === 'GUIA'

  return {
    id: siguienteIdLocal(),
    numeroTicket: folio.numeroTicket,
    tipoTicket,
    nombre: esGuia ? (datos.guia?.nombre ?? 'Guía') : payload.nombreGrupo,
    cantidadPersonas: esGuia
      ? 1
      : payload.cantidades.reduce((acc, c) => acc + c.cantidad, 0),
    montoTotal: comoDecimal(esGuia ? datos.montoGuia : datos.montoVisitantes),
    observaciones: payload.notas ?? null,
    qr: folio.qr,
    qrFirma: folio.firma,
    atraccion: catalogos.atracciones.find((a) => a.id === payload.idAtraccion),
    origen: catalogos.origenes.find((o) => o.id === payload.idOrigen),
    pais: payload.idPais
      ? catalogos.paises.find((p) => p.id === payload.idPais)
      : null,
    tipoRecorrido: catalogos.tiposRecorrido.find((t) => t.id === payload.idTipoRecorrido),
    // Poblado en ambos tickets, igual que lo devuelve el backend: el del
    // visitante y el del guía muestran los mismos datos del acompañante.
    guia: datos.guia ?? null,
    fechaCreacion: fechaEmision,
    fechaUso: null,
    anulado: false,
    origenOffline: true,
  }
}

/**
 * Registra la venta localmente y devuelve el pase listo para imprimir.
 *
 * Los folios se consumen antes de escribir la venta; si la escritura falla, se
 * devuelven al inventario. Perderlos dejaría huecos que solo se resuelven
 * conciliando el lote entero.
 */
export async function emitirSinConexion(
  datos: DatosEmisionOffline,
): Promise<RespuestaEmisionTicket> {
  const { payload, catalogos } = datos

  const opcionPago = catalogos.opcionesPago.find((o) => o.id === payload.idOpcionPago)
  if (!opcionPago?.esEfectivo) {
    throw new ErrorEmisionOffline(
      'PAGO_NO_EFECTIVO',
      'Sin conexión solo se puede cobrar en efectivo: la pasarela de tarjeta necesita internet.',
    )
  }

  const lote = await db.lote.get('actual')
  if (!lote) {
    throw new ErrorEmisionOffline(
      'SIN_FOLIOS',
      'No hay folios reservados en este dispositivo. Conéctese a internet para obtenerlos.',
    )
  }

  const cantidadFolios = datos.requiereTicketGuia ? 2 : 1
  const folios = await consumirFolios(cantidadFolios)
  if (!folios) {
    throw new ErrorEmisionOffline(
      'SIN_FOLIOS',
      `No quedan folios suficientes (se necesitan ${cantidadFolios}). Conéctese a internet para reponerlos.`,
    )
  }

  const fechaEmision = new Date().toISOString()
  const idLocal = crypto.randomUUID()
  const montoTotalGeneral = datos.montoVisitantes + datos.montoGuia

  try {
    const tickets: TicketBackend[] = [
      armarTicket(folios[0], 'VISITANTE', datos, fechaEmision),
    ]
    if (datos.requiereTicketGuia && folios[1]) {
      tickets.push(armarTicket(folios[1], 'GUIA', datos, fechaEmision))
    }

    const venta: VentaOffline = {
      ...payload,
      idLocal,
      numeroTicket: folios[0].numeroTicket,
      numeroTicketGuia: datos.requiereTicketGuia ? folios[1]?.numeroTicket : undefined,
      fechaEmision,
      montoCobrado: comoDecimal(montoTotalGeneral),
    }
    // `fechaUsoOffline` no se incluye: no forma parte del contrato publicado
    // (DOCUMENTACION_ENDPOINTS.md 18.3). El ingreso validado sin conexión se
    // sella aparte, con /tickets/validar al reconectar.

    const fila: VentaPendienteLocal = {
      idLocal,
      venta,
      estado: 'pendiente',
      intentos: 0,
      idLote: lote.idLote,
      folios,
      resumen: {
        nombreGrupo: payload.nombreGrupo,
        atraccion: buscarNombre(catalogos.atracciones, payload.idAtraccion) ?? '—',
        totalPersonas: payload.cantidades.reduce((acc, c) => acc + c.cantidad, 0),
        montoTotal: comoDecimal(montoTotalGeneral),
      },
      fechaCreacion: fechaEmision,
    }

    await db.transaction('rw', [db.ventasPendientes, db.ticketsLocales], async () => {
      await db.ventasPendientes.put(fila)
      await db.ticketsLocales.bulkPut(tickets)
    })

    // Se avisa del cambio antes de intentar la subida: el badge de la barra
    // tiene que reflejar la venta recién encolada aunque no haya red.
    await refrescarEstado()
    // Si hubiera red, sube de inmediato; si no, queda encolada.
    void sincronizar()

    return {
      idGrupoEmision: 0,
      montoVisitantes: comoDecimal(datos.montoVisitantes),
      montoGuia: comoDecimal(datos.montoGuia),
      montoTotalGeneral: comoDecimal(montoTotalGeneral),
      tickets,
    }
  } catch (error) {
    await devolverFolios(folios.map((f) => f.numeroTicket))
    throw error
  }
}

/**
 * Tickets que existen solo en este dispositivo: los de ventas que aún no
 * subieron, más los que el servidor rechazó.
 *
 * El criterio es el estado de la cola, no una marca en el ticket. Una venta
 * deja de estar acá en el mismo momento en que el backend la confirma, así que
 * no puede quedar duplicada entre el historial local y el del servidor.
 *
 * Las rechazadas también aparecen, y son las que más importan: ya se cobraron y
 * el servidor no las aceptó, así que alguien tiene que resolverlas a mano.
 */
export async function ticketsPendientesDeSubir(): Promise<TicketLocalNoSincronizado[]> {
  const ventas = await db.ventasPendientes
    .where('estado')
    .anyOf('pendiente', 'retenida', 'enviando', 'rechazada', 'anulada')
    .toArray()

  if (ventas.length === 0) return []

  const porFolio = new Map<string, (typeof ventas)[number]>()
  for (const venta of ventas) {
    porFolio.set(venta.venta.numeroTicket, venta)
    if (venta.venta.numeroTicketGuia) porFolio.set(venta.venta.numeroTicketGuia, venta)
  }

  const tickets = await db.ticketsLocales
    .where('numeroTicket')
    .anyOf([...porFolio.keys()])
    .toArray()

  return tickets
    .map((ticket): TicketLocalNoSincronizado | null => {
      const venta = porFolio.get(ticket.numeroTicket)
      if (!venta) return null
      return {
        ...ticket,
        origenOffline: true,
        anulado: ticket.anulado || venta.estado === 'anulada',
        estadoSincronizacion: venta.estado as TicketLocalNoSincronizado['estadoSincronizacion'],
        motivoRechazo: venta.estado === 'rechazada' ? venta.ultimoError : undefined,
      }
    })
    .filter((t): t is TicketLocalNoSincronizado => t !== null)
    .sort((a, b) => (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? ''))
}

/**
 * Anula en taquilla una venta que todavía no llegó al servidor.
 *
 * La venta **no se sube**. Sin ticket creado del otro lado no hay nada que dar
 * de baja, así que no hace falta el permiso `EmisionTickets / Anular` —que un
 * taquillero normalmente no tiene— ni depender de que la caja de origen siga
 * abierta al sincronizar.
 *
 * El folio ya consumido no vuelve al inventario: el visitante puede haberse
 * quedado con el pase impreso, y revenderlo daría el mismo número a dos
 * personas. Se declara **no utilizado** al conciliar el lote, con lo que el
 * backend lo cierra y `POST /tickets/validar` empieza a responder 404 por él.
 *
 * La fila se conserva como registro local de lo ocurrido; no se borra.
 */
export async function anularVentaLocal(
  idLocal: string,
  datos: { motivo?: string; usuario?: string } = {},
): Promise<void> {
  const venta = await db.ventasPendientes.get(idLocal)
  if (!venta) throw new Error('La venta ya no está en este dispositivo.')

  if (venta.estado === 'anulada') return

  if (venta.estado === 'sincronizada') {
    throw new Error(
      'Esta venta ya se subió al servidor. Anúlela desde el historial, con la caja de origen abierta.',
    )
  }
  if (venta.estado === 'enviando') {
    throw new Error('La venta se está subiendo en este momento. Espere a que termine.')
  }
  // Un pase ya usado significa que alguien entró. Anularlo dejaría el ingreso
  // sin ticket que lo respalde, que es peor que el cobro que se quiere revertir.
  if (venta.fechaUsoLocal) {
    throw new Error(
      'Este pase ya se utilizó para ingresar. No se puede anular una entrada ya consumida.',
    )
  }

  await db.transaction('rw', [db.ventasPendientes, db.ticketsLocales], async () => {
    await db.ventasPendientes.put({
      ...venta,
      estado: 'anulada',
      fechaAnulacion: new Date().toISOString(),
      motivoAnulacion: datos.motivo,
      usuarioAnulacion: datos.usuario,
    })

    const tickets = await db.ticketsLocales
      .where('numeroTicket')
      .anyOf(venta.folios.map((f) => f.numeroTicket))
      .toArray()
    await db.ticketsLocales.bulkPut(tickets.map((t) => ({ ...t, anulado: true })))
  })

  await refrescarEstado()
}

/**
 * Fija de una sola vez qué ventas entran en la próxima subida.
 *
 * Recibe el conjunto de las que sí. Las pendientes que queden fuera pasan a
 * retenidas y las retenidas que entren vuelven a la cola. Se aplica en una
 * transacción para que la selección no quede a medias.
 */
export async function aplicarSeleccionDeSubida(idsASubir: Set<string>): Promise<void> {
  await db.transaction('rw', db.ventasPendientes, async () => {
    const candidatas = await db.ventasPendientes
      .where('estado')
      .anyOf('pendiente', 'retenida')
      .toArray()

    const cambios = candidatas
      .map((v): VentaPendienteLocal | null => {
        const destino: EstadoVentaLocal = idsASubir.has(v.idLocal) ? 'pendiente' : 'retenida'
        return v.estado === destino ? null : { ...v, estado: destino }
      })
      .filter((v): v is VentaPendienteLocal => v !== null)

    if (cambios.length > 0) await db.ventasPendientes.bulkPut(cambios)
  })

  await refrescarEstado()
}

/**
 * Deja el catálogo de guías guardado en el dispositivo.
 *
 * Se llama al abrir la emisión con red, no al desplegar el selector: si se
 * esperara a que el taquillero lo abriera, un turno que empieza sin señal se
 * encontraría la lista vacía y no podría asignar guía a ninguna venta.
 */
export async function precargarGuias(): Promise<void> {
  try {
    // Igual que el selector: el tope de una sola vez, no la primera página.
    // Acá además el error no se vería hasta que se caiga la red, que es cuando
    // el catálogo guardado es lo único que hay.
    const res = await api.guias.listar({ limite: 200 })
    const lista = res?.datos
    if (!Array.isArray(lista)) return
    await db.transaction('rw', db.guias, async () => {
      await db.guias.clear()
      await db.guias.bulkPut(lista)
    })
  } catch {
    // Sin red se conserva lo que ya hubiera guardado.
  }
}

/** Espeja en el almacenamiento local un ticket emitido con conexión, para que
 *  el historial siga estando disponible cuando la red se caiga. */
export async function espejarTicketsEmitidos(tickets: TicketBackend[]): Promise<void> {
  if (tickets.length === 0) return
  try {
    await db.ticketsLocales.bulkPut(tickets)
  } catch {
    // El espejo es una comodidad, no puede hacer fallar una venta ya cobrada.
  }
}
