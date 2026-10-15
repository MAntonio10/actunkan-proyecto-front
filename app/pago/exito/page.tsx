'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { XCircle, Copy, Check, RefreshCw, HelpCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { LogosInstitucionales } from '@/componentes/logos_institucionales'
import { TerminalPago, type ResultadoPago } from '@/componentes/terminal_pago'
import { type RespuestaEstadoCheckout } from '@/tipos'

/**
 * Cada cuánto se vuelve a consultar.
 *
 * El cobro no lo confirma esta página: lo confirma el webhook que la pasarela le
 * manda al servidor, normalmente en segundos. Acá solo se sondea el estado ya
 * escrito, y se sigue sondeando **hasta que haya un desenlace** (pagado, cancelado
 * o anulado): el visitante ve la carga en vez de un "pendiente" que lo hace dudar
 * de si pagó. Pasados los primeros dos minutos el ritmo baja, para no martillar al
 * servidor con una pestaña olvidada abierta.
 */
const INTERVALO_RAPIDO_MS = 3000
const INTENTOS_RAPIDOS = 40
const INTERVALO_LENTO_MS = 10000

/** Hay desenlace: ya no tiene sentido seguir consultando. */
function esFinal(res: RespuestaEstadoCheckout): boolean {
  return res.pagado || res.anulado || res.estadoPago === 'CANCELADO'
}

function ContenidoPagoExito() {
  const searchParams = useSearchParams()
  const checkoutId =
    searchParams.get('checkout_id') ||
    searchParams.get('checkoutId') ||
    searchParams.get('idCheckout') ||
    searchParams.get('id_checkout') ||
    searchParams.get('id')

  const [resultado, setResultado] = useState<RespuestaEstadoCheckout | null>(null)
  const [errorFatal, setErrorFatal] = useState<string | null>(null)
  const [demorado, setDemorado] = useState<boolean>(false)
  const [copiado, setCopiado] = useState<boolean>(false)

  /** Devuelve `true` cuando ya no hay que seguir consultando. */
  const consultar = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.pagos.estadoDeCheckout(id)
      setResultado(res)
      return esFinal(res)
    } catch (err: unknown) {
      // Un 4xx (checkout inexistente, id mal formado) no se arregla reintentando. El
      // 429 sí: es el límite de peticiones y basta con esperar.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        setErrorFatal(err.message || 'No se pudo consultar el estado del pago')
        return true
      }
      // Red caída o error del servidor: transitorio, se sigue esperando en silencio.
      return false
    }
  }, [])

  useEffect(() => {
    if (!checkoutId) {
      setErrorFatal('No se proporcionó un identificador de cobro (checkout_id).')
      return
    }

    let vivo = true
    let terminado = false
    let enCurso = false
    let intentos = 0
    let temporizador: ReturnType<typeof setTimeout> | undefined

    const ciclo = async () => {
      if (!vivo || terminado || enCurso) return
      if (temporizador) clearTimeout(temporizador)

      enCurso = true
      terminado = await consultar(checkoutId)
      enCurso = false
      if (!vivo || terminado) return

      intentos += 1
      if (intentos === INTENTOS_RAPIDOS) setDemorado(true)
      temporizador = setTimeout(
        ciclo,
        intentos < INTENTOS_RAPIDOS ? INTERVALO_RAPIDO_MS : INTERVALO_LENTO_MS,
      )
    }

    // El navegador del celular congela los temporizadores con la pestaña en segundo
    // plano. Al volver a ella se consulta en el acto en vez de esperar el siguiente.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void ciclo()
    }

    document.addEventListener('visibilitychange', alVolver)
    void ciclo()

    // Corta el sondeo al salir de la página: sin esto, seguiría consultando contra un
    // componente ya desmontado.
    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
      document.removeEventListener('visibilitychange', alVolver)
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

  // Estado: no se pudo consultar (sin parámetro, o el checkout no existe)
  if (errorFatal) {
    return (
      <Card className="w-full max-w-lg bg-card border-destructive/30 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2 ring-8 ring-destructive/5">
            <XCircle className="h-9 w-9" />
          </div>
          <CardTitle className="text-xl text-foreground font-bold">
            No pudimos consultar el pago
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">{errorFatal}</CardDescription>
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
              onClick={() => window.location.reload()}
              className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-md"
            >
              <RefreshCw className="h-4 w-4" />
              Consultar de nuevo
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Sin selector: el resultado es el estado real del cobro. La terminal se queda
  // en «Verificando…» hasta que haya desenlace.
  const estado: ResultadoPago = resultado?.pagado
    ? 'aprobado'
    : resultado && esFinal(resultado)
      ? 'rechazado'
      : 'pendiente'

  return (
    <Card className="w-full max-w-md bg-card border-border/60 shadow-2xl overflow-hidden animate-in fade-in duration-300">
      <CardContent className="p-5 sm:p-6">
        <TerminalPago
          resultado={estado}
          exito={{
            titulo: 'Pago completado exitosamente',
            subtitulo: 'El cobro fue aprobado. Tu pase de acceso está activo para el ingreso.',
          }}
          fallo={
            resultado?.anulado
              ? {
                  titulo: 'Este pase fue anulado',
                  subtitulo: 'Aunque el cobro figure registrado, el pase ya no es válido. Consulta en taquilla.',
                }
              : {
                  titulo: 'Pago no completado',
                  subtitulo:
                    'La tarjeta fue rechazada y no se te cobró nada. Prueba con otra tarjeta en el mismo link de pago.',
                }
          }
          subtituloEspera={
            demorado
              ? 'La confirmación del banco está tardando más de lo normal. No cierres esta ventana: se actualizará sola en cuanto llegue.'
              : undefined
          }
          onTerminar={terminar}
        >
          {resultado?.folio && (
            <div className="w-full rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center justify-between gap-3">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  No. de Ticket
                </span>
                <span className="font-mono text-base font-bold text-foreground">{resultado.folio}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copiarAlPortapapeles(resultado.folio, 'Número de ticket')}
                className="gap-1.5 h-9 text-xs font-semibold cursor-pointer"
              >
                {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          )}
        </TerminalPago>
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
            <Card className="w-full max-w-md bg-card p-8 flex flex-col items-center justify-center gap-3">
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
