'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function IndicadorConectividad() {
  const [enLinea, setEnLinea] = useState(true)

  useEffect(() => {
    // Verificar estado inicial
    setEnLinea(navigator.onLine)

    const manejarEnLinea = () => setEnLinea(true)
    const manejarSinConexion = () => setEnLinea(false)

    window.addEventListener('online', manejarEnLinea)
    window.addEventListener('offline', manejarSinConexion)

    return () => {
      window.removeEventListener('online', manejarEnLinea)
      window.removeEventListener('offline', manejarSinConexion)
    }
  }, [])

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
        enLinea
          ? 'bg-primary/10 text-primary'
          : 'bg-destructive/10 text-destructive'
      )}
    >
      {enLinea ? (
        <>
          <Wifi className="h-3 w-3" />
          <span className="hidden sm:inline">En linea</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span className="hidden sm:inline">Sin conexion</span>
        </>
      )}
    </div>
  )
}
