'use client'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { PaginaEnConstruccion } from '@/componentes/pagina_en_construccion'
import { RutaProtegida } from '@/componentes/ruta_protegida'

export default function FacturacionPage() {
  return (
    <RutaProtegida moduloRequerido="Facturación">
      <div className="min-h-screen flex flex-col bg-background">
        <BarraNavegacionSuperior />
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <PaginaEnConstruccion
            titulo="Facturación"
            descripcion="Gestión de facturas y comprobantes fiscales"
          />
        </main>
      </div>
    </RutaProtegida>
  )
}
