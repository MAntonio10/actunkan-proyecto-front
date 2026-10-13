'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Ticket,
  CreditCard,
  Sparkles,
  HelpCircle,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { LogosInstitucionales } from '@/componentes/logos_institucionales'
import { type RespuestaEstadoCheckout } from '@/tipos'

/**
 * Cada cuánto se vuelve a consultar, y cuántas veces.
 *
 * El cobro ya no lo confirma esta página: lo confirma el webhook que la pasarela le
 * manda al servidor, normalmente en segundos. Así que acá solo se sondea el estado
 * ya escrito hasta verlo cambiar. Dos minutos cubren de sobra una entrega normal; si
 * se agotan, lo probable es que el webhook no haya llegado, y para eso está el botón
 * de consultar a mano en vez de seguir girando para siempre.
 */
const INTERVALO_MS = 3000
const INTENTOS_MAXIMOS = 40

function ContenidoPagoExito() {
  const searchParams = useSearchParams()
  const checkoutId =
    searchParams.get('checkout_id') ||
    searchParams.get('checkoutId') ||
    searchParams.get('idCheckout') ||
    searchParams.get('id_checkout') ||
    searchParams.get('id')

  const [cargando, setCargando] = useState<boolean>(true)
  const [consultando, setConsultando] = useState<boolean>(false)
  const [resultado, setResultado] = useState<RespuestaEstadoCheckout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<boolean>(false)
  const [sondeoAgotado, setSondeoAgotado] = useState<boolean>(false)

  // En una ref y no en el estado: el temporizador lo lee dentro del intervalo y no
  // debe reiniciarlo al cambiar.
  const intentos = useRef<number>(0)

  const consultar = useCallback(
    async (id: string, manual: boolean = false): Promise<boolean> => {
      if (manual) {
        setConsultando(true)
        setSondeoAgotado(false)
        intentos.current = 0
      }
      setError(null)

      try {
        const res = await api.pagos.estadoDeCheckout(id)
        setResultado(res)
        if (res.pagado) toast.success('Pago realizado exitosamente')
        return res.pagado
      } catch (err: unknown) {
        const mensaje =
          err instanceof Error ? err.message : 'No se pudo consultar el estado del pago'
        setError(mensaje)
        return false
      } finally {
        setCargando(false)
        setConsultando(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!checkoutId) {
      setCargando(false)
      setError('No se proporcionó un identificador de cobro (checkout_id).')
      return
    }

    let vivo = true
    let temporizador: ReturnType<typeof setTimeout> | undefined

    const ciclo = async () => {
      const pagado = await consultar(checkoutId)
      if (!vivo || pagado) return

      intentos.current += 1
      if (intentos.current >= INTENTOS_MAXIMOS) {
        setSondeoAgotado(true)
        return
      }
      temporizador = setTimeout(ciclo, INTERVALO_MS)
    }

    void ciclo()

    // Corta el sondeo al salir de la página: sin esto, seguiría consultando contra un
    // componente ya desmontado.
    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
    }
  }, [checkoutId, consultar])

  const copiarAlPortapapeles = (texto: string, label: string = 'Texto') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(texto)
      setCopiado(true)
      toast.success(`${label} copiado al portapapeles`)
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  const terminar = () => {
    window.location.replace('https://www.google.com')
  }

  // Estado: primera consulta en curso
  if (cargando) {
    return (
      <Card className="w-full max-w-lg bg-card border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-primary/5">
            <Spinner className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Confirmando tu pago
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Estamos esperando la confirmación del banco. Normalmente tarda unos segundos.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Estado: no se pudo consultar (sin parámetro, o el checkout no existe)
  if (error && !resultado) {
    return (
      <Card className="w-full max-w-lg bg-card border-destructive/30 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2 ring-8 ring-destructive/5">
            <XCircle className="h-9 w-9" />
          </div>
          <CardTitle className="text-xl text-foreground font-bold">
            No pudimos consultar el pago
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">{error}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-2 text-left">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
              ¿Qué puedes hacer?
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Si acabas de pagar, espera unos segundos y vuelve a consultar.</li>
              <li>Si cerraste la ventana del banco antes de tiempo, tu link de pago sigue activo.</li>
              <li>
                Presenta tu comprobante bancario en la taquilla principal del parque si necesitas
                asistencia.
              </li>
            </ul>
          </div>

          {checkoutId && (
            <Button
              onClick={() => void consultar(checkoutId, true)}
              disabled={consultando}
              className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-md"
            >
              {consultando ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              Consultar de nuevo
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Estado: el cobro aún no está confirmado, o quedó cancelado
  if (resultado && !resultado.pagado) {
    const cancelado = resultado.estadoPago === 'CANCELADO'
    const anulado = resultado.anulado

    return (
      <Card className="w-full max-w-lg bg-card border-amber-500/30 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2 ring-8 ring-amber-500/5">
            <AlertTriangle className="h-9 w-9" />
          </div>
          <CardTitle className="text-xl text-foreground font-bold">
            {anulado
              ? 'Este pase fue anulado'
              : cancelado
                ? 'El cobro no se completó'
                : 'Aún no confirmamos tu pago'}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            {anulado
              ? 'Aunque el cobro figure registrado, el pase ya no es válido. Consulta en taquilla.'
              : cancelado
                ? 'El banco no autorizó la transacción. No se te cobró nada.'
                : 'El banco todavía no nos ha confirmado la transacción.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {!cancelado && !anulado && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <p className="font-semibold text-sm">⏳ Transacción en proceso</p>
              <p className="leading-relaxed">
                {sondeoAgotado
                  ? 'La confirmación está tardando más de lo normal. Vuelve a consultar, y si sigue igual presenta tu comprobante en taquilla.'
                  : 'Esta pantalla se actualiza sola en cuanto el banco confirme. No cierres la ventana.'}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              No. de Ticket
            </span>
            <span className="font-mono text-sm font-bold text-foreground">{resultado.folio}</span>
          </div>

          {checkoutId && !cancelado && !anulado && (
            <Button
              onClick={() => void consultar(checkoutId, true)}
              disabled={consultando}
              className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-md bg-amber-600 hover:bg-amber-700 text-white"
            >
              {consultando ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              Consultar de nuevo
            </Button>
          )}

          <Button
            variant="outline"
            onClick={terminar}
            className="w-full h-11 font-semibold gap-2 cursor-pointer text-sm"
          >
            <X className="h-4 w-4" />
            Terminar
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            Tu ticket no permite el ingreso hasta que el pago figure como <strong>PAGADO</strong>.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Estado: pago confirmado
  const montoFormateado = resultado?.monto
    ? parseFloat(String(resultado.monto)).toFixed(2)
    : null

  return (
    <Card className="w-full max-w-lg bg-card border-emerald-500/40 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Pago Verificado · Ticket Activado</span>
      </div>

      <CardHeader className="text-center pb-3 pt-6">
        <div className="h-20 w-20 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 ring-8 ring-emerald-500/10">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <CardTitle className="text-2xl text-foreground font-black tracking-tight">
          Pago realizado exitosamente
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm font-medium">
          Tu pase de acceso está activo para el ingreso.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 pt-2 space-y-5">
        {/* Folio del pase */}
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.06] p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              No. de Ticket
            </span>
            <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
              {resultado?.folio}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copiarAlPortapapeles(resultado?.folio ?? '', 'Número de ticket')}
            className="gap-1.5 h-9 text-xs font-semibold border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer text-emerald-700 dark:text-emerald-300"
          >
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>

        {/* Resumen del cobro. Solo lo del propio pago: el nombre del grupo, la
            atracción y cuántas personas son no viajan en este endpoint, que es
            público y no debe exponer datos de una persona a quien tenga el id. */}
        <div className="rounded-2xl border border-border/70 bg-muted/20 divide-y divide-border/50 text-sm overflow-hidden">
          <div className="flex items-center justify-between p-3.5">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-primary" />
              Estado
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Pagado</span>
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

        <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Muestra este número de ticket o el pase digital al ingresar al parque en la garita de
            control de acceso.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Button
            onClick={terminar}
            className="w-full h-11 font-semibold gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-md text-sm"
          >
            <X className="h-4 w-4" />
            Terminar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PaginaPagoExito() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
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

      <header className="mb-6 flex flex-col items-center text-center">
        <LogosInstitucionales tamano="md" prioridad className="mb-3" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Parque Regional Municipal Actún Kan
        </h1>
        <p className="text-xs text-muted-foreground">
          Santa Elena, Flores, Petén · Pasarela de Cobro Digital
        </p>
      </header>

      <main className="w-full flex justify-center">
        <Suspense
          fallback={
            <Card className="w-full max-w-lg bg-card p-8 flex flex-col items-center justify-center gap-3">
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
