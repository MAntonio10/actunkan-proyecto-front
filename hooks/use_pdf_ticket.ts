'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { type TicketBackend } from '@/tipos'

interface DocumentoPdf {
  id: number
  /** Folio, usado como nombre de archivo si hay que descargar. */
  folio: string
  obtener: (id: number) => Promise<Blob>
}

/**
 * Abre en una pestaña nueva el PDF de un documento (pase de acceso o recibo de
 * donación).
 *
 * No se navega a la URL directamente porque el endpoint exige
 * `Authorization: Bearer` y una navegación del navegador no envía esa cabecera:
 * se descarga como blob a través de la capa de API y se abre el object URL.
 */
export function usePdfDocumento() {
  const [pdfEnCursoId, setPdfEnCursoId] = useState<number | null>(null)

  const abrirPdf = useCallback(
    async ({ id, folio, obtener }: DocumentoPdf) => {
      if (pdfEnCursoId !== null) return
      setPdfEnCursoId(id)

      // La pestaña se abre de forma síncrona con el clic: hacerlo después del
      // await la bloquearía el navegador por tratarse de un popup sin gesto.
      const ventana = window.open('', '_blank')

      try {
        const blob = await obtener(id)
        const url = URL.createObjectURL(blob)

        if (ventana) {
          ventana.location.href = url
        } else {
          // Popup bloqueado: se descarga para no dejar al usuario sin el documento
          const enlace = document.createElement('a')
          enlace.href = url
          enlace.download = `${folio}.pdf`
          enlace.click()
          toast.info('El navegador bloqueó la pestaña', {
            description: 'El PDF se descargó en su lugar.',
          })
        }

        // Se libera pasado un margen para que el visor alcance a cargarlo
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } catch (err: unknown) {
        ventana?.close()
        const mensaje = err instanceof Error ? err.message : 'No se pudo generar el PDF'
        toast.error('Error al abrir el PDF', { description: mensaje })
      } finally {
        setPdfEnCursoId(null)
      }
    },
    [pdfEnCursoId],
  )

  return { abrirPdf, pdfEnCursoId }
}

/** Envoltorio para pases de acceso, que conserva la firma anterior. */
export function usePdfTicket() {
  const { abrirPdf, pdfEnCursoId } = usePdfDocumento()

  const abrirPdfTicket = useCallback(
    (ticket: Pick<TicketBackend, 'id' | 'numeroTicket'>) =>
      abrirPdf({
        id: ticket.id,
        folio: ticket.numeroTicket,
        obtener: api.tickets.getPdf,
      }),
    [abrirPdf],
  )

  return { abrirPdf: abrirPdfTicket, pdfEnCursoId }
}
