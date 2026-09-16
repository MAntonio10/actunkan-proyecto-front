'use client'

import { useState } from 'react'
import { BorderBeam } from 'border-beam'
import { BrainCircuit, Lightbulb } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ResultadoReporteVista } from '@/componentes/resultado_reporte'
import { useDescargaReporte } from '@/hooks/use_descarga_reporte'
import { api } from '@/lib/api'
import { mensajeDeError } from '@/lib/formato_reporte'
import type { RespuestaInterpretacionReporte } from '@/tipos'

/**
 * Vía a medida: se escribe lo que se necesita y el servidor elige el reporte.
 *
 * Es la única ruta del módulo que llama a la IA, y solo para traducir la frase
 * a una de las definiciones del catálogo: las cifras las produce después el
 * mismo código de siempre. De ahí las tres reglas de esta pantalla:
 *
 *  - Se dispara con un gesto explícito (botón o Enter), nunca al teclear: la
 *    cuota del proveedor es el recurso escaso (15 peticiones por minuto y un
 *    tope diario). Los ejemplos llenan la caja, no la envían.
 *  - Se muestra `interpretacion` para que el usuario confirme que se le
 *    entendió antes de fiarse de las cifras.
 *  - Las descargas van contra `urlDescarga`, que ya es una URL del catálogo con
 *    los ids resueltos: bajar el archivo —y cambiar de PDF a Excel— no vuelve a
 *    gastar cuota.
 *
 * Mientras se espera no se pinta ninguna tarjeta de progreso: el único aviso
 * es el orbe del botón, y la respuesta entra desenfocada y se va aclarando
 * (`aparicion-suave`, en `app/globals.css`). Si ya había una respuesta, se
 * queda a la vista hasta que llega la nueva, para que la pantalla no se vacíe
 * y vuelva a llenarse.
 *
 * `BorderBeam` y `ThinkingOrb` van con `theme` fijo porque la aplicación nunca
 * aplica `.dark`: en `auto` seguirían al sistema operativo y en un equipo con
 * tema oscuro pintarían puntos claros sobre la tarjeta clara.
 */

const MINIMO = 5
const MAXIMO = 500

/**
 * Peticiones de ejemplo. Son a propósito de las que el catálogo **no** tiene
 * como botón —un cruce, un ranking acotado, un corte por hora o por día de la
 * semana—: las que se resuelven con un reporte de la lista no enseñan para qué
 * sirve escribir. Todas caen en `ventas-a-medida` con sus filtros, así que la
 * IA solo tiene que traducirlas; las cifras salen del mismo código de siempre.
 */
const EJEMPLOS = [
  '¿Qué guía trabajó más los sábados este año?',
  'Las 3 horas de más venta en el mariposario',
  'Ventas por atracción cruzadas por país este año',
  'Tickets de agosto y septiembre, mes por mes',
  'Los 5 vendedores que más recaudaron en recorrido largo',
]

/** Cambia el formato de una URL de descarga sin volver a interpretar. */
function urlConFormato(url: string, formato: 'pdf' | 'excel'): string {
  const [ruta, query] = url.split('?')
  const nueva = ruta.replace(/\/(pdf|excel)$/, `/${formato}`)
  return query ? `${nueva}?${query}` : nueva
}

export function PeticionReporteIA({ puedeExportar }: { puedeExportar: boolean }) {
  const [instruccion, setInstruccion] = useState('')
  const [pidiendo, setPidiendo] = useState(false)
  const [respuesta, setRespuesta] = useState<RespuestaInterpretacionReporte | null>(null)
  /**
   * Cuenta de respuestas. Es la `key` del bloque de resultado: al cambiar, React
   * lo monta de nuevo y la animación de entrada se repite. Sin ella, pedir dos
   * veces lo mismo —el servidor cachea la instrucción diez minutos— cambiaría
   * el contenido sin que se notara.
   */
  const [generacion, setGeneracion] = useState(0)
  const { descargar, descargando } = useDescargaReporte()

  const largo = instruccion.trim().length
  const valido = largo >= MINIMO && largo <= MAXIMO

  const interpretar = async () => {
    if (!valido || pidiendo) return
    setPidiendo(true)
    try {
      const resultado = await api.reportes.interpretar(instruccion.trim())
      setRespuesta(resultado)
      setGeneracion((numero) => numero + 1)
    } catch (error: unknown) {
      const estado = (error as { status?: number })?.status
      setRespuesta(null)
      toast.error(
        estado === 503
          ? 'El servicio de interpretación está ocupado'
          : estado === 429
            ? 'Demasiadas peticiones'
            : 'No se pudo interpretar la petición',
        {
          description: mensajeDeError(
            error,
            estado === 503
              ? 'Vuelva a intentarlo en unos segundos, o elija un reporte predeterminado: esos no dependen de la IA.'
              : estado === 429
                ? 'Espere un momento antes de volver a intentarlo.'
                : 'Revise la redacción e intente de nuevo.',
          ),
        },
      )
    } finally {
      setPidiendo(false)
    }
  }

  const alPresionarTecla = (evento: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envía y Shift+Enter hace salto de línea, como en cualquier chat.
    // `isComposing` evita enviar al confirmar un acento con teclado de IME.
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault()
      void interpretar()
    }
  }

  return (
    <div className="space-y-5">
      {/* La tarjeta del sistema, sin aurora: con el halo del buscador y el de
          la pestaña, un fondo de colores más saturaba la pantalla. */}
      <Card className="gap-0 rounded-3xl border-border/50 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Pídale su reporte a la{' '}
              <span className="bg-linear-to-r from-violet-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent">
                IA
              </span>
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Escríbalo con sus palabras. La IA entiende qué necesita, elige el reporte y los
              filtros, y el sistema lo arma con los datos reales del parque.
            </p>
          </div>

          <BorderBeam size="pulse-inner" theme="light">
            <Card className="gap-0 rounded-2xl border-violet-300/50 py-0 shadow-lg shadow-violet-500/10">
              <div className="px-4 pt-4">
                <Textarea
                  value={instruccion}
                  onChange={(evento) => setInstruccion(evento.target.value.slice(0, MAXIMO))}
                  onKeyDown={alPresionarTecla}
                  placeholder="Ej.: ventas del vendedor Juan en las cuevas en agosto, desglosadas por día"
                  rows={2}
                  disabled={pidiendo}
                  aria-label="Petición para la IA"
                  className="min-h-14 resize-none rounded-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-2">
                <span className="text-[11px] text-muted-foreground">
                  {largo}/{MAXIMO}
                  {largo > 0 && largo < MINIMO && ` · mínimo ${MINIMO}`}
                  <span className="hidden sm:inline"> · Enter para generar, Shift+Enter para otra línea</span>
                </span>
                <button
                  type="button"
                  onClick={interpretar}
                  disabled={!valido || pidiendo}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-linear-to-r from-violet-600 via-fuchsia-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition-all enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {/* El orbe del botón es el único aviso de que está pensando:
                      no hay tarjeta de progreso; la respuesta se anuncia sola
                      al entrar. */}
                  {pidiendo && (
                    <ThinkingOrb
                      state="composing"
                      size={20}
                      theme="dark"
                      aria-label="Generando el reporte"
                    />
                  )}
                  Generar
                </button>
              </div>
            </Card>
          </BorderBeam>

          <div className="space-y-2">
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Pruebe con
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EJEMPLOS.map((ejemplo) => (
                <button
                  key={ejemplo}
                  type="button"
                  onClick={() => setInstruccion(ejemplo)}
                  disabled={pidiendo}
                  className="cursor-pointer rounded-full border border-violet-300/50 bg-card px-3 py-1.5 text-xs transition-all hover:border-violet-400 hover:bg-violet-500/10 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ejemplo}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {respuesta && (
        // `key`: cada respuesta entra desenfocada y se aclara. El resultado va
        // un pelo después que la interpretación, que es el orden en que se
        // leen.
        <div key={generacion} className="space-y-5" aria-live="polite">
          <div className="aparicion-suave">
            <div className="relative overflow-hidden rounded-2xl border border-violet-300/50 bg-card p-4 shadow-sm">
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-violet-500 via-fuchsia-500 to-indigo-500"
              />
              <div className="flex items-start gap-3 pl-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
                  <BrainCircuit className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
                    La IA entendió
                  </p>
                  <p className="text-sm">{respuesta.interpretacion}</p>
                  <p className="text-xs text-muted-foreground">
                    Reporte elegido:{' '}
                    <span className="font-medium text-foreground">
                      {respuesta.resultado.titulo}
                    </span>
                    {' · '}
                    Formato sugerido: {respuesta.formato === 'excel' ? 'Excel' : 'PDF'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="aparicion-suave" style={{ animationDelay: '120ms' }}>
            <ResultadoReporteVista
              reporte={respuesta.resultado}
              descargando={descargando}
              formatoDestacado={respuesta.formato}
              onDescargar={
                puedeExportar
                  ? (formato) =>
                      descargar(
                        formato,
                        () =>
                          api.reportes.descargarPorUrl(
                            urlConFormato(respuesta.urlDescarga, formato),
                          ),
                        `${respuesta.especificacion.clave}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`,
                      )
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
