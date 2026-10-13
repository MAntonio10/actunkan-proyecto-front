'use client'

import { useState, useCallback } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import {
  FormularioVisitanteCompleto,
  type DatosTicketPreview,
} from '@/componentes/formulario_visitante_completo'
import { HistorialTicketsEmitidos } from '@/componentes/historial_tickets_emitidos'
import { PaseAcceso } from '@/componentes/pase_acceso'
import { PaseImprimible } from '@/componentes/pase_imprimible'
import { PanelCheckoutTarjeta } from '@/componentes/panel_checkout_tarjeta'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Ticket,
  History,
  QrCode,
  RotateCcw,
  FileText,
  Printer,
  CreditCard,
  RefreshCw,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { usePdfTicket } from '@/hooks/use_pdf_ticket'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { extraerCheckoutUrl, esPagoPendiente } from '@/lib/utils_pagos'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  type CatalogosTickets,
  type RespuestaEmisionTicket,
  type TicketBackend,
} from '@/tipos'

export default function RegistroVisitantesPage() {
  const { abrirPdf, pdfEnCursoId } = usePdfTicket()
  const [datosPreview, setDatosPreview] = useState<DatosTicketPreview | undefined>()
  const [ticketsEmitidos, setTicketsEmitidos] = useState<TicketBackend[]>([])
  const [respuestaEmision, setRespuestaEmision] = useState<RespuestaEmisionTicket | null>(null)
  const [checkoutUrlEmitido, setCheckoutUrlEmitido] = useState<string | null>(null)
  const [checkoutModalAbierto, setCheckoutModalAbierto] = useState<boolean>(false)
  const [cargandoCheckout, setCargandoCheckout] = useState<boolean>(false)
  const [pestanaActiva, setPestanaActiva] = useState<string>('emision')
  const [catalogos, setCatalogos] = useState<CatalogosTickets | null>(null)
  const [refrescarHistorial, setRefrescarHistorial] = useState(0)
  // El historial se monta la primera vez que se abre y de ahí en adelante
  // permanece montado, para no cobrarle un GET /tickets a quien nunca lo usa.
  const [historialMontado, setHistorialMontado] = useState(false)

  const handleDatosChange = useCallback((datos: DatosTicketPreview) => {
    setDatosPreview(datos)
  }, [])

  // Los catálogos los carga el formulario y los comparte hacia arriba: el
  // historial los necesita para traducir ids a nombres en filtros y tabla.
  // Así se piden una sola vez y, al editar tarifas, el historial ve el cambio.
  const handleCatalogosCargados = useCallback((c: CatalogosTickets) => {
    setCatalogos(c)
  }, [])

  const handleTicketEmitido = useCallback(async (respuesta: RespuestaEmisionTicket) => {
    setRespuestaEmision(respuesta)
    const lista = Array.isArray(respuesta?.tickets) ? respuesta.tickets : []
    setTicketsEmitidos(lista)
    setRefrescarHistorial((n) => n + 1)

    // 1. Extraer URL de checkout de la respuesta (directa o anidada)
    let url = extraerCheckoutUrl(respuesta)

    const primerTicket = lista[0]

    // 2. Comprobar si el ticket es con pago con tarjeta o pendiente
    const esTarjeta =
      lista.some((t) => esPagoPendiente(t.estadoPago)) ||
      Boolean(url)

    // 3. Si no vino en la respuesta directa pero el ticket tiene id, consultar /pagos/ticket/:idTicket
    if (!url && primerTicket?.id) {
      setCargandoCheckout(true)
      try {
        const infoPago = await api.pagos.getPorTicket(primerTicket.id)
        url = extraerCheckoutUrl(infoPago)
      } catch (err) {
        console.warn('Consulta de pago por ticket:', err)
      } finally {
        setCargandoCheckout(false)
      }
    }

    if (url) {
      setCheckoutUrlEmitido(url)
      setCheckoutModalAbierto(true)
    } else if (esTarjeta) {
      setCheckoutModalAbierto(true)
    }
  }, [])

  const cambiarPestana = useCallback((valor: string) => {
    setPestanaActiva(valor)
    if (valor === 'historial') {
      setHistorialMontado(true)
      // Al volver se refresca: el componente ya no se desmonta, así que sin
      // esto mostraría los resultados con los que quedó la última vez.
      setRefrescarHistorial((n) => n + 1)
    }
  }, [])

  const reiniciarEmision = useCallback(() => {
    setTicketsEmitidos([])
    setRespuestaEmision(null)
    setCheckoutUrlEmitido(null)
    setCheckoutModalAbierto(false)
  }, [])

  return (
    <RutaProtegida moduloRequerido="EmisionTickets">
      {/* De `md` para arriba la página ocupa el alto exacto de la ventana y no
          se desplaza: lo hace la zona de contenido. Así el título y las pestañas
          de Emisión/Historial quedan siempre a la vista, en vez de irse hacia
          arriba mientras el taquillero llena el formulario.
          Desde `md` y no desde `lg` porque abajo de 1024 px las dos columnas se
          apilan pero la página sigue siendo igual de larga, y ahí reaparecía la
          barra de la ventana. En teléfono (bajo `md`) no aplica: ahí desplazar
          la página entera es lo correcto. */}
      <div className="min-h-screen flex flex-col md:h-screen md:min-h-0 md:overflow-hidden">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 md:flex md:flex-col md:min-h-0">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 md:shrink-0">
            <div className="titulo-seccion">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Módulo de Visitantes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Emisión de boletos y registro histórico de taquilla
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
              <Tabs
                value={pestanaActiva}
                onValueChange={cambiarPestana}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-2 w-full sm:w-[300px] bg-muted p-1 gap-1">
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

              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2 shrink-0 h-10 w-full sm:w-auto"
              >
                <Link href="/validar-ticket">
                  <QrCode className="h-4 w-4 text-primary" />
                  Validar QR
                </Link>
              </Button>
            </div>
          </div>

          {/* Las pestañas se ocultan en vez de desmontarse: al desmontar, el
              formulario perdía todo lo capturado si el taquillero consultaba el
              historial a media venta, y volvía a pedir los catálogos. */}
          <div
            className={cn(
              // Entre `md` y `lg` las dos columnas van apiladas: el
              // desplazamiento va acá, en una sola caja. Desde `lg` se reparte
              // en cada columna y esta vuelve a `visible`.
              'grid grid-cols-1 lg:grid-cols-5 gap-6',
              'md:flex-1 md:min-h-0 md:overflow-y-auto lg:overflow-visible scroll-sin-barra',
              pestanaActiva !== 'emision' && 'hidden',
            )}
          >
              {/* `min-h-0` es lo que permite que la columna se desplace: sin él
                  un hijo de rejilla crece con su contenido y empuja la página. */}
              <div className="lg:col-span-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1 scroll-sin-barra">
                <FormularioVisitanteCompleto
                  onDatosChange={handleDatosChange}
                  onTicketEmitido={handleTicketEmitido}
                  onCatalogosCargados={handleCatalogosCargados}
                />
              </div>

              <div className="lg:col-span-2 lg:min-h-0 lg:overflow-y-auto scroll-sin-barra">
                <div className="space-y-3">
                  {/* Panel de Enlace de Pago si se emitió con tarjeta */}
                  {(() => {
                    const urlCheckout =
                      checkoutUrlEmitido ||
                      extraerCheckoutUrl(respuestaEmision) ||
                      extraerCheckoutUrl(ticketsEmitidos)

                    if (!urlCheckout) return null

                    const primerTicket = ticketsEmitidos[0]
                    return (
                      <PanelCheckoutTarjeta
                        checkoutUrl={urlCheckout}
                        idTicket={primerTicket?.id}
                        numeroTicket={primerTicket?.numeroTicket}
                        montoTotal={respuestaEmision?.montoTotalGeneral || primerTicket?.montoTotal}
                        nombreVisitante={primerTicket?.nombre || undefined}
                        atraccion={primerTicket?.atraccion?.nombre}
                      />
                    )
                  })()}

                  <PaseAcceso
                    preview={datosPreview}
                    ticketsEmitidos={ticketsEmitidos}
                    fecha={new Date()}
                  />

                  {/* Invisible en pantalla; es lo único que se ve al imprimir.
                      Ver el bloque `@media print` en app/globals.css. */}
                  <PaseImprimible ticketsEmitidos={ticketsEmitidos} fecha={new Date()} />

                  {ticketsEmitidos.length > 0 && (
                    <div className="space-y-2">
                      {/*
                        Imprimir va primero y siempre, con red o sin ella: es lo
                        único que funciona en los dos casos, y en una taquilla lo
                        que hace falta es el papel en la mano.

                        El rótulo dice que el pase ya sirve. «Imprimir» a secas,
                        en un turno sin señal, deja al taquillero dudando de si
                        el visitante puede pasar o hay que esperar a que suba.
                      */}
                      <Button
                        onClick={() => window.print()}
                        className="w-full gap-2 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        {ticketsEmitidos.length > 1
                          ? 'Imprimir los pases — ya son válidos'
                          : 'Imprimir el pase — ya es válido'}
                      </Button>

                      {/* El PDF lo arma el backend, así que sin conexión no
                          está. No es un problema: el pase impreso de arriba
                          lleva el mismo QR y sirve igual. */}
                      {ticketsEmitidos.some((t) => t.origenOffline) ? (
                        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
                          Emitido sin conexión. El PDF se podrá descargar desde el historial cuando
                          la recaudación suba, pero no hace falta esperarlo: el pase impreso y su
                          código QR ya son válidos para el ingreso.
                        </p>
                      ) : (
                        /* Un PDF por ticket: con guía sin carnet se emiten dos */
                        ticketsEmitidos.map((t) => (
                          <Button
                            key={t.id}
                            variant="outline"
                            onClick={() => abrirPdf(t)}
                            disabled={pdfEnCursoId === t.id}
                            className="w-full gap-2 cursor-pointer"
                          >
                            {pdfEnCursoId === t.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                            {ticketsEmitidos.length > 1
                              ? `PDF ${t.tipoTicket === 'GUIA' ? 'del guía' : 'del visitante'}`
                              : 'Ver PDF del pase'}
                          </Button>
                        ))
                      )}
                      <Button
                        variant="outline"
                        onClick={reiniciarEmision}
                        className="w-full gap-2 cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Preparar siguiente ticket
                      </Button>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Modal emergente para compartir enlace de pago al emitir con tarjeta */}
          <Dialog open={checkoutModalAbierto} onOpenChange={setCheckoutModalAbierto}>
            <DialogContent className="max-w-lg p-0 overflow-hidden border-2 border-amber-500/50">
              <DialogHeader className="sr-only">
                <DialogTitle>Enlace de Pago con Tarjeta</DialogTitle>
                <DialogDescription>
                  Comparte el enlace de pago de Recurrente con el cliente
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const urlCheckout =
                  checkoutUrlEmitido ||
                  extraerCheckoutUrl(respuestaEmision) ||
                  extraerCheckoutUrl(ticketsEmitidos)

                if (urlCheckout) {
                  const primerTicket = ticketsEmitidos[0]
                  return (
                    <div className="p-1 space-y-3">
                      <PanelCheckoutTarjeta
                        checkoutUrl={urlCheckout}
                        idTicket={primerTicket?.id}
                        numeroTicket={primerTicket?.numeroTicket}
                        montoTotal={respuestaEmision?.montoTotalGeneral || primerTicket?.montoTotal}
                        nombreVisitante={primerTicket?.nombre || undefined}
                        atraccion={primerTicket?.atraccion?.nombre}
                      />
                      <div className="px-4 pb-3 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCheckoutModalAbierto(false)}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          Entendido, continuar
                        </Button>
                      </div>
                    </div>
                  )
                }

                if (cargandoCheckout) {
                  return (
                    <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                      <Spinner className="h-8 w-8 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Generando enlace de pago en pasarela Recurrente...
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="p-6 text-center space-y-4">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
                      <CreditCard className="h-6 w-6 text-amber-600 mx-auto mb-2" />
                      <p className="font-bold text-sm">Ticket emitido con cobro PENDIENTE</p>
                      <p className="mt-1">
                        El ticket fue generado en el sistema. Puedes consultar el enlace en el historial de tickets o reintentar obtenerlo ahora.
                      </p>
                    </div>
                    {ticketsEmitidos[0]?.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setCargandoCheckout(true)
                          try {
                            const info = await api.pagos.getPorTicket(ticketsEmitidos[0].id)
                            const u = extraerCheckoutUrl(info)
                            if (u) {
                              setCheckoutUrlEmitido(u)
                              toast.success('Enlace de pago obtenido')
                            } else {
                              toast.warning('Aún no se ha generado la URL de pasarela')
                            }
                          } catch (e) {
                            toast.error('No se pudo obtener el enlace de pago')
                          } finally {
                            setCargandoCheckout(false)
                          }
                        }}
                        className="gap-1.5 text-xs cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reintentar obtención de link
                      </Button>
                    )}
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          {historialMontado && (
            <div
              className={cn(
                'md:flex-1 md:min-h-0 md:overflow-y-auto scroll-sin-barra',
                pestanaActiva !== 'historial' && 'hidden',
              )}
            >
              <HistorialTicketsEmitidos
                catalogos={catalogos}
                refrescarToken={refrescarHistorial}
              />
            </div>
          )}
        </main>
      </div>
    </RutaProtegida>
  )
}
