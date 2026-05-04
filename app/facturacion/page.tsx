import { ProveedorAutenticacion } from '@/contexto/contexto_autenticacion'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { PaginaEnConstruccion } from '@/componentes/pagina_en_construccion'

export default function FacturacionPage() {
  return (
    <ProveedorAutenticacion>
      <div className="min-h-screen flex flex-col bg-background">
        <BarraNavegacionSuperior />
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <PaginaEnConstruccion
            titulo="Facturacion"
            descripcion="Gestion de facturas y comprobantes fiscales"
          />
        </main>
      </div>
    </ProveedorAutenticacion>
  )
}
