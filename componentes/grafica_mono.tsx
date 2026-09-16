'use client'

import { BarChart3, Filter, LineChart, PieChart } from 'lucide-react'

import type { MonoPoint } from '@/components/mono-charts/mono-chart-base'
import { MonoRoundedBarChart } from '@/components/mono-charts/mono-rounded-bar'
import { MonoRoundedDonutChart } from '@/components/mono-charts/mono-rounded-donut'
import { MonoRoundedFunnelChart } from '@/components/mono-charts/mono-rounded-funnel'
import { MonoRoundedLineChart } from '@/components/mono-charts/mono-rounded-line'
import { cn } from '@/lib/utils'

/**
 * Una gráfica Monocharts elegida por su tipo, y el conmutador para cambiarlo.
 *
 * La usa la sección de un reporte, que deduce la gráfica de sus columnas y deja
 * al usuario cambiar el tipo. El panel del mes no pasa por acá: sus cuatro
 * gráficas tienen forma fija (`componentes/panel_graficas.tsx`) y usan los
 * componentes de `components/mono-charts` directamente, que son los que llevan
 * colores y estilo — así los dos sitios no pueden verse distintos.
 */

export type TipoGrafica = 'linea' | 'barra' | 'dona' | 'embudo'

export const TIPOS_GRAFICA: Array<{
  tipo: TipoGrafica
  etiqueta: string
  icono: typeof LineChart
}> = [
  { tipo: 'linea', etiqueta: 'Línea', icono: LineChart },
  { tipo: 'barra', etiqueta: 'Barras', icono: BarChart3 },
  { tipo: 'dona', etiqueta: 'Dona', icono: PieChart },
  { tipo: 'embudo', etiqueta: 'Embudo', icono: Filter },
]

export function SelectorTipoGrafica({
  tipos,
  valor,
  onCambio,
}: {
  tipos: typeof TIPOS_GRAFICA
  valor: TipoGrafica
  onCambio: (tipo: TipoGrafica) => void
}) {
  return (
    <div
      role="group"
      aria-label="Tipo de gráfica"
      className="flex items-center gap-0.5 rounded-full border border-border/70 bg-muted p-0.5"
    >
      {tipos.map((opcion) => {
        const Icono = opcion.icono
        const activo = valor === opcion.tipo
        return (
          <button
            key={opcion.tipo}
            type="button"
            onClick={() => onCambio(opcion.tipo)}
            aria-pressed={activo}
            title={opcion.etiqueta}
            className={cn(
              'flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
              activo
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icono className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{opcion.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}

export function GraficaMono({
  tipo,
  datos,
  titulo,
  nombreSerie,
  formatear,
  resumen,
  detalleResumen,
  pie,
  altura,
}: {
  tipo: TipoGrafica
  datos: MonoPoint[]
  titulo: string
  nombreSerie: string
  formatear: (valor: number) => string
  /** Cifra grande de la cabecera, ya formateada. */
  resumen?: string
  detalleResumen?: string
  pie?: React.ReactNode
  altura?: number
}) {
  const comunes = {
    data: datos,
    title: titulo,
    formatValue: formatear,
    footerLeft: pie,
    height: altura,
  }

  switch (tipo) {
    case 'linea':
      return (
        <MonoRoundedLineChart
          {...comunes}
          seriesName={nombreSerie}
          badge="Línea"
          summary={resumen}
          summaryDetail={detalleResumen}
        />
      )
    case 'barra':
      return (
        <MonoRoundedBarChart
          {...comunes}
          seriesName={nombreSerie}
          badge="Barras"
          summary={resumen}
          summaryDetail={detalleResumen}
        />
      )
    case 'embudo':
      return (
        <MonoRoundedFunnelChart
          {...comunes}
          seriesName={nombreSerie}
          badge="Embudo"
          summary={resumen}
          summaryDetail={detalleResumen}
        />
      )
    default:
      // La dona no recibe `seriesName`: su tooltip nombra la categoría.
      return (
        <MonoRoundedDonutChart
          {...comunes}
          badge="Dona"
          summary={resumen}
          summaryDetail={detalleResumen}
        />
      )
  }
}
