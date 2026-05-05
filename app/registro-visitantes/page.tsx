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
    <div className="min-h-screen flex flex-col">
      <BarraNavegacionSuperior />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* Encabezado con barra de acento */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="titulo-seccion">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Panel de Emision
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Registro y venta de tickets para visitantes
            </p>
          </div>
          <span className="chip-acento">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Punto de Venta Activo
          </span>
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
