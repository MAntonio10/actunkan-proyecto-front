'use client'

import { useState, useCallback, useEffect } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import {
  FormularioVisitanteCompleto,
  type DatosTicketPreview,
} from '@/componentes/formulario_visitante_completo'
import { HistorialTicketsEmitidos } from '@/componentes/historial_tickets_emitidos'
import { PaseAcceso } from '@/componentes/pase_acceso'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Ticket, History, QrCode, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import {
  type CatalogosTickets,
  type RespuestaEmisionTicket,
  type TicketBackend,
} from '@/tipos'

export default function RegistroVisitantesPage() {
  const [datosPreview, setDatosPreview] = useState<DatosTicketPreview | undefined>()
  const [ticketsEmitidos, setTicketsEmitidos] = useState<TicketBackend[]>([])
  const [pestanaActiva, setPestanaActiva] = useState<string>('emision')
  const [catalogos, setCatalogos] = useState<CatalogosTickets | null>(null)
  const [refrescarHistorial, setRefrescarHistorial] = useState(0)

  // Los catálogos se cargan aquí también para que el historial pueda traducir
  // ids de atracción y forma de pago a nombres en sus filtros y tabla.
  useEffect(() => {
    api.tickets
      .getCatalogos()
      .then(setCatalogos)
      .catch(() => setCatalogos(null))
  }, [])

  const handleDatosChange = useCallback((datos: DatosTicketPreview) => {
    setDatosPreview(datos)
  }, [])

  const handleTicketEmitido = useCallback((respuesta: RespuestaEmisionTicket) => {
    setTicketsEmitidos(respuesta.tickets)
    setRefrescarHistorial((n) => n + 1)
  }, [])

  return (
    <RutaProtegida moduloRequerido="EmisionTickets">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="titulo-seccion">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Módulo de Visitantes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Emisión de boletos y registro histórico de taquilla
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button variant="outline" size="sm" asChild className="gap-2 shrink-0">
                <Link href="/validar-ticket">
                  <QrCode className="h-4 w-4 text-primary" />
                  Validar QR
                </Link>
              </Button>

              <Tabs value={pestanaActiva} onValueChange={setPestanaActiva} className="w-full md:w-auto">
                <TabsList className="grid grid-cols-2 w-full md:w-[300px] bg-muted/60 p-1">
                  <TabsTrigger
                    value="emision"
                    className="text-xs sm:text-sm gap-2 font-semibold cursor-pointer"
                  >
                    <Ticket className="h-4 w-4 text-primary" />
                    <span>Emisión</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="historial"
                    className="text-xs sm:text-sm gap-2 font-semibold cursor-pointer"
                  >
                    <History className="h-4 w-4 text-primary" />
                    <span>Historial</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {pestanaActiva === 'emision' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <FormularioVisitanteCompleto
                  onDatosChange={handleDatosChange}
                  onTicketEmitido={handleTicketEmitido}
                />
              </div>

              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-24 space-y-3">
                  <PaseAcceso
                    preview={datosPreview}
                    ticketsEmitidos={ticketsEmitidos}
                    fecha={new Date()}
                  />

                  {/* Tras emitir, el pase queda fijo para poder imprimirlo; este
                      botón lo limpia para volver a la vista previa en vivo. */}
                  {ticketsEmitidos.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setTicketsEmitidos([])}
                      className="w-full gap-2 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Preparar siguiente ticket
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {pestanaActiva === 'historial' && (
            <HistorialTicketsEmitidos
              catalogos={catalogos}
              refrescarToken={refrescarHistorial}
            />
          )}
        </main>
      </div>
    </RutaProtegida>
  )
}
