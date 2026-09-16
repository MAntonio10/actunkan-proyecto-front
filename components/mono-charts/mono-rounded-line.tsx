'use client'

import * as React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  MONO_COLOR_PRINCIPAL,
  MONO_COLOR_REJILLA,
  MONO_COLOR_SECUNDARIO,
  MONO_TICK,
  MonoChartShell,
  MonoChartTooltip,
  MonoSinDatos,
  MonoSwitch,
  anchoEjeValores,
  formateadorMarca,
  formatearNumero,
  recortarEtiqueta,
  type FormateadorValor,
  type MonoPoint,
} from './mono-chart-base'

/**
 * `mono-rounded-line` de Monocharts, abierto a datos reales.
 * Ver la cabecera de `mono-chart-base.tsx` para el origen y las diferencias.
 *
 * Trazo con puntas redondeadas y serie de contraste opcional en línea
 * discontinua; el conmutador «Dual/Simple» del original se conserva y solo
 * aparece cuando de verdad hay una segunda serie.
 */
export function MonoRoundedLineChart({
  data,
  title = 'Evolución',
  badge = 'Línea',
  summary,
  summaryDetail,
  seriesName = 'Valor',
  secondarySeriesName = 'Comparativo',
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
  secondarySeriesName?: string
  formatValue?: FormateadorValor
  height?: number
  compact?: boolean
  footerLeft?: React.ReactNode
}) {
  const haySecundaria = data.some((punto) => typeof punto.secondary === 'number')
  const [series, setSeries] = React.useState<'todas' | 'principal'>('todas')

  const pico = data.length > 0 ? Math.max(...data.map((p) => p.value)) : 0

  return (
    <MonoChartShell
      title={title}
      badge={badge}
      summary={summary}
      summaryDetail={summaryDetail}
      compact={compact}
      actions={
        haySecundaria ? (
          <MonoSwitch
            value={series}
            onChange={setSeries}
            options={[
              { value: 'todas', label: 'Dual' },
              { value: 'principal', label: 'Simple' },
            ]}
          />
        ) : undefined
      }
      footerLeft={footerLeft ?? `${data.length} puntos`}
      footerRight={data.length > 0 ? `Máximo ${formatValue(pico)}` : undefined}
    >
      {data.length === 0 ? (
        <MonoSinDatos />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={MONO_COLOR_REJILLA} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={MONO_TICK}
              tickFormatter={(valor: string) => recortarEtiqueta(valor, 10)}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={MONO_TICK}
              width={anchoEjeValores(data, formatValue)}
              tickFormatter={formateadorMarca(formatValue)}
            />
            <Tooltip
              content={<MonoChartTooltip formatValue={formatValue} />}
              cursor={{ stroke: MONO_COLOR_REJILLA, strokeWidth: 1 }}
            />

            {haySecundaria && series === 'todas' && (
              <Line
                type="monotone"
                dataKey="secondary"
                name={secondarySeriesName}
                stroke={MONO_COLOR_SECUNDARIO}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 4"
                dot={false}
                animationDuration={900}
              />
            )}

            <Line
              type="monotone"
              dataKey="value"
              name={seriesName}
              stroke={MONO_COLOR_PRINCIPAL}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              // Con muchos puntos los círculos se tocan y ensucian el trazo.
              dot={
                data.length > 24
                  ? false
                  : { r: 3.5, fill: MONO_COLOR_PRINCIPAL, stroke: 'var(--card)', strokeWidth: 2 }
              }
              activeDot={{ r: 6, fill: MONO_COLOR_PRINCIPAL, stroke: 'var(--card)', strokeWidth: 2 }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MonoChartShell>
  )
}
