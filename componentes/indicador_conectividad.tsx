'use client'

import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'

/**
 * Píldora de estado de conexión.
 *
 * Lee del contexto, que a su vez usa la conexión *observada*: si las peticiones
 * al backend llegan o no. Antes miraba `navigator.onLine` por su cuenta, que
 * solo informa del estado de la interfaz de red — con el wifi conectado pero
 * sin salida a internet decía "En línea" igual.
 */
export function IndicadorConectividad() {
  const { enLinea } = useAutenticacion()

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
        enLinea ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
      )}
    >
      {enLinea ? (
        <>
          <Wifi className="h-3 w-3" />
          <span className="hidden sm:inline">En línea</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span className="hidden sm:inline">Sin conexión</span>
        </>
      )}
    </div>
  )
}
