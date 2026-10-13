'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Paginador de las pantallas de listado.
 *
 * Existe como pieza única porque las siete pantallas que lo usan tenían el
 * mismo bloque copiado, y las reglas que importan son fáciles de olvidar al
 * replicarlo: que no se pueda salir del rango, que se deshabilite mientras hay
 * una carga en curso, y que no se dibuje cuando todo entra en una sola página.
 *
 * No guarda estado: recibe la página actual y avisa cuál se pidió. Quién carga
 * los datos —el servidor en seis pantallas, el propio navegador en usuarios—
 * es decisión de cada una.
 */

/** Cuántos números se dibujan a la vez. */
const TAMANO_VENTANA = 5

/**
 * Las páginas que se muestran como número.
 *
 * La ventana **arranca en la página actual**: en la 1 se ven 1-5, y al pararse
 * en la 5 se ven 5-9. Hacia el final se corre para atrás, de modo que siempre
 * se dibujan cinco números mientras haya cinco páginas.
 *
 * Quien llama agrega aparte la primera y la última con sus puntos suspensivos,
 * porque con la ventana sola no habría forma de volver al principio desde la
 * mitad del historial.
 */
function ventanaDePaginas(pagina: number, totalPaginas: number): number[] {
  const primera = Math.max(1, Math.min(pagina, totalPaginas - TAMANO_VENTANA + 1))
  const ultima = Math.min(totalPaginas, primera + TAMANO_VENTANA - 1)
  const paginas: number[] = []
  for (let n = primera; n <= ultima; n++) paginas.push(n)
  return paginas
}

function Puntos() {
  return (
    <span aria-hidden className="px-0.5 text-xs text-muted-foreground select-none">
      …
    </span>
  )
}

interface PropsPaginador {
  /** Página actual, empezando en 1. */
  pagina: number
  totalPaginas: number
  /** Total de filas del conjunto, para el texto. No es el de la página. */
  total: number
  /** Plural de lo que se lista: "eventos", "recibos", "tickets". */
  etiqueta: string
  /** Deshabilita los controles mientras se está trayendo una página. */
  cargando?: boolean
  onCambiar: (pagina: number) => void
  className?: string
}

export function Paginador({
  pagina,
  totalPaginas,
  total,
  etiqueta,
  cargando = false,
  onCambiar,
  className,
}: PropsPaginador) {
  // Con una sola página no hay nada que ofrecer. Se comprueba acá y no en cada
  // pantalla para que ninguna se olvide y deje un paginador muerto.
  if (totalPaginas <= 1) return null

  // Todo salto pasa por acá: ni las flechas ni los números pueden entregar una
  // página fuera de rango, que el backend contesta con una lista vacía.
  const irA = (destino: number) => {
    const acotada = Math.min(totalPaginas, Math.max(1, destino))
    if (acotada !== pagina) onCambiar(acotada)
  }

  const ventana = ventanaDePaginas(pagina, totalPaginas)
  const primeraVisible = ventana[0]
  const ultimaVisible = ventana[ventana.length - 1]

  // Los puntos solo cuando de verdad hay un salto. Si la ventana empieza en la
  // 2, dibujar "1 … 2" seria mentir: no hay nada escondido entre medio.
  const faltanAlInicio = primeraVisible > 1
  const saltoAlInicio = primeraVisible > 2
  const faltanAlFinal = ultimaVisible < totalPaginas
  const saltoAlFinal = ultimaVisible < totalPaginas - 1

  const botonNumero = (n: number) => (
    <Button
      key={n}
      type="button"
      variant={n === pagina ? 'default' : 'outline'}
      size="sm"
      onClick={() => irA(n)}
      disabled={cargando}
      aria-label={`Ir a la página ${n}`}
      aria-current={n === pagina ? 'page' : undefined}
      className={cn(
        'h-8 w-8 shrink-0 p-0 text-xs tabular-nums cursor-pointer',
        n === pagina && 'pointer-events-none font-bold',
      )}
    >
      {n}
    </Button>
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Página {pagina} de {totalPaginas} · {total} {etiqueta}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => irA(pagina - 1)}
          disabled={pagina <= 1 || cargando}
          aria-label="Página anterior"
          className="h-8 shrink-0 gap-1 px-2 cursor-pointer sm:px-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Los números aparecen desde `md`. El caso más ancho — 1 … 5 6 7 8 9 …
            82 — mide 484 px; con el texto de la izquierda al lado suman 684, que
            entra en 768 px pero no en 640: ahí los números saltarían de línea.
            Debajo de eso las flechas alcanzan. */}
        <div className="hidden items-center gap-1.5 md:flex">
          {faltanAlInicio && botonNumero(1)}
          {saltoAlInicio && <Puntos />}
          {ventana.map(botonNumero)}
          {saltoAlFinal && <Puntos />}
          {faltanAlFinal && botonNumero(totalPaginas)}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => irA(pagina + 1)}
          disabled={pagina >= totalPaginas || cargando}
          aria-label="Página siguiente"
          className="h-8 shrink-0 gap-1 px-2 cursor-pointer sm:px-3"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
