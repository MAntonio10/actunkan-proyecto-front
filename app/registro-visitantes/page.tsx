'use client'

import { useState, useCallback } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import {
  FormularioVisitanteCompleto,
  type DatosTicketPreview,
} from '@/componentes/formulario_visitante_completo'
import { PaseAcceso } from '@/componentes/pase_acceso'
import { TIPOS_ACCESO } from '@/tipos'

const DATOS_INICIALES: DatosTicketPreview = {
  nombreVisitante: '',
  tipoAcceso: TIPOS_ACCESO[0],
  cantidadPersonas: 1,
  montoTotal: 0,
}

export default function RegistroVisitantesPage() {
  const [datosPreview, setDatosPreview] = useState<DatosTicketPreview>(DATOS_INICIALES)

  const handleDatosChange = useCallback((datos: DatosTicketPreview) => {
    setDatosPreview(datos)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Fondo con textura sutil */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322c55e' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <BarraNavegacionSuperior />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Panel De Emision</h1>
          <p className="text-sm text-primary">Punto de Venta Activo</p>
        </div>

        {/* Grid principal: Formulario + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Formulario - 3 columnas en desktop */}
          <div className="lg:col-span-3">
            <FormularioVisitanteCompleto onDatosChange={handleDatosChange} />
          </div>

          {/* Preview del pase - 2 columnas en desktop */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <PaseAcceso
                nombreVisitante={datosPreview.nombreVisitante}
                tipoAcceso={datosPreview.tipoAcceso}
                cantidadPersonas={datosPreview.cantidadPersonas}
                montoTotal={datosPreview.montoTotal}
                fecha={new Date()}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
