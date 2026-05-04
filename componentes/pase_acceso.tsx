'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LogoActunKan } from './logo_actun_kan'
import { type TipoAcceso } from '@/tipos'
import { CodigoQR } from './codigo_qr'

interface PaseAccesoProps {
  nombreVisitante: string
  tipoAcceso: TipoAcceso
  cantidadPersonas: number
  montoTotal: number
  fecha: Date
}

export function PaseAcceso({
  nombreVisitante,
  tipoAcceso,
  cantidadPersonas,
  montoTotal,
  fecha,
}: PaseAccesoProps) {
  const fechaFormateada = useMemo(() => {
    return fecha.toISOString().split('T')[0]
  }, [fecha])

  // Codigo QR con datos fijos (sin Date.now ni random para evitar hidratacion)
  const datosQR = useMemo(() => {
    return JSON.stringify({
      nombre: nombreVisitante || 'VISITANTE',
      tipo: tipoAcceso.nombre,
      personas: cantidadPersonas,
      fecha: fechaFormateada,
      total: montoTotal,
    })
  }, [nombreVisitante, tipoAcceso, cantidadPersonas, fechaFormateada, montoTotal])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Cabecera del pase */}
        <div className="flex flex-col items-center pt-6 pb-4 border-b border-dashed border-border/50">
          <LogoActunKan className="h-12 w-12 text-primary mb-2" />
          <h2 className="text-xl font-bold tracking-tight">ACTUN KAN</h2>
          <span className="text-xs uppercase tracking-wider text-primary font-medium">
            Pase de Acceso
          </span>
        </div>

        {/* Detalles del ticket */}
        <div className="p-6 space-y-4">
          {/* Titular */}
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Titular
            </span>
            <p className="text-lg font-medium mt-0.5">
              {nombreVisitante || '...'}
            </p>
          </div>

          {/* Fila: Fecha + Personas */}
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Fecha
              </span>
              <p className="font-medium mt-0.5">{fechaFormateada}</p>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Personas
              </span>
              <p className="font-medium mt-0.5">{cantidadPersonas} Pax</p>
            </div>
          </div>

          {/* Tipo de acceso */}
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo
            </span>
            <p className="text-primary font-medium mt-0.5">{tipoAcceso.nombre.replace('Entrada ', '')}</p>
          </div>

          {/* Separador punteado estilo ticket */}
          <div className="relative py-2">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-background" />
            <div className="border-t border-dashed border-border/50" />
          </div>

          {/* Total + QR Code */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Total a Pagar
              </span>
              <p className="text-3xl font-bold mt-1">
                ${montoTotal.toFixed(2)}
              </p>
            </div>

            {/* QR Code - componente puramente cliente para evitar hidratacion */}
            <div className="bg-white p-2 rounded-lg w-[96px] h-[96px] flex items-center justify-center">
              <CodigoQR valor={datosQR} size={80} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
