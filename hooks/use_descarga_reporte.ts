'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import type { ArchivoDescargado } from '@/lib/api'
import { mensajeDeError } from '@/lib/formato_reporte'

/**
 * Descarga de un reporte, en PDF o en Excel.
 *
 * Va por la capa de API y no por `window.open` ni un `<a href>`: las rutas
 * exigen `Authorization: Bearer` y una navegación del navegador no manda esa
 * cabecera, así que ambos atajos devuelven 401 (REPORTES_FRONTEND.md §8).
 *
 * Los dos formatos se tratan distinto porque el servidor los sirve distinto: el
 * PDF viaja `inline` y se abre en una pestaña, el xlsx viaja `attachment` y hay
 * que guardarlo — ningún navegador lo dibuja, y abrirlo en una pestaña solo
 * consigue mostrar binario.
 */
export function useDescargaReporte() {
  const [descargando, setDescargando] = useState<'pdf' | 'excel' | null>(null)

  const descargar = useCallback(
    async (
      formato: 'pdf' | 'excel',
      obtener: () => Promise<ArchivoDescargado>,
      nombreRespaldo: string,
    ) => {
      if (descargando !== null) return
      setDescargando(formato)

      // La pestaña del PDF se abre dentro del gesto del clic: después del
      // `await` el navegador la trata como emergente y la bloquea.
      const ventana = formato === 'pdf' ? window.open('', '_blank') : null

      try {
        const { blob, nombreArchivo } = await obtener()
        const url = URL.createObjectURL(blob)
        // Entre dominios `Content-Disposition` puede no llegar: por eso siempre
        // hay un nombre de respaldo.
        const nombre = nombreArchivo ?? nombreRespaldo

        if (formato === 'pdf' && ventana) {
          ventana.location.href = url
        } else {
          const enlace = document.createElement('a')
          enlace.href = url
          enlace.download = nombre
          // Firefox ignora el clic sobre un enlace que no está en el documento.
          document.body.appendChild(enlace)
          enlace.click()
          document.body.removeChild(enlace)
          if (formato === 'pdf') {
            toast.info('El navegador bloqueó la pestaña', {
              description: 'El PDF se descargó en su lugar.',
            })
          }
        }

        // Sin esto la pestaña acumula blobs; se espera a que el visor cargue.
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch (error: unknown) {
        ventana?.close()
        toast.error('No se pudo descargar el reporte', {
          description: mensajeDeError(error, 'Intente de nuevo en un momento.'),
        })
      } finally {
        setDescargando(null)
      }
    },
    [descargando],
  )

  return { descargar, descargando }
}
