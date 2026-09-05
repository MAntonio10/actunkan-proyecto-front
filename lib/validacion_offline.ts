import { db } from '@/lib/db_tickets'
import type { TicketBackend } from '@/tipos'

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

  if (venta.fechaUsoLocal) {
    return {
      estado: 'ya_usado',
      mensaje: `Este pase ya se utilizó el ${new Date(venta.fechaUsoLocal).toLocaleString('es-GT')}.`,
      ticket: ticket ?? sinDetalle(folio, venta.resumen.nombreGrupo),
    }
  }

  const fechaUsoLocal = new Date().toISOString()

  // El sello es local y se sube junto con la venta. Marcar el uso acá es lo que
  // evita que el mismo pase entre dos veces mientras dura el corte de red.
  await db.transaction('rw', [db.ventasPendientes, db.ticketsLocales], async () => {
    await db.ventasPendientes.put({ ...venta, fechaUsoLocal })
    if (ticket) await db.ticketsLocales.put({ ...ticket, fechaUso: fechaUsoLocal })
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
