'use client'

import * as React from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import {
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
 * `mono-rounded-donut` de Monocharts, abierto a datos reales.
 * Ver la cabecera de `mono-chart-base.tsx` para el origen y las diferencias.
 *
 * Arcos con `cornerRadius`, separación entre segmentos y el dato al centro, que
 * cambia al pasar por encima de un segmento. El anillo solo tiene sentido con
 * pocas categorías: quien lo usa debe recortar y agrupar antes (lo hace
 * `componentes/graficas_reporte.tsx`).
 *
 * `variant="pie"` lo convierte en un pastel macizo: sin hueco no hay dónde
 * poner el dato del centro, así que el porcentaje de cada porción pasa a la
 * leyenda.
 */
export function MonoRoundedDonutChart({
  data,
  title = 'Distribución',
  badge = 'Dona',
  summary,
  summaryDetail,
  formatValue = formatearNumero,
  height = 200,
  compact = false,
  variant = 'donut',
  footerLeft,
}: {
  data: MonoPoint[]
  title?: string
  badge?: string
  summary?: string
  summaryDetail?: string
  formatValue?: FormateadorValor
  height?: number
  compact?: boolean
  variant?: 'donut' | 'pie'
  footerLeft?: React.ReactNode
}) {
  const [indiceActivo, setIndiceActivo] = React.useState<number | null>(null)

  const total = data.reduce((acumulado, punto) => acumulado + punto.value, 0)
  const activo = indiceActivo !== null ? data[indiceActivo] : null
  const porcentajeDe = (valor: number) =>
    total !== 0 ? `${((valor / total) * 100).toFixed(1)}%` : null
  const porcentajeActivo = activo ? porcentajeDe(activo.value) : null

  const esPastel = variant === 'pie'
  const radioExterior = esPastel ? (compact ? 70 : 88) : compact ? 62 : 78
  const radioInterior = esPastel ? 0 : compact ? 42 : 54

  return (
    <MonoChartShell
      title={title}
      badge={badge}
      summary={summary ?? formatValue(total)}
      summaryDetail={summaryDetail}
      compact={compact}
      footerLeft={footerLeft ?? `${data.length} categorías`}
      footerRight="Total"
    >
      {data.length === 0 ? (
        <MonoSinDatos />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-full">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Tooltip content={<MonoChartTooltip formatValue={formatValue} />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={radioInterior}
                  outerRadius={radioExterior}
                  // En el pastel las porciones ya se separan con el trazo: un
                  // hueco angular las haría converger en cuñas al centro.
                  paddingAngle={!esPastel && data.length > 1 ? 4 : 0}
                  cornerRadius={esPastel ? 6 : 8}
                  onMouseEnter={(_, indice) => setIndiceActivo(indice)}
                  onMouseLeave={() => setIndiceActivo(null)}
                  animationDuration={900}
                >
                  {data.map((punto, indice) => (
                    <Cell
                      key={punto.label}
                      fill={colorDeSerie(indice)}
                      stroke="var(--card)"
                      strokeWidth={2}
                      style={{
                        transform: indiceActivo === indice ? 'scale(1.04)' : 'scale(1)',
                        transformOrigin: 'center center',
                        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Dato al centro. Sin eventos, o robaría el hover de los arcos. */}
            {!esPastel && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold tabular-nums">
                  {activo ? formatValue(activo.value) : formatValue(total)}
                </span>
                <span className="max-w-[8rem] truncate text-[10px] text-muted-foreground">
                  {activo ? `${recortarEtiqueta(activo.label, 16)} · ${porcentajeActivo}` : 'Total'}
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px]">
            {data.map((punto, indice) => (
              <div key={punto.label} className="flex min-w-0 items-center gap-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorDeSerie(indice) }}
                />
                <span className="truncate text-muted-foreground">
                  {recortarEtiqueta(punto.label, 18)}
                </span>
                {esPastel && porcentajeDe(punto.value) && (
                  <span className="font-medium tabular-nums">{porcentajeDe(punto.value)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </MonoChartShell>
  )
}
