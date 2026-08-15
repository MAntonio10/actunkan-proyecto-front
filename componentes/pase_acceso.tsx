'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Compass,
  AlertCircle,
  Ticket as TicketIcon,
  Mountain,
  BookOpen,
  QrCode,
} from 'lucide-react'
import { LogosInstitucionales } from './logos_institucionales'
import { type TicketBackend } from '@/tipos'
import { type DatosTicketPreview } from './formulario_visitante_completo'
import { CodigoQR } from './codigo_qr'
import { esPagoPendiente } from '@/lib/utils_pagos'

interface PaseAccesoProps {
  /** Vista previa en vivo mientras se llena el formulario (aún sin emitir). */
  preview?: DatosTicketPreview
  /** Tickets ya emitidos por el backend, con folio y QR firmado reales. */
  ticketsEmitidos?: TicketBackend[]
  fecha: Date
}

function IconoAtraccion({ codigo }: { codigo?: string }) {
  if (codigo === 'mariposario') return <BookOpen className="h-4 w-4 text-purple-500 shrink-0" />
  return <Mountain className="h-4 w-4 text-emerald-500 shrink-0" />
}

export function PaseAcceso({ preview, ticketsEmitidos, fecha }: PaseAccesoProps) {
  const fechaFormateada = useMemo(() => fecha.toISOString().split('T')[0], [fecha])

  const emitidos = ticketsEmitidos || []
  const tieneEmitidos = emitidos.length > 0

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Cabecera del pase */}
        <div className="flex flex-col items-center pt-5 pb-3 border-b border-dashed border-border/50 px-4">
          <LogosInstitucionales tamano="md" className="mb-1.5" />
          <h2 className="text-xl font-bold tracking-tight">ACTÚN KAN</h2>
          <span className="text-xs uppercase tracking-wider text-primary font-medium">
            Pase de Acceso
          </span>
        </div>

        {tieneEmitidos ? (
          emitidos.length > 1 ? (
            <Tabs defaultValue={String(emitidos[0].id)} className="w-full">
              <div className="px-4 pt-3 pb-1 border-b border-border/40 bg-muted/20 flex justify-center">
                <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${emitidos.length}, minmax(0, 1fr))` }}>
                  {emitidos.map((t) => (
                    <TabsTrigger
                      key={t.id}
                      value={String(t.id)}
                      className={`text-xs gap-1.5 font-medium ${
                        t.tipoTicket === 'GUIA' ? 'text-amber-500 font-semibold' : ''
                      }`}
                    >
                      {t.tipoTicket === 'GUIA' ? (
                        <Compass className="h-3.5 w-3.5" />
                      ) : (
                        <TicketIcon className="h-3.5 w-3.5" />
                      )}
                      {t.tipoTicket === 'GUIA' ? 'Ticket Guía' : 'Ticket Visitante'}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {emitidos.map((t) => (
                <TabsContent key={t.id} value={String(t.id)} className="p-6 space-y-4 m-0">
                  <TicketEmitidoRender ticket={t} fechaFormateada={fechaFormateada} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="p-6 space-y-4">
              <TicketEmitidoRender ticket={emitidos[0]} fechaFormateada={fechaFormateada} />
            </div>
          )
        ) : (
          <div className="p-6 space-y-4">
            <VistaPrevia preview={preview} fechaFormateada={fechaFormateada} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Pase real: folio, montos y QR provienen del backend. */
function TicketEmitidoRender({
  ticket,
  fechaFormateada,
}: {
  ticket: TicketBackend
  fechaFormateada: string
}) {
  const esGuia = ticket.tipoTicket === 'GUIA'
  const opcionPago = ticket.ticketPagos?.[0]
  const tienePagoPendiente = esPagoPendiente(ticket.estadoPago)

  return (
    <>
      {tienePagoPendiente && (
        <div className="rounded-lg bg-amber-500/15 border-2 border-amber-500/40 p-3 flex flex-col gap-1 text-xs text-amber-900 dark:text-amber-300 shadow-xs">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Pago Pendiente de Confirmación</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Este ticket no autoriza el acceso a las instalaciones hasta que el pago con tarjeta sea confirmado en la pasarela.
          </p>
        </div>
      )}

      {esGuia && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <AlertCircle className="h-4 w-4" />
            <span>Ticket de Guía (Sin Carnet)</span>
          </div>
        </div>
      )}

      {/* Folio real generado por el servidor */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          No. Ticket
        </span>
        <span className="text-sm font-black tracking-wide text-primary font-mono">
          {ticket.numeroTicket}
        </span>
      </div>

      {ticket.atraccion && (
        <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-2.5 flex items-center justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Atracción
          </span>
          <span className="text-sm font-black tracking-wide text-foreground uppercase flex items-center gap-1.5">
            <IconoAtraccion codigo={ticket.atraccion.codigo} />
            <span>{ticket.atraccion.nombre}</span>
          </span>
        </div>
      )}

      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {esGuia ? 'Nombre del Guía' : 'Titular / Grupo'}
        </span>
        <p className="text-xl font-bold mt-0.5 tracking-wide text-foreground">
          {ticket.nombre || ticket.guia?.nombre || '...'}
        </p>
      </div>

      {!esGuia && ticket.guia && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-0.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
            Guía Acompañante
          </span>
          <p className="text-base font-extrabold text-foreground tracking-wide uppercase">
            {ticket.guia.nombre}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">
            {ticket.guia.tieneCarnet ? 'Guía Acreditado' : 'Ticket Independiente'}
          </p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Fecha</span>
          <p className="font-semibold text-base mt-0.5">{fechaFormateada}</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {esGuia ? 'Acceso' : 'Personas'}
          </span>
          <p className="font-semibold text-base mt-0.5">
            {esGuia ? '1 Guía (Sin Carnet)' : `${ticket.cantidadPersonas} Pax`}
          </p>
        </div>
      </div>

      {ticket.origen && (
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Origen</span>
          <p className="text-primary font-bold text-base mt-0.5">
            {ticket.origen.nombre}
            {ticket.pais ? ` · ${ticket.pais.nombre}` : ''}
          </p>
        </div>
      )}

      {opcionPago && (
        <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-3 flex items-center justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Monto Pagado
          </span>
          <span className="text-base font-black tracking-wide text-foreground">
            Q{parseFloat(opcionPago.monto).toFixed(2)}
          </span>
        </div>
      )}

      {/* Separador punteado estilo ticket */}
      <div className="relative py-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="border-t border-dashed border-border/50" />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {esGuia ? 'Total Ticket Guía' : 'Total a Pagar'}
        </span>
        <p className={`text-3xl font-bold ${esGuia ? 'text-amber-500' : ''}`}>
          Q{parseFloat(ticket.montoTotal).toFixed(2)}
        </p>
      </div>

      {/* QR firmado por el servidor: se codifica tal cual viene */}
      <div className="flex flex-col items-center pt-2">
        {ticket.qr ? (
          <>
            <div
              className={`bg-white p-3 rounded-lg shadow-sm border-2 ${
                esGuia ? 'border-amber-500/40' : 'border-border/40'
              }`}
            >
              <CodigoQR valor={ticket.qr} size={esGuia ? 180 : 208} />
            </div>
            <span
              className={`text-[11px] font-medium mt-2 text-center ${
                tienePagoPendiente
                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : 'uppercase tracking-wider text-muted-foreground'
              }`}
            >
              {tienePagoPendiente ? '⚠️ Inactivo hasta confirmar pago' : 'Escanee para validar ticket'}
            </span>
          </>
        ) : (
          <p className="text-xs text-muted-foreground py-4">
            Este ticket no incluye código QR.
          </p>
        )}
      </div>
    </>
  )
}

/** Vista previa antes de emitir: sin folio ni QR, porque los genera el servidor. */
function VistaPrevia({
  preview,
  fechaFormateada,
}: {
  preview?: DatosTicketPreview
  fechaFormateada: string
}) {
  const datosGuia = preview?.datosGuia
  const montoVisitante =
    preview && datosGuia?.requiereTicketSeparado
      ? Math.max(0, preview.montoTotal - datosGuia.precioTicketGuia)
      : preview?.montoTotal || 0

  return (
    <>
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Atracción
        </span>
        <span className="text-sm font-black tracking-wide text-foreground uppercase flex items-center gap-1.5">
          <IconoAtraccion codigo={preview?.codigoAtraccion} />
          <span>{preview?.nombreAtraccion || '...'}</span>
        </span>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Titular / Grupo
        </span>
        <p className="text-xl font-bold mt-0.5 tracking-wide text-foreground">
          {preview?.nombreVisitante || '...'}
        </p>
      </div>

      {datosGuia?.asignado && (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-0.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
            Guía Acompañante
          </span>
          <p className="text-base font-extrabold text-foreground tracking-wide uppercase">
            {datosGuia.nombre}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">
            {datosGuia.tieneCarnet ? 'Guía Acreditado' : 'Ticket Independiente'}
          </p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Fecha</span>
          <p className="font-semibold text-base mt-0.5">{fechaFormateada}</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Personas</span>
          <p className="font-semibold text-base mt-0.5">
            {preview?.cantidadPersonas || 0} Pax
          </p>
        </div>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Tipo de Acceso
        </span>
        <p className="text-primary font-bold text-sm mt-0.5">
          {preview?.descripcionAcceso || '...'}
        </p>
      </div>

      {preview?.nombreOpcionPago && (
        <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-3 flex items-center justify-between shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Forma de Pago
          </span>
          <span className="text-base font-black tracking-wide text-foreground uppercase">
            {preview.nombreOpcionPago}
          </span>
        </div>
      )}

      <div className="relative py-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="border-t border-dashed border-border/50" />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {datosGuia?.requiereTicketSeparado ? 'Subtotal Visitante' : 'Total a Pagar'}
        </span>
        <p className="text-3xl font-bold">Q{montoVisitante.toFixed(2)}</p>
      </div>

      {/* El QR y el folio solo existen después de emitir: el servidor los firma */}
      <div className="flex flex-col items-center pt-2">
        <div className="bg-muted/40 border-2 border-dashed border-border/60 rounded-lg h-[208px] w-[208px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <QrCode className="h-10 w-10 opacity-40" />
          <span className="text-[11px] text-center px-4 leading-tight">
            El código QR se genera al emitir el ticket
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">
          Vista previa
        </span>
      </div>
    </>
  )
}
