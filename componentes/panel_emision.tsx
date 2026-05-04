'use client'

import { useState, useMemo } from 'react'
import { Ticket } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormularioEmisionTicket } from './formulario_emision_ticket'
import { PaseAcceso } from './pase_acceso'
import { TIPOS_ACCESO, PRECIO_APORTE_REFORESTACION, type TipoAcceso } from '@/tipos'

export interface DatosTicket {
  nombre_visitante_grupo: string
  tipo_acceso_id: string
  cantidad: number
  aporte_reforestacion: boolean
}

export function PanelEmision() {
  const [datosTicket, setDatosTicket] = useState<DatosTicket>({
    nombre_visitante_grupo: '',
    tipo_acceso_id: TIPOS_ACCESO[0].id,
    cantidad: 1,
    aporte_reforestacion: false,
  })

  const tipoAccesoSeleccionado = useMemo(() => {
    return TIPOS_ACCESO.find((t) => t.id === datosTicket.tipo_acceso_id) || TIPOS_ACCESO[0]
  }, [datosTicket.tipo_acceso_id])

  const calculos = useMemo(() => {
    const montoBase = tipoAccesoSeleccionado.precio * datosTicket.cantidad
    const montoAporte = datosTicket.aporte_reforestacion
      ? PRECIO_APORTE_REFORESTACION * datosTicket.cantidad
      : 0
    const montoTotal = montoBase + montoAporte

    return { montoBase, montoAporte, montoTotal }
  }, [tipoAccesoSeleccionado, datosTicket.cantidad, datosTicket.aporte_reforestacion])

  const handleActualizarDatos = (nuevosDatos: Partial<DatosTicket>) => {
    setDatosTicket((prev) => ({ ...prev, ...nuevosDatos }))
  }

  const handleEmitirTicket = () => {
    // Aqui se emitiria el ticket
    console.log('Emitiendo ticket:', { datosTicket, calculos })
  }

  return (
    <div className="space-y-6">
      {/* Titulo de la seccion */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Panel De Emision</h1>
        <p className="text-sm text-primary">Punto de Venta Activo</p>
      </div>

      {/* Grid principal: Formulario + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario de emision - 3 columnas en desktop */}
        <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ticket className="h-5 w-5 text-primary" />
              Registro de Nuevo Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioEmisionTicket
              datos={datosTicket}
              tiposAcceso={TIPOS_ACCESO}
              tipoSeleccionado={tipoAccesoSeleccionado}
              calculos={calculos}
              onActualizar={handleActualizarDatos}
              onEmitir={handleEmitirTicket}
            />
          </CardContent>
        </Card>

        {/* Preview del pase - 2 columnas en desktop */}
        <div className="lg:col-span-2">
          <PaseAcceso
            nombreVisitante={datosTicket.nombre_visitante_grupo}
            tipoAcceso={tipoAccesoSeleccionado}
            cantidadPersonas={datosTicket.cantidad}
            montoTotal={calculos.montoTotal}
            fecha={new Date()}
          />
        </div>
      </div>
    </div>
  )
}
