import { db } from '@/lib/db_tickets'
import type { TicketBackend } from '@/tipos'
import { formatearInstante } from '@/lib/fecha_guatemala'

/**
 * Validación de pases en la puerta cuando no hay conexión.
 *
 * Sin esto queda un hueco: el visitante recibe un QR válido en el momento de la
 * venta, camina a la entrada de la cueva y el folio todavía figura como
 * RESERVADO en el servidor, que responde 404. Pase legítimo, visitante que
 * pagó, entrada negada.
 *
 * La comprobación local es más fuerte que verificar la firma: no se pregunta si
 * el folio salió del sistema, se comprueba que **este dispositivo lo vendió**.
 * Un folio robado del bloque de reservados no aparece acá.
 *
 * Límite: solo sirve para lo vendido desde este mismo dispositivo. Otro equipo
 * sin red no puede resolver y debe esperar conexión.
 */

export type ResultadoValidacionLocal =
  | { estado: 'autorizado'; mensaje: string; ticket: TicketBackend }
  | { estado: 'ya_usado'; mensaje: string; ticket: TicketBackend }
  | { estado: 'desconocido' }

export async function validarSinConexion(
  numeroTicket: string,
): Promise<ResultadoValidacionLocal> {
  const folio = numeroTicket.trim()
  if (!folio) return { estado: 'desconocido' }

  const venta = await db.ventasPendientes
    .filter(
      (v) => v.venta.numeroTicket === folio || v.venta.numeroTicketGuia === folio,
    )
    .first()

  if (!venta) return { estado: 'desconocido' }

  const ticket = await db.ticketsLocales.where('numeroTicket').equals(folio).first()

  /*
   * El sello se busca POR FOLIO, no por venta.
   *
   * Una venta con guía sin carnet tiene dos pases y entran por separado. Cuando
   * el sello era de la venta, el primero en pasar dejaba al otro figurando como
   * usado, y en la puerta se le negaba el ingreso a alguien que había pagado.
   */
  const usoPrevio =
    venta.usosLocales?.[folio] ??
    // Filas anteriores a este cambio: `fechaUsoLocal` era de toda la venta y lo
    // único razonable es atribuirlo al pase del visitante, que es el que se
    // sellaba de hecho.
    (venta.fechaUsoLocal && folio === venta.venta.numeroTicket
      ? { fechaUso: venta.fechaUsoLocal }
      : undefined)

  if (usoPrevio) {
    return {
      estado: 'ya_usado',
      mensaje: `Este pase ya se utilizó el ${formatearInstante(usoPrevio.fechaUso)}.`,
      ticket: ticket ?? sinDetalle(folio, venta.resumen.nombreGrupo),
    }
  }

  const fechaUso = new Date().toISOString()

  // El sello es local y se sube al reconectar. Marcarlo acá es lo que evita que
  // el mismo pase entre dos veces mientras dura el corte de red.
  await db.transaction('rw', [db.ventasPendientes, db.ticketsLocales], async () => {
    await db.ventasPendientes.put({
      ...venta,
      usosLocales: { ...(venta.usosLocales ?? {}), [folio]: { fechaUso } },
    })
    if (ticket) await db.ticketsLocales.put({ ...ticket, fechaUso })
  })

  return {
    estado: 'autorizado',
    mensaje: 'Ingreso autorizado sin conexión. Se confirmará al sincronizar.',
    ticket: ticket ?? sinDetalle(folio, venta.resumen.nombreGrupo),
  }
}

/** Respaldo mínimo si la venta está en la cola pero el espejo del ticket no:
 *  el pase igual es válido y no se le puede negar el paso al visitante. */
function sinDetalle(numeroTicket: string, nombre: string): TicketBackend {
  return {
    id: 0,
    numeroTicket,
    tipoTicket: 'VISITANTE',
    nombre,
    cantidadPersonas: 0,
    montoTotal: '0',
    origenOffline: true,
  }
}
