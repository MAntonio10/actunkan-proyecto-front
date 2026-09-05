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
export function RegistroServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

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
