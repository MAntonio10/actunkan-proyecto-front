'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LogosInstitucionales } from '@/componentes/logos_institucionales'
import { TerminalPago } from '@/componentes/terminal_pago'

export default function PaginaPagoCancelado() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
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

      {/* Volver de la pasarela por «cancelar» es un desenlace conocido: la
          terminal lo muestra como no exitoso, sin consultar nada. */}
      <main className="w-full flex justify-center">
        <Card className="w-full max-w-md bg-card border-border/60 shadow-2xl overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-5 sm:p-6">
            <TerminalPago
              resultado="rechazado"
              fallo={{
                titulo: 'Pago cancelado',
                subtitulo:
                  'No se realizó ningún cargo. Tu link de pago sigue activo: puedes abrirlo de nuevo con otra tarjeta o pagar en efectivo en taquilla.',
              }}
              onTerminar={() => window.location.replace('https://www.google.com')}
            />
          </CardContent>
        </Card>
      </main>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Parque Regional Municipal Actún Kan & ProPetén
      </footer>
    </div>
  )
}
