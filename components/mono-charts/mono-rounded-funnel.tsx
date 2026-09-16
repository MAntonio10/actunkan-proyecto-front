'use client'

import * as React from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  MONO_COLOR_REJILLA,
  MONO_TICK,
  MonoChartShell,
  MonoChartTooltip,
  MonoSinDatos,
  colorDeSerie,
  formatearNumero,
  recortarEtiqueta,
  type FormateadorValor,
  type MonoPoint,
} from './mono-chart-base'

/**
 * `mono-rounded-funnel` de Monocharts, abierto a datos reales.
 * Ver la cabecera de `mono-chart-base.tsx` para el origen y las diferencias.
 *
 * Píldoras horizontales de mayor a menor. El original es un embudo de
 * conversión; acá sirve además como ranking —qué vendedor, país o sector pesa
 * más—, que es la forma que tienen la mitad de los reportes del catálogo. El
 * pie muestra la caída de la primera etapa a la última, que es la lectura útil
 * cuando sí es un embudo.
 */
export function MonoRoundedFunnelChart({
  data,
  title = 'Ranking',
  badge = 'Embudo',
  summary,
  summaryDetail,
  seriesName = 'Valor',
  formatValue = formatearNumero,
  height = 200,
  compact = false,
  footerLeft,
}: {
  data: MonoPoint[]
  title?: string
  badge?: string
  summary?: string
  summaryDetail?: string
  seriesName?: string
  formatValue?: FormateadorValor
  height?: number
  compact?: boolean
  footerLeft?: React.ReactNode
}) {
  // El embudo se lee de arriba abajo: siempre descendente, venga como venga.
  const etapas = React.useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  )

  const primera = etapas[0]?.value ?? 0
  const ultima = etapas[etapas.length - 1]?.value ?? 0
  const conversion = primera > 0 ? `${((ultima / primera) * 100).toFixed(1)}%` : '—'

  const alto = Math.max(height, etapas.length * 32 + 24)

  return (
    <MonoChartShell
      title={title}
      badge={badge}
      summary={summary ?? (primera > 0 ? formatValue(primera) : undefined)}
      summaryDetail={summaryDetail ?? 'en la primera etapa'}
      compact={compact}
      footerLeft={footerLeft ?? `${etapas.length} etapas`}
      footerRight={`Última / primera: ${conversion}`}
    >
      {etapas.length === 0 ? (
        <MonoSinDatos />
      ) : (
        <ResponsiveContainer width="100%" height={alto}>
          <BarChart
            data={etapas}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={MONO_TICK}
              width={110}
              tickFormatter={(valor: string) => recortarEtiqueta(valor, 16)}
            />
            <Tooltip
              content={<MonoChartTooltip formatValue={formatValue} />}
              cursor={{ fill: MONO_COLOR_REJILLA }}
            />
            <Bar
              dataKey="value"
              name={seriesName}
              radius={[0, 8, 8, 0]}
              maxBarSize={16}
              animationDuration={800}
            >
              {/* Degradado por etapa: la caída se ve además en el color. */}
              {etapas.map((etapa, indice) => (
                <Cell key={etapa.label} fill={colorDeSerie(indice)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MonoChartShell>
  )
}
