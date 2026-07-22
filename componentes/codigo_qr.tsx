'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface CodigoQRProps {
  valor: string
  size?: number
}

// Componente separado que SOLO carga en cliente, resuelve el mismatch de hidratacion
// porque QRCodeSVG genera paths SVG distintos entre servidor y cliente
export function CodigoQR({ valor, size = 80 }: CodigoQRProps) {
  const [QRCodeSVG, setQRCodeSVG] = useState<React.ComponentType<{
    value: string
    size: number
    level: string
    marginSize: number
  }> | null>(null)

  useEffect(() => {
    // Importar dinamicamente solo en el cliente
    import('qrcode.react').then((mod) => {
      setQRCodeSVG(() => mod.QRCodeSVG as any)
    })
  }, [])

  if (!QRCodeSVG) {
    return <Skeleton className="rounded-none" style={{ width: size, height: size }} />
  }

  return <QRCodeSVG value={valor} size={size} level="M" marginSize={0} />
}
