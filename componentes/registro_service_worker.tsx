'use client'

import { useEffect } from 'react'

/**
 * Registra el Service Worker que permite abrir la aplicación sin señal.
 *
 * Solo en producción: en desarrollo el worker se queda con los archivos
 * cacheados y pisa el recargado en caliente, lo que hace parecer que los
 * cambios no se aplican.
 *
 * Requiere contexto seguro (https o localhost). Sobre http en la red local el
 * navegador no registra workers, igual que no expone `crypto.subtle`.
 */

/** Evita el bucle de recargas si algo saliera mal al limpiar. */
const CLAVE_RECARGA = 'sw_limpiado_dev'

/**
 * Da de baja el worker cuando la aplicación corre en desarrollo.
 *
 * No basta con "no registrarlo". Probar una compilación de producción en
 * `localhost:3000` deja el worker instalado **en ese origen**, y `npm run dev`
 * usa el mismo: a partir de ahí el worker sigue mandando sobre el servidor de
 * desarrollo. Como sirve `/_next/static/` desde caché y sin revalidar —correcto
 * con `next build`, donde el nombre del archivo lleva hash— el navegador acaba
 * mezclando una pantalla recién compilada con módulos viejos, y falla con cosas
 * como «no se puede leer 'catalogo' de undefined» aunque el código en disco
 * esté bien.
 *
 * Por eso acá se da de baja, se borran sus cachés y se recarga una vez: es la
 * única forma de recuperar la sesión que ya cargó con archivos viejos.
 */
async function darDeBajaEnDesarrollo(): Promise<void> {
  try {
    const registros = await navigator.serviceWorker.getRegistrations()
    if (registros.length === 0) return

    await Promise.all(registros.map((registro) => registro.unregister()))

    if (typeof caches !== 'undefined') {
      const nombres = await caches.keys()
      await Promise.all(nombres.map((nombre) => caches.delete(nombre)))
    }

    console.info(
      'Service Worker dado de baja: en desarrollo serviría archivos viejos. Recargando…',
    )

    if (!sessionStorage.getItem(CLAVE_RECARGA)) {
      sessionStorage.setItem(CLAVE_RECARGA, '1')
      window.location.reload()
    }
  } catch (error) {
    console.warn('No se pudo dar de baja el Service Worker de desarrollo:', error)
  }
}

export function RegistroServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void darDeBajaEnDesarrollo()
      return
    }

    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('No se pudo registrar el Service Worker:', error)
      })
    }

    // Después de `load`: registrarlo durante la carga inicial le compite ancho
    // de banda justo a los recursos que la pantalla necesita para dibujarse.
    if (document.readyState === 'complete') {
      registrar()
    } else {
      window.addEventListener('load', registrar)
      return () => window.removeEventListener('load', registrar)
    }
  }, [])

  return null
}
