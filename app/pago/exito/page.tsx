'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Ticket,
  Users,
  Mountain,
  CreditCard,
  Sparkles,
  HelpCircle,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { LogosInstitucionales } from '@/componentes/logos_institucionales'
import { type RespuestaConfirmacionPago } from '@/tipos'

function ContenidoPagoExito() {
  const searchParams = useSearchParams()
  const checkoutId =
    searchParams.get('checkout_id') ||
    searchParams.get('checkoutId') ||
    searchParams.get('idCheckout') ||
    searchParams.get('id_checkout') ||
    searchParams.get('id')

  const [cargando, setCargando] = useState<boolean>(true)
  const [reintentando, setReintentando] = useState<boolean>(false)
  const [resultado, setResultado] = useState<RespuestaConfirmacionPago | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)

  const confirmarPago = useCallback(async (id: string, esReintento: boolean = false) => {
    if (esReintento) {
      setReintentando(true)
    } else {
      setCargando(true)
    }
    setError(null)

    try {
      const res = await api.pagos.confirmar(id)
      setResultado(res)
      if (res.pagado) {
        toast.success('¡Pago confirmado con éxito!')
      } else {
        toast.warning('El pago aún se encuentra en proceso')
      }
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo verificar el estado del pago'
      setError(mensaje)
      toast.error('Error al verificar el pago', { description: mensaje })
    } finally {
      setCargando(false)
      setReintentando(false)
    }
  }, [])

  useEffect(() => {
    if (checkoutId) {
      confirmarPago(checkoutId)
    } else {
      setCargando(false)
      setError('No se proporcionó un identificador de cobro (checkout_id).')
    }
  }, [checkoutId, confirmarPago])

  const copiarAlPortapapeles = (texto: string, label: string = 'Texto') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto)
      setCopiado(true)
      toast.success(`${label} copiado al portapapeles`)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  // Estado: Cargando verificación inicial
  if (cargando) {
    return (
      <Card className="w-full max-w-lg bg-card/90 backdrop-blur-md border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-primary/5">
              <Spinner className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Confirmando tu pago
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Estamos consultando la pasarela de pagos para validar tu transacción en tiempo real...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Estado: Error de comunicación o parámetro ausente
  if (error && !resultado) {
    return (
      <Card className="w-full max-w-lg bg-card/90 backdrop-blur-md border-destructive/30 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2 ring-8 ring-destructive/5">
            <XCircle className="h-9 w-9" />
          </div>
          <CardTitle className="text-xl text-foreground font-bold">
            No pudimos validar el pago
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-2 text-left">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
              ¿Qué puedes hacer?
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Si acabas de pagar en la pasarela, espera unos segundos y pulsa reintentar.</li>
              <li>Si cerraste la ventana del banco antes de tiempo, tu link de pago sigue activo.</li>
              <li>Presenta tu comprobante bancario en la taquilla principal del parque si necesitas asistencia.</li>
            </ul>
          </div>

          {checkoutId && (
            <Button
              onClick={() => confirmarPago(checkoutId, true)}
              disabled={reintentando}
              className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-md"
            >
              {reintentando ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              Reintentar comprobación
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Estado: Pago no confirmado (pagado: false)
  if (resultado && !resultado.pagado) {
    return (
      <Card className="w-full max-w-lg bg-card/90 backdrop-blur-md border-amber-500/30 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2 ring-8 ring-amber-500/5">
            <AlertTriangle className="h-9 w-9" />
          </div>
          <CardTitle className="text-xl text-foreground font-bold">
            Aún no confirmamos tu pago
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {resultado.mensaje || 'La pasarela de pagos no ha marcado este cobro como completado todavía.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-xs text-amber-800 dark:text-amber-300 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <span>⏳ Transacción en proceso</span>
            </p>
            <p className="leading-relaxed">
              Si acabas de ingresar los datos de tu tarjeta o autorizar con tu banco, el proceso puede demorar hasta 30 segundos en reflejarse. Presiona el botón de abajo para verificar nuevamente.
            </p>
          </div>

          {resultado.ticket?.numeroTicket && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Folio Reservado
              </span>
              <span className="font-mono text-sm font-bold text-foreground">
                {resultado.ticket.numeroTicket}
              </span>
            </div>
          )}

          {checkoutId && (
            <Button
              onClick={() => confirmarPago(checkoutId, true)}
              disabled={reintentando}
              className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-md bg-amber-600 hover:bg-amber-700 text-white"
            >
              {reintentando ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reintentar verificación ahora
            </Button>
          )}

          <p className="text-[11px] text-center text-muted-foreground">
            Recuerda que tu ticket no permite el ingreso hasta que el pago figure como <strong>PAGADO</strong>.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Estado: Pago Confirmado Exitosamente (pagado: true)
  const ticket = resultado?.ticket
  const atraccionNombre =
    typeof ticket?.atraccion === 'object'
      ? ticket.atraccion?.nombre
      : ticket?.atraccion || 'Parque Actún Kan'
  const titularNombre = ticket?.nombre || 'Visitante'
  const cantidadPax = ticket?.personas || ticket?.cantidadPersonas || 1
  const montoFormateado = resultado?.monto
    ? parseFloat(String(resultado.monto)).toFixed(2)
    : ticket?.monto
      ? parseFloat(String(ticket.monto)).toFixed(2)
      : null

  return (
    <Card className="w-full max-w-lg bg-card/90 backdrop-blur-md border-emerald-500/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      {/* Barra de estado superior */}
      <div className="bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Pago Verificado · Ticket Activado</span>
      </div>

      <CardHeader className="text-center pb-3 pt-6">
        <div className="h-20 w-20 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 ring-8 ring-emerald-500/10 animate-bounce duration-1000">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <CardTitle className="text-2xl text-foreground font-black tracking-tight">
          ¡Pago realizado con éxito!
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm font-medium">
          Tu transacción fue completada y tu pase de acceso está activo para el ingreso.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 pt-2 space-y-5">
        {/* Tarjeta de Folio y Ticket */}
        {ticket?.numeroTicket && (
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.06] p-4 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                No. de Ticket
              </span>
              <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                {ticket.numeroTicket}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copiarAlPortapapeles(ticket.numeroTicket, 'Número de ticket')}
              className="gap-1.5 h-9 text-xs font-semibold border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer text-emerald-700 dark:text-emerald-300"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        )}

        {/* Resumen del Pase */}
        <div className="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/50 text-sm overflow-hidden">
          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Mountain className="h-4 w-4 text-primary" />
              Atracción
            </span>
            <span className="font-bold text-foreground text-right">{atraccionNombre}</span>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Titular / Grupo
            </span>
            <span className="font-semibold text-foreground text-right">{titularNombre}</span>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-primary" />
              Cantidad de Personas
            </span>
            <Badge variant="outline" className="font-bold text-xs bg-background/80">
              {cantidadPax} {cantidadPax === 1 ? 'Persona' : 'Personas'}
            </Badge>
          </div>

          {montoFormateado && (
            <div className="flex items-center justify-between p-3.5 bg-muted/40">
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Monto Pagado
              </span>
              <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                Q{montoFormateado}
              </span>
            </div>
          )}
        </div>

        {/* Indicación de acceso */}
        <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Muestra este número de ticket o el pase digital al ingresar al parque en la garita de control de acceso.
          </p>
        </div>

        {/* Botón de cierre con redirección sin retorno a Google */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={() => {
              window.location.replace('https://www.google.com')
            }}
            className="w-full h-11 font-semibold gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-md text-sm"
          >
            <X className="h-4 w-4" />
            Cerrar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PaginaPagoExito() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Fondo ambiental sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 10%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%),
            radial-gradient(ellipse 50% 50% at 85% 90%, color-mix(in oklch, var(--emerald-500, #10b981) 12%, transparent), transparent 70%)
          `,
        }}
      />

      {/* Cabecera institucional */}
      <header className="mb-6 flex flex-col items-center text-center">
        <LogosInstitucionales tamano="md" prioridad className="mb-3" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Parque Regional Municipal Actún Kan
        </h1>
        <p className="text-xs text-muted-foreground">
          Santa Elena, Flores, Petén · Pasarela de Cobro Digital
        </p>
      </header>

      {/* Contenedor reactivo envuelto en Suspense por useSearchParams */}
      <main className="w-full flex justify-center">
        <Suspense
          fallback={
            <Card className="w-full max-w-lg bg-card/80 p-8 flex flex-col items-center justify-center gap-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando pasarela...</p>
            </Card>
          }
        >
          <ContenidoPagoExito />
        </Suspense>
      </main>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Parque Regional Municipal Actún Kan & ProPetén
      </footer>
    </div>
  )
}
