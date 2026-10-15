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
import { PaseImprimible } from '@/componentes/pase_imprimible'
import { PanelCheckoutTarjeta } from '@/componentes/panel_checkout_tarjeta'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Copy,
  Send,
  ExternalLink,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { usePdfTicket } from '@/hooks/use_pdf_ticket'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { extraerCheckoutUrl, esPagoPendiente, esPagoPagado } from '@/lib/utils_pagos'
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
  const [linksPago, setLinksPago] = useState<Record<number, string>>({})
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

  // Cada ticket con tarjeta tiene su propio link: con guía sin carnet pueden ser
  // dos cobros, o solo el del guía si el visitante pagó en efectivo.
  const ticketsPorCobrar = ticketsEmitidos.filter((t) => t.id > 0 && esPagoPendiente(t.estadoPago))
  const idsPorCobrar = ticketsPorCobrar.map((t) => t.id).join(',')

  /** Busca el link de los tickets que todavía no lo tienen. */
  const cargarLinks = useCallback(async (tickets: TicketBackend[]) => {
    setCargandoCheckout(true)
    try {
      const pares = await Promise.all(
        tickets.map(async (t) => {
          let url = extraerCheckoutUrl(t)
          if (!url) {
            try {
              url = extraerCheckoutUrl(await api.pagos.getPorTicket(t.id))
            } catch (err) {
              console.warn('Consulta de pago por ticket:', err)
            }
          }
          return [t.id, url] as const
        }),
      )
      setLinksPago((prev) => {
        const siguiente = { ...prev }
        for (const [id, url] of pares) if (url) siguiente[id] = url
        return siguiente
      })
      return pares.every(([, url]) => url)
    } finally {
      setCargandoCheckout(false)
    }
  }, [])

  const handleTicketEmitido = useCallback(async (respuesta: RespuestaEmisionTicket) => {
    const lista = Array.isArray(respuesta?.tickets) ? respuesta.tickets : []
    setTicketsEmitidos(lista)
    setLinksPago({})
    setRefrescarHistorial((n) => n + 1)

    const pendientes = lista.filter((t) => t.id > 0 && esPagoPendiente(t.estadoPago))
    if (pendientes.length === 0) return
    setCheckoutModalAbierto(true)
    await cargarLinks(pendientes)
  }, [cargarLinks])

  // Sin esto el pase se quedaba en «Pago pendiente» aunque el webhook ya lo
  // hubiera confirmado: la respuesta de emisión es una foto del momento.
  useEffect(() => {
    if (!idsPorCobrar) return
    const ids = idsPorCobrar.split(',').map(Number)
    const intervalo = setInterval(async () => {
      const resultados = await Promise.allSettled(ids.map((id) => api.tickets.getTicketById(id)))
      const actualizados = resultados.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      const confirmados = actualizados.filter((t) => !esPagoPendiente(t.estadoPago))
      if (confirmados.length === 0) return
      setTicketsEmitidos((prev) => prev.map((t) => confirmados.find((c) => c.id === t.id) ?? t))
      for (const t of confirmados) {
        const quien = t.tipoTicket === 'GUIA' ? 'del guía' : 'del visitante'
        if (esPagoPagado(t.estadoPago)) toast.success(`Pago confirmado: ticket ${quien} ${t.numeroTicket}`)
        else toast.error(`El pago del ticket ${quien} ${t.numeroTicket} no se completó`)
      }
      setRefrescarHistorial((n) => n + 1)
    }, 5000)
    return () => clearInterval(intervalo)
  }, [idsPorCobrar])

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
    setLinksPago({})
    setCheckoutModalAbierto(false)
  }, [])

  const panelesCobro = ticketsPorCobrar.map((t) =>
    linksPago[t.id] ? (
      <PanelCheckoutTarjeta
        key={t.id}
        etiqueta={t.tipoTicket === 'GUIA' ? 'Ticket del guía' : 'Ticket del visitante'}
        checkoutUrl={linksPago[t.id]}
        idTicket={t.id}
        numeroTicket={t.numeroTicket}
        montoTotal={t.montoTotal}
        nombreVisitante={t.nombre || undefined}
        atraccion={t.atraccion?.nombre}
      />
    ) : null,
  )

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
                  {/* Panel de Enlace de Pago por cada ticket cobrado con tarjeta */}
                  {panelesCobro}

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
          {/* Se cierra solo cuando ya no queda nada por cobrar. */}
          <Dialog
            open={checkoutModalAbierto && ticketsPorCobrar.length > 0}
            onOpenChange={setCheckoutModalAbierto}
          >
            {/* Compacto: un renglón por link. El detalle completo (correo, etc.)
                sigue en el panel de la columna y en el historial. */}
            <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-md p-4 gap-3 border-2 border-amber-500/50">
              <DialogHeader className="text-left pr-6">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                  {ticketsPorCobrar.length > 1 ? 'Links de pago' : 'Link de pago'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Compártelo con el cliente. El pase se activa al confirmarse el pago.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5">
                {ticketsPorCobrar.map((t) => {
                  const url = linksPago[t.id]
                  return (
                    <div key={t.id} className="rounded-lg border border-border/70 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">
                          {t.tipoTicket === 'GUIA' ? 'Link guía' : 'Link visitante'}
                        </span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          Q{parseFloat(t.montoTotal).toFixed(2)}
                        </span>
                      </div>
                      {url ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            readOnly
                            value={url}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="h-8 font-mono text-[11px]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0 cursor-pointer"
                            title="Copiar link"
                            onClick={() => {
                              navigator.clipboard?.writeText(url)
                              toast.success('Link copiado')
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            asChild
                            className="h-8 w-8 shrink-0 text-[#128C7E] border-[#25D366]/40"
                            title="Enviar por WhatsApp"
                          >
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Enlace de pago del Parque Actún Kan (${t.numeroTicket}): ${url}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            asChild
                            className="h-8 w-8 shrink-0"
                            title="Abrir link"
                          >
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : cargandoCheckout ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Spinner className="h-3.5 w-3.5" /> Generando link…
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (await cargarLinks([t])) toast.success('Link obtenido')
                            else toast.warning('Aún no se ha generado el link en la pasarela')
                          }}
                          className="h-8 w-full gap-1.5 text-xs cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reintentar obtener link
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setCheckoutModalAbierto(false)}
                className="w-full cursor-pointer"
              >
                Cerrar
              </Button>
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
