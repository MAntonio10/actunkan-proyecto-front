'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Botón de regresar para las pantallas que se entran y se salen.
 *
 * Dos decisiones que no son cosméticas:
 *
 * - **No es `router.back()` a secas.** Estas pantallas se pueden abrir sin
 *   historial: `/validar-ticket` está precacheada y el personal de la entrada
 *   abre la PWA directo ahí, sin pasar por el menú. Con `history.length <= 1`,
 *   un `back()` no hace nada y el botón queda muerto justo en el aparato donde
 *   más se necesita. Por eso cae a una ruta conocida.
 * - **La ruta alterna por omisión es `/registro-visitantes`** porque es a donde
 *   el login manda a todo el mundo (`app/login/page.tsx`), así que es el "inicio"
 *   de hecho de la aplicación. También está precacheada, así que el botón
 *   funciona sin conexión.
 *
 * El alto es 44 px en móvil (`h-11`) y se aprieta a 36 en escritorio: en la
 * entrada esto se usa de pie y a veces con una sola mano.
 */
export function BotonRegresar({
  rutaAlterna = '/registro-visitantes',
  etiqueta = 'Regresar',
  className,
}: {
  rutaAlterna?: string
  etiqueta?: string
  className?: string
}) {
  const router = useRouter()

  const regresar = () => {
    // `history.length` es 1 cuando la pestaña se abrió directo en esta ruta.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(rutaAlterna)
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={regresar}
      aria-label={etiqueta}
      className={cn('h-11 gap-2 cursor-pointer sm:h-9', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {etiqueta}
    </Button>
  )
}
