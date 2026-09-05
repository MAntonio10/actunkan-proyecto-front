'use client'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { ModuloActividades } from '@/componentes/modulo_actividades'

export default function ActividadesPage() {
  return (
    <RutaProtegida moduloRequerido="ActividadesParque">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="mb-6 titulo-seccion">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Actividades del Parque
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Planificación y difusión interna de actividades
            </p>
          </div>

          <ModuloActividades />
        </main>
      </div>
    </RutaProtegida>
  )
}
