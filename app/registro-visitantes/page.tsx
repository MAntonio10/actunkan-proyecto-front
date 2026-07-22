'use client'

import { useState, useCallback } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import {
  FormularioVisitanteCompleto,
  type DatosTicketPreview,
} from '@/componentes/formulario_visitante_completo'
import { HistorialTicketsEmitidos } from '@/componentes/historial_tickets_emitidos'
import { PaseAcceso } from '@/componentes/pase_acceso'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Ticket, History } from 'lucide-react'
import { TIPOS_ACCESO, TICKETS_EMITIDOS_DEMO, type TicketEmitido } from '@/tipos'

const DATOS_INICIALES: DatosTicketPreview = {
  nombreVisitante: '',
  tipoAcceso: TIPOS_ACCESO[0],
  cantidadPersonas: 1,
  montoTotal: 0,
  metodoPago: 'efectivo',
  atraccion: 'cuevas',
}

export default function RegistroVisitantesPage() {
  const [datosPreview, setDatosPreview] = useState<DatosTicketPreview>(DATOS_INICIALES)
  const [ticketsEmitidos, setTicketsEmitidos] = useState<TicketEmitido[]>(TICKETS_EMITIDOS_DEMO)
  const [pestanaActiva, setPestanaActiva] = useState<string>('emision')

  const handleDatosChange = useCallback((datos: DatosTicketPreview) => {
    setDatosPreview(datos)
  }, [])

  const handleTicketEmitido = useCallback((nuevoTicket: TicketEmitido) => {
    setTicketsEmitidos((prev) => [nuevoTicket, ...prev])
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <BarraNavegacionSuperior />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* Encabezado con pestañas principales del módulo */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="titulo-seccion">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Módulo de Visitantes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Emisión de boletos para Cuevas y Mariposario + Registro histórico de taquilla
            </p>
          </div>

          {/* Selector de Pestañas del Módulo: Emisión vs Historial */}
          <Tabs value={pestanaActiva} onValueChange={setPestanaActiva} className="w-full md:w-auto">
            <TabsList className="grid grid-cols-2 w-full md:w-[360px] bg-muted/60 p-1">
              <TabsTrigger value="emision" className="text-xs sm:text-sm gap-2 font-semibold cursor-pointer">
                <Ticket className="h-4 w-4 text-primary" />
                <span>Emisión Ticket</span>
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs sm:text-sm gap-2 font-semibold cursor-pointer">
                <History className="h-4 w-4 text-primary" />
                <span>Historial ({ticketsEmitidos.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Pestaña 1: Emisión de Tickets */}
        {pestanaActiva === 'emision' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Formulario - 3 columnas en desktop */}
            <div className="lg:col-span-3">
              <FormularioVisitanteCompleto
                onDatosChange={handleDatosChange}
                onTicketEmitido={handleTicketEmitido}
              />
            </div>

            {/* Preview del pase - 2 columnas en desktop */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24">
                <PaseAcceso
                  nombreVisitante={datosPreview.nombreVisitante}
                  tipoAcceso={datosPreview.tipoAcceso}
                  cantidadPersonas={datosPreview.cantidadPersonas}
                  montoTotal={datosPreview.montoTotal}
                  datosGuia={datosPreview.datosGuia}
                  metodoPago={datosPreview.metodoPago || 'efectivo'}
                  atraccion={datosPreview.atraccion || 'cuevas'}
                  fecha={new Date()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pestaña 2: Historial de Tickets Emitidos */}
        {pestanaActiva === 'historial' && (
          <HistorialTicketsEmitidos tickets={ticketsEmitidos} />
        )}
      </main>
    </div>
  )
}
