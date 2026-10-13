'use client'

import Image from 'next/image'

import { CodigoQR } from '@/componentes/codigo_qr'
import { fechaIsoEnGuatemala } from '@/lib/fecha_guatemala'
import { esPagoPendiente } from '@/lib/utils_pagos'
import type { TicketBackend } from '@/tipos'

/**
 * El pase tal como sale por la impresora de tickets.
 *
 * Existe porque el PDF lo arma el servidor y sin conexión no hay forma de
 * pedirlo: una venta offline dejaba al visitante sin comprobante impreso aunque
 * su QR ya fuera válido. Se descartó traer una librería de PDF al navegador —
 * sería una segunda implementación del mismo diseño, y divergiría del servidor
 * a la primera corrección. Esto imprime con el diálogo del navegador y ya.
 *
 * **La misma vista sirve conectado y sin conexión**, a propósito. Si el camino
 * con red usara el PDF del servidor y el camino sin red esta pantalla, volverían
 * a ser dos diseños que se separan con el tiempo, que es justo lo que se quiso
 * evitar.
 *
 * Decisiones que no son cosméticas:
 *
 * - **80 mm de ancho, no una hoja.** El pase del servidor mide 226,8 pt ≈ 80 mm
 *   porque va a una impresora térmica de tickets. Con `@page` de A4 saldría un
 *   pase diminuto en una esquina de una hoja.
 * - **Sin color ni fondos rellenos.** Una térmica es monocroma: un fondo de
 *   color sale como una mancha gris que se come el texto. Los estados se marcan
 *   con borde y mayúsculas, no con relleno.
 * - **El folio en monoespaciada**, como el original: cuando el lector de QR
 *   falla hay que teclearlo, y ahí una monoespaciada evita confundir caracteres.
 * - **Un pase por página.** Con guía sin carnet se emiten dos, y son dos
 *   comprobantes distintos para dos personas distintas.
 *
 * En pantalla no se ve: lo oculta `@media print` en `app/globals.css`, que es
 * también donde se esconde el resto de la página al imprimir.
 */

function Fila({ etiqueta, valor }: { etiqueta: string; valor?: string | number | null }) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div className="pase-fila">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  )
}

function Pase({ ticket, fecha }: { ticket: TicketBackend; fecha: string }) {
  const esGuia = ticket.tipoTicket === 'GUIA'
  const pagoPendiente = esPagoPendiente(ticket.estadoPago)
  const opcionPago = ticket.ticketPagos?.[0]

  return (
    <article className="pase-hoja">
      <header className="pase-cabecera">
        <div className="pase-logos">
          <Image src="/Propeten.png" alt="ProPetén" width={120} height={120} />
          <Image src="/actun.png" alt="Parque Regional Municipal Actún Kan" width={120} height={120} />
        </div>
        <h1>ACTÚN KAN</h1>
        <h2>{esGuia ? 'PASE DE GUÍA' : 'PASE DE ACCESO'}</h2>
      </header>

      {/* Los estados van arriba: si el pase no sirve, eso es lo primero que
          tiene que ver quien lo recibe, no un detalle al pie. */}
      {ticket.anulado && <p className="pase-estado">ANULADO · NO VÁLIDO</p>}
      {pagoPendiente && <p className="pase-estado">PENDIENTE · PAGO SIN CONFIRMAR</p>}
      {esGuia && <p className="pase-estado">GUÍA SIN CARNET</p>}

      <section className="pase-bloque">
        <span className="pase-rotulo">{esGuia ? 'GUÍA' : 'TITULAR / GRUPO'}</span>
        <p className="pase-titular">{ticket.nombre || ticket.guia?.nombre || '—'}</p>
      </section>

      <section className="pase-bloque">
        <span className="pase-rotulo">DETALLE</span>
        <Fila etiqueta="Atracción" valor={ticket.atraccion?.nombre} />
        <Fila etiqueta="Origen" valor={ticket.origen?.nombre} />
        <Fila etiqueta="País" valor={ticket.pais?.nombre} />
        <Fila etiqueta="Personas" valor={esGuia ? '1 guía' : `${ticket.cantidadPersonas} Pax`} />
        <Fila etiqueta="Fecha" valor={fecha} />
        <div className="pase-fila">
          <span>No. Ticket</span>
          <strong className="pase-folio">{ticket.numeroTicket}</strong>
        </div>
      </section>

      <section className="pase-total">
        <span>{esGuia ? 'TOTAL TICKET GUÍA' : 'TOTAL A PAGAR'}</span>
        <strong>Q{parseFloat(ticket.montoTotal).toFixed(2)}</strong>
      </section>
      {opcionPago && (
        <p className="pase-pago">
          Monto pagado: Q{parseFloat(opcionPago.monto).toFixed(2)}
        </p>
      )}

      <section className="pase-qr">
        {ticket.qr ? (
          <>
            <CodigoQR valor={ticket.qr} size={155} />
            <span>
              {pagoPendiente
                ? 'INACTIVO HASTA CONFIRMAR EL PAGO'
                : 'ESCANEE PARA VALIDAR TICKET'}
            </span>
          </>
        ) : (
          <span>Este ticket no incluye código QR.</span>
        )}
      </section>
    </article>
  )
}

export function PaseImprimible({
  ticketsEmitidos,
  fecha,
}: {
  ticketsEmitidos: TicketBackend[]
  fecha: Date
}) {
  if (ticketsEmitidos.length === 0) return null

  const fechaTexto = fechaIsoEnGuatemala(fecha)

  return (
    <div className="pase-imprimible" aria-hidden>
      {ticketsEmitidos.map((t) => (
        <Pase key={t.numeroTicket} ticket={t} fecha={fechaTexto} />
      ))}
    </div>
  )
}
