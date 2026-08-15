'use client'

import {
  XCircle,
  CreditCard,
  Banknote,
  Clock,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogosInstitucionales } from '@/componentes/logos_institucionales'

export default function PaginaPagoCancelado() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Fondo ambiental sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 50% 10%, color-mix(in oklch, var(--muted-foreground) 15%, transparent), transparent 70%),
            radial-gradient(ellipse 50% 50% at 85% 90%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 70%)
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

      {/* Tarjeta de Cancelación */}
      <main className="w-full flex justify-center">
        <Card className="w-full max-w-lg bg-card/90 backdrop-blur-md border-border/70 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center pb-2 pt-6">
            <div className="h-20 w-20 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-2 ring-8 ring-muted/40">
              <XCircle className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground font-bold tracking-tight">
              Forma de pago cancelada
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm font-medium">
              No se ha realizado ningún cargo a tu método de pago.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {/* Mensaje principal */}
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-xs text-muted-foreground space-y-3 leading-relaxed">
              <div className="flex items-start gap-2.5 text-foreground font-semibold text-sm">
                <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>¿Deseas pagar más tarde?</span>
              </div>
              <p>
                Tu enlace de pago sigue siendo válido. Si deseas completar la compra más adelante, puedes volver a abrir el enlace que recibiste por WhatsApp, correo o mensaje y procesar tu tarjeta con tranquilidad.
              </p>
            </div>

            {/* Opciones disponibles */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Opciones alternativas de pago
              </span>

              <div className="rounded-xl border border-border/60 p-3 flex items-center gap-3 bg-card/60">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-foreground">Pago en efectivo en taquilla</p>
                  <p className="text-muted-foreground">Puedes abonar directamente al ingresar al parque en Quetzales.</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3 flex items-center gap-3 bg-card/60">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-foreground">Reintentar con otra tarjeta</p>
                  <p className="text-muted-foreground">Abre el enlace original e ingresa una tarjeta de crédito o débito diferente.</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <span>Para cualquier duda, nuestro personal en taquilla estará listo para asistirte.</span>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                onClick={() => {
                  window.location.replace('https://www.google.com')
                }}
                variant="outline"
                className="w-full h-11 font-semibold gap-2 cursor-pointer border-border/80 text-sm"
              >
                <X className="h-4 w-4" />
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Parque Regional Municipal Actún Kan & ProPetén
      </footer>
    </div>
  )
}
