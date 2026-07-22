'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Compass, AlertCircle, Ticket as TicketIcon, Mountain, Flower2 } from 'lucide-react'
import Image from 'next/image'
import { type TipoAcceso, type MetodoPago, type AtraccionVisitante } from '@/tipos'
import { type DatosGuiaPreview } from './formulario_visitante_completo'
import { CodigoQR } from './codigo_qr'

interface PaseAccesoProps {
  nombreVisitante: string
  tipoAcceso: TipoAcceso
  cantidadPersonas: number
  montoTotal: number
  fecha: Date
  datosGuia?: DatosGuiaPreview
  metodoPago?: MetodoPago
  atraccion?: AtraccionVisitante
}

export function PaseAcceso({
  nombreVisitante,
  tipoAcceso,
  cantidadPersonas,
  montoTotal,
  fecha,
  datosGuia,
  metodoPago = 'efectivo',
  atraccion = 'cuevas',
}: PaseAccesoProps) {
  const fechaFormateada = useMemo(() => {
    return fecha.toISOString().split('T')[0]
  }, [fecha])

  const tieneTicketSeparado = Boolean(
    datosGuia?.asignado && datosGuia?.requiereTicketSeparado
  )

  const montoVisitante = useMemo(() => {
    if (tieneTicketSeparado && datosGuia) {
      return Math.max(0, montoTotal - datosGuia.precioTicketGuia)
    }
    return montoTotal
  }, [montoTotal, tieneTicketSeparado, datosGuia])

  // Codigo QR para el ticket del visitante
  const datosQRVisitante = useMemo(() => {
    return JSON.stringify({
      nombre: nombreVisitante || 'VISITANTE',
      atraccion: atraccion === 'cuevas' ? 'CUEVAS ACTUN KAN' : 'MARIPOSARIO',
      tipo: tipoAcceso.nombre,
      personas: cantidadPersonas,
      fecha: fechaFormateada,
      total: montoVisitante,
      pago: metodoPago,
      guia: datosGuia?.asignado ? datosGuia.nombre : 'Sin Guía',
    })
  }, [nombreVisitante, atraccion, tipoAcceso, cantidadPersonas, fechaFormateada, montoVisitante, metodoPago, datosGuia])

  // Codigo QR para el ticket independiente del guia
  const datosQRGuia = useMemo(() => {
    if (!datosGuia) return ''
    return JSON.stringify({
      tipo_ticket: 'GUIA_SIN_CARNET',
      guia_nombre: datosGuia.nombre,
      atraccion: atraccion === 'cuevas' ? 'CUEVAS ACTUN KAN' : 'MARIPOSARIO',
      personas: 1,
      fecha: fechaFormateada,
      total: datosGuia.precioTicketGuia,
      pago: datosGuia.metodoPago || metodoPago,
      estado: 'ACTIVO',
    })
  }, [datosGuia, atraccion, fechaFormateada, metodoPago])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Cabecera del pase */}
        <div className="flex flex-col items-center pt-5 pb-3 border-b border-dashed border-border/50 px-4">
          <Image
            src="/actun.png"
            alt="Actun Kan"
            width={64}
            height={64}
            className="h-12 w-auto mb-1.5"
          />
          <h2 className="text-xl font-bold tracking-tight">ACTUN KAN</h2>
          <span className="text-xs uppercase tracking-wider text-primary font-medium">
            Pase de Acceso
          </span>
        </div>

        {/* Si requiere 2 tickets (visitante + guía sin carnet), mostramos pestañas para conmutar el preview */}
        {tieneTicketSeparado && datosGuia ? (
          <Tabs defaultValue="visitante" className="w-full">
            <div className="px-4 pt-3 pb-1 border-b border-border/40 bg-muted/20 flex justify-center">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="visitante" className="text-xs gap-1.5 font-medium">
                  <TicketIcon className="h-3.5 w-3.5" />
                  Ticket Visitante
                </TabsTrigger>
                <TabsTrigger value="guia" className="text-xs gap-1.5 text-amber-500 font-semibold">
                  <Compass className="h-3.5 w-3.5" />
                  Ticket Guía
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Contenido: Ticket Visitante */}
            <TabsContent value="visitante" className="p-6 space-y-4 m-0">
              <RenderTicketVisitante
                nombreVisitante={nombreVisitante}
                fechaFormateada={fechaFormateada}
                cantidadPersonas={cantidadPersonas}
                tipoAcceso={tipoAcceso}
                monto={montoVisitante}
                datosQR={datosQRVisitante}
                datosGuia={datosGuia}
                metodoPago={metodoPago}
                atraccion={atraccion}
              />
            </TabsContent>

            {/* Contenido: Ticket Guía Independiente */}
            <TabsContent value="guia" className="p-6 space-y-4 m-0">
              {/* Encabezado de Ticket de Guía */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                  <AlertCircle className="h-4 w-4" />
                  <span>Ticket de Guía (Sin Carnet)</span>
                </div>
              </div>

              {/* Atracción / Destino */}
              <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-2.5 flex items-center justify-between shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Atracción
                </span>
                <span className="text-sm font-black tracking-wide text-foreground uppercase flex items-center gap-1.5">
                  {atraccion === 'cuevas' ? (
                    <>
                      <Mountain className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>CUEVAS ACTUN KAN</span>
                    </>
                  ) : (
                    <>
                      <Flower2 className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>MARIPOSARIO</span>
                    </>
                  )}
                </span>
              </div>

              {/* Nombre del Guía */}
              <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-3 space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
                  Nombre del Guía
                </span>
                <p className="text-xl font-extrabold text-foreground tracking-wide uppercase">
                  {datosGuia.nombre || 'Guía No Acreditado'}
                </p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Fecha
                  </span>
                  <p className="font-semibold text-base mt-0.5">{fechaFormateada}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Acceso
                  </span>
                  <p className="font-semibold text-base mt-0.5">1 Guía (Sin Carnet)</p>
                </div>
              </div>

              {/* Forma de Pago */}
              <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-3 flex items-center justify-between shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Forma de Pago
                </span>
                <span className="text-base font-black tracking-wide text-foreground uppercase">
                  {(datosGuia.metodoPago || metodoPago) === 'efectivo' ? 'EFECTIVO' : 'TARJETA'}
                </span>
              </div>

              {/* Separador punteado estilo ticket */}
              <div className="relative py-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-background" />
                <div className="border-t border-dashed border-border/50" />
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total Ticket Guía
                </span>
                <p className="text-3xl font-bold text-amber-500">
                  Q{datosGuia.precioTicketGuia.toFixed(2)}
                </p>
              </div>

              {/* QR Code del Guía */}
              <div className="flex flex-col items-center pt-2">
                <div className="bg-white p-3 rounded-lg shadow-sm border-2 border-amber-500/40">
                  <CodigoQR valor={datosQRGuia} size={180} />
                </div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">
                  QR Validación Ticket Guía
                </span>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          /* Render normal de ticket de visitante (con badge de guía si aplica) */
          <div className="p-6 space-y-4">
            <RenderTicketVisitante
              nombreVisitante={nombreVisitante}
              fechaFormateada={fechaFormateada}
              cantidadPersonas={cantidadPersonas}
              tipoAcceso={tipoAcceso}
              monto={montoTotal}
              datosQR={datosQRVisitante}
              datosGuia={datosGuia}
              metodoPago={metodoPago}
              atraccion={atraccion}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RenderTicketVisitante({
  nombreVisitante,
  fechaFormateada,
  cantidadPersonas,
  tipoAcceso,
  monto,
  datosQR,
  datosGuia,
  metodoPago,
  atraccion,
}: {
  nombreVisitante: string
  fechaFormateada: string
  cantidadPersonas: number
  tipoAcceso: TipoAcceso
  monto: number
  datosQR: string
  datosGuia?: DatosGuiaPreview
  metodoPago: MetodoPago
  atraccion: AtraccionVisitante
}) {
  return (
    <>
      {/* Atracción / Destino */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-2.5 flex items-center justify-between shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Atracción
        </span>
        <span className="text-sm font-black tracking-wide text-foreground uppercase flex items-center gap-1.5">
          {atraccion === 'cuevas' ? (
            <>
              <Mountain className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>CUEVAS ACTUN KAN</span>
            </>
          ) : (
            <>
              <Flower2 className="h-4 w-4 text-purple-500 shrink-0" />
              <span>MARIPOSARIO</span>
            </>
          )}
        </span>
      </div>

      {/* Titular del Visitante */}
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Titular / Grupo
        </span>
        <p className="text-xl font-bold mt-0.5 tracking-wide text-foreground">
          {nombreVisitante || '...'}
        </p>
      </div>

      {/* Guía Asignado */}
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

      {/* Fila: Fecha + Personas */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Fecha
          </span>
          <p className="font-semibold text-base mt-0.5">{fechaFormateada}</p>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Personas
          </span>
          <p className="font-semibold text-base mt-0.5">{cantidadPersonas} Pax</p>
        </div>
      </div>

      {/* Tipo de acceso */}
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Tipo de Acceso
        </span>
        <p className="text-primary font-bold text-base mt-0.5">
          {tipoAcceso.nombre.replace('Entrada ', '')}
        </p>
      </div>

      {/* Forma de Pago */}
      <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-3 flex items-center justify-between shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Forma de Pago
        </span>
        <span className="text-base font-black tracking-wide text-foreground uppercase">
          {metodoPago === 'efectivo' ? 'EFECTIVO' : 'TARJETA'}
        </span>
      </div>

      {/* Separador punteado estilo ticket */}
      <div className="relative py-2">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-background" />
        <div className="border-t border-dashed border-border/50" />
      </div>

      {/* Total */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {datosGuia?.requiereTicketSeparado ? 'Subtotal Visitante' : 'Total a Pagar'}
        </span>
        <p className="text-3xl font-bold">
          Q{monto.toFixed(2)}
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center pt-2">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-border/40">
          <CodigoQR valor={datosQR} size={208} />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">
          Escanee para validar ticket
        </span>
      </div>
    </>
  )
}
