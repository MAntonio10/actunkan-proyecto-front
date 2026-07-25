'use client'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { ModuloDonaciones } from '@/componentes/modulo_donaciones'
import { RutaProtegida } from '@/componentes/ruta_protegida'

export default function DonacionesPage() {
  return (
    <RutaProtegida moduloRequerido="Donaciones">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          {/* Encabezado del Módulo */}
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="titulo-seccion">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Módulo de Donaciones
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gestión de donativos voluntarios y emisión de recibos oficiales
              </p>
            </div>
            <span className="chip-acento">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Recepción de Donaciones Activa
            </span>
          </div>

          {/* Componente del Módulo de Donaciones */}
          <ModuloDonaciones />
        </main>
      </div>
    </RutaProtegida>
  )
}
