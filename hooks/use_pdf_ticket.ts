'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { type TicketBackend } from '@/tipos'

/**
 * Abre el PDF del pase (GET /tickets/:id/pdf) en una pestaña nueva.
 *
 * No se navega a la URL directamente porque el endpoint exige
 * `Authorization: Bearer` y una navegación del navegador no envía esa cabecera:
 * se descarga como blob a través de la capa de API y se abre el object URL.
 */
export function usePdfTicket() {
  const [pdfEnCursoId, setPdfEnCursoId] = useState<number | null>(null)

  const abrirPdf = useCallback(
    async (ticket: Pick<TicketBackend, 'id' | 'numeroTicket'>) => {
      if (pdfEnCursoId !== null) return
      setPdfEnCursoId(ticket.id)

      // La pestaña se abre de forma síncrona con el clic: hacerlo después del
      // await la bloquearía el navegador por tratarse de un popup sin gesto.
      const ventana = window.open('', '_blank')

      try {
        const blob = await api.tickets.getPdf(ticket.id)
        const url = URL.createObjectURL(blob)

        if (ventana) {
          ventana.location.href = url
        } else {
          // Popup bloqueado: se descarga para no dejar al usuario sin el pase
          const enlace = document.createElement('a')
          enlace.href = url
          enlace.download = `${ticket.numeroTicket}.pdf`
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
