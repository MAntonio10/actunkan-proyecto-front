'use client'

import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
 * `mono-rounded-bar` de Monocharts, abierto a datos reales.
 * Ver la cabecera de `mono-chart-base.tsx` para el origen y las diferencias.
 *
 * Barras con las cuatro esquinas redondeadas y conmutador columna/fila del
 * original. La orientación arranca en fila cuando las etiquetas son largas
 * —nombres de vendedor o de país no caben bajo una columna— y eso es lo que
 * hace legible el mismo componente para reportes muy distintos.
 *
 * Con `layoutSwitch={false}` la orientación queda fija en `defaultLayout`: es
 * como se distinguen una gráfica «de barras» y una «de columnas» cuando las dos
 * conviven en la misma pantalla.
 */
export function MonoRoundedBarChart({
  data,
  title = 'Comparativa',
  badge = 'Barras',
  summary,
  summaryDetail,
  seriesName = 'Valor',
  secondarySeriesName = 'Comparativo',
  formatValue = formatearNumero,
  height = 200,
  compact = false,
  defaultLayout,
  layoutSwitch = true,
  maxLabelLength = 8,
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
  defaultLayout?: 'columna' | 'fila'
  /** `false` fija la orientación y oculta el conmutador. */
  layoutSwitch?: boolean
  /** Caracteres de la etiqueta bajo cada columna antes de recortarla. */
  maxLabelLength?: number
  footerLeft?: React.ReactNode
}) {
  const etiquetaLarga = data.some((punto) => punto.label.length > 10)
  const [orientacion, setOrientacion] = React.useState<'columna' | 'fila'>(
    defaultLayout ?? (etiquetaLarga ? 'fila' : 'columna'),
  )
  const esFila = orientacion === 'fila'
  const haySecundaria = data.some((punto) => typeof punto.secondary === 'number')

  // En fila cada barra necesita su propio alto, o con muchas categorías se
  // aplastan hasta desaparecer.
  const alto = esFila ? Math.max(height, data.length * 30 + 24) : height

  return (
    <MonoChartShell
      title={title}
      badge={badge}
      summary={summary}
      summaryDetail={summaryDetail}
      compact={compact}
      actions={
        layoutSwitch ? (
          <MonoSwitch
            value={orientacion}
            onChange={setOrientacion}
            options={[
              { value: 'columna', label: 'Col' },
              { value: 'fila', label: 'Fila' },
            ]}
          />
        ) : undefined
      }
      footerLeft={footerLeft ?? `${data.length} categorías`}
      footerRight={seriesName}
    >
      {data.length === 0 ? (
        <MonoSinDatos />
      ) : (
        <ResponsiveContainer width="100%" height={alto}>
          <BarChart
            data={data}
            layout={esFila ? 'vertical' : 'horizontal'}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="2 2"
              horizontal={!esFila}
              vertical={esFila}
              stroke={MONO_COLOR_REJILLA}
            />
            {/* Cada eje va suelto, nunca dentro de un fragmento: recharts 2
                busca sus hijos con `react-is` 18, que no reconoce los
                fragmentos de React 19, y un eje envuelto se ignora — la
                gráfica cae a ejes ocultos por omisión, las columnas pierden
                sus etiquetas y las filas se dibujan como una sola barra. */}
            {esFila ? (
              <XAxis type="number" hide />
            ) : (
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={MONO_TICK}
                tickFormatter={(valor: string) => recortarEtiqueta(valor, maxLabelLength)}
                interval={0}
              />
            )}
            {esFila ? (
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                tick={MONO_TICK}
                width={110}
                tickFormatter={(valor: string) => recortarEtiqueta(valor, 16)}
              />
            ) : (
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={MONO_TICK}
                width={anchoEjeValores(data, formatValue)}
                tickFormatter={formateadorMarca(formatValue)}
              />
            )}
            <Tooltip
              content={<MonoChartTooltip formatValue={formatValue} />}
              cursor={{ fill: MONO_COLOR_REJILLA }}
            />

            <Bar
              dataKey="value"
              name={seriesName}
              fill={MONO_COLOR_PRINCIPAL}
              radius={esFila ? [0, 8, 8, 0] : [8, 8, 8, 8]}
              maxBarSize={esFila ? 14 : 28}
              animationDuration={800}
            />

            {haySecundaria && (
              <Bar
                dataKey="secondary"
                name={secondarySeriesName}
                fill={MONO_COLOR_SECUNDARIO}
                radius={esFila ? [0, 8, 8, 0] : [8, 8, 8, 8]}
                maxBarSize={esFila ? 14 : 28}
                animationDuration={1000}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </MonoChartShell>
  )
}
