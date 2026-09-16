'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Monocharts — base compartida.
 *
 * Origen: https://github.com/Subhan-code/Monocharts
 * (`src/components/mono-charts/*.tsx`). Se vendorizaron a mano porque el CLI
 * que documenta el repo, `npx @subhanhq/amicro@latest add mono-rounded-*`, no
 * es ejecutable: el paquete publicado no declara `bin`, y esos nombres tampoco
 * existen en su `registry/`. Los originales son piezas de escaparate con los
 * datos escritos dentro y solo dos props (`theme`, `compact`), así que hubo que
 * abrirlos a datos reales de todos modos.
 *
 * Se conserva la identidad visual —tarjeta de 24px, plataforma interior, barras
 * y trazos con puntas redondeadas, cabecera con rótulo y cifra grande— y se
 * cambian dos cosas:
 *
 *  1. **Datos por props.** `MonoPoint[]` en vez de constantes del módulo.
 *  2. **Color por tokens.** Los originales pintan blanco sobre `#181818`; acá
 *     se usan `var(--chart-1..5)` y `var(--primary)`, que ya son la familia
 *     verde del parque y siguen el tema claro/oscuro sin una prop `theme` que
 *     sería una segunda fuente de verdad. Es la misma técnica de
 *     `components/ui/chart.tsx`: recharts escribe el valor tal cual en el
 *     atributo SVG y el navegador resuelve la variable.
 *
 * Además, el eje de valores mide su ancho (`anchoEjeValores`) en vez de usar
 * uno fijo, y ningún hijo de recharts va dentro de un fragmento: recharts 2
 * los busca con `react-is` 18, que no reconoce los de React 19, y los ignora.
 *
 * Este directorio es librería vendorizada, como `components/ui`: API en inglés,
 * sin lógica de negocio. Lo de dominio vive en `componentes/graficas_reporte.tsx`.
 */

export interface MonoPoint {
  /** Etiqueta del eje de categorías. */
  label: string
  value: number
  /** Serie de contraste, opcional. */
  secondary?: number
}

/** Colores de la familia del tema. El primero es el de la serie principal. */
export const MONO_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

// Variables planas y no `color-mix(...)`: estos valores terminan en atributos
// SVG (`fill`, `stroke`), donde un navegador que no entienda la función
// descarta el atributo entero y pinta la rejilla en negro. `var()` sí lo
// resuelve en todas partes — es lo que hace `components/ui/chart.tsx`.
export const MONO_COLOR_PRINCIPAL = 'var(--primary)'
export const MONO_COLOR_SECUNDARIO = 'var(--chart-3)'
export const MONO_COLOR_REJILLA = 'var(--border)'

export function colorDeSerie(indice: number): string {
  return MONO_COLORS[indice % MONO_COLORS.length]
}

/** Estilo de las marcas de los ejes, común a las cuatro gráficas. */
export const MONO_TICK = {
  fontSize: 10,
  fill: 'var(--muted-foreground)',
} as const

export type FormateadorValor = (valor: number) => string

export const formatearNumero: FormateadorValor = (valor) =>
  valor.toLocaleString('es-GT', { maximumFractionDigits: 2 })

/**
 * Formateador de las marcas del eje de valores: el mismo de la serie, sin los
 * decimales en cero. recharts elige marcas redondas (0, 250, 500…), y «Q500.00»
 * repetido cinco veces solo le quita ancho a la gráfica.
 */
export function formateadorMarca(formatValue: FormateadorValor): FormateadorValor {
  return (valor) => formatValue(valor).replace(/\.0+(?=\D*$)/, '')
}

/**
 * Ancho del eje de valores según la marca más larga que va a pintar.
 *
 * recharts 2 no lo calcula solo, y con uno fijo «Q12,500» salía recortado por
 * la izquierda. No basta medir el dato mayor: la marca superior se redondea
 * hacia arriba (839 → «Q1,000», dos caracteres más), así que se mide la
 * potencia de diez siguiente, que es su peor caso. Unos 6.5 px por carácter,
 * porque las marcas van a 10 px.
 */
export function anchoEjeValores(data: MonoPoint[], formatValue: FormateadorValor): number {
  const marca = formateadorMarca(formatValue)
  const techo = (valor: number) => (valor > 0 ? 10 ** Math.ceil(Math.log10(valor)) : 0)
  const valores = data.flatMap((punto) => [punto.value, punto.secondary ?? 0])
  const maximo = Math.max(0, ...valores)
  const minimo = Math.min(0, ...valores)
  const caracteres = Math.max(
    marca(techo(maximo)).length,
    minimo < 0 ? marca(-techo(-minimo)).length : 0,
  )
  return Math.min(96, Math.max(32, Math.ceil(caracteres * 6.5) + 8))
}

/**
 * Recorta una etiqueta larga para el eje.
 *
 * Los nombres de vendedor o de país desbordan el eje y recharts los deja
 * cortados a media letra; mejor cortar con puntos suspensivos y dejar el nombre
 * completo en el tooltip.
 */
export function recortarEtiqueta(texto: string, maximo = 14): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto
}

interface PropsTooltip {
  active?: boolean
  payload?: Array<{
    value?: number | string
    name?: string
    dataKey?: string | number
    color?: string
    fill?: string
    payload?: MonoPoint
  }>
  label?: string
  formatValue?: FormateadorValor
}

/** Tooltip de las cuatro gráficas (upstream: `DitherChartTooltipContent`). */
export function MonoChartTooltip({
  active,
  payload,
  label,
  formatValue = formatearNumero,
}: PropsTooltip) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="pointer-events-none z-50 rounded-xl border border-border/70 bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md">
      {label && (
        <div className="mb-1.5 border-b border-border/60 pb-1 font-medium tracking-tight text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, indice) => (
          <div key={indice} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full ring-1 ring-border"
                style={{ backgroundColor: item.color || item.fill || 'var(--primary)' }}
              />
              <span className="font-normal text-muted-foreground">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="font-semibold tabular-nums">
              {typeof item.value === 'number' ? formatValue(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface MonoChartShellProps {
  /** Rótulo en versalitas de la esquina superior izquierda. */
  title: string
  /** Píldora junto al rótulo: el tipo de gráfica. */
  badge?: string
  /** Cifra grande de la cabecera, ya formateada. */
  summary?: string
  summaryDetail?: string
  /** Controles de la cabecera (conmutadores del propio componente). */
  actions?: React.ReactNode
  footerLeft?: React.ReactNode
  footerRight?: React.ReactNode
  compact?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Chasis común: tarjeta redondeada, cabecera, plataforma interior y pie.
 *
 * En el original cada gráfica repetía este bloque; extraerlo evita que las
 * cuatro se desincronicen cuando cambie un radio o un espaciado.
 */
export function MonoChartShell({
  title,
  badge,
  summary,
  summaryDetail,
  actions,
  footerLeft,
  footerRight,
  compact = false,
  className,
  children,
}: MonoChartShellProps) {
  return (
    <div
      className={cn(
        'group relative flex w-full flex-col justify-between overflow-hidden rounded-[24px] border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:p-5',
        compact ? 'min-h-[240px]' : 'min-h-[300px]',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            {badge && (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                {badge}
              </span>
            )}
          </div>
          {summary && (
            <div className="mt-0.5 truncate text-xl font-bold tracking-tight tabular-nums">
              {summary}
              {summaryDetail && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {summaryDetail}
                </span>
              )}
            </div>
          )}
        </div>
        {actions}
      </div>

      <div className="relative w-full flex-1 overflow-hidden rounded-[14px] bg-muted/40 p-2">
        {children}
      </div>

      {(footerLeft || footerRight) && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-1 font-mono text-[11px]">
          <span className="truncate text-muted-foreground">{footerLeft}</span>
          <span className="shrink-0 font-medium text-foreground">{footerRight}</span>
        </div>
      )}
    </div>
  )
}

/** Conmutador de la cabecera, con la píldora del original. */
export function MonoSwitch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (valor: T) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 p-0.5">
      {options.map((opcion) => (
        <button
          key={opcion.value}
          type="button"
          onClick={() => onChange(opcion.value)}
          aria-pressed={value === opcion.value}
          className={cn(
            'cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all',
            value === opcion.value
              ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  )
}

/** Plataforma vacía: una gráfica sin filas no debe dibujar ejes en cero. */
export function MonoSinDatos({ mensaje = 'Sin datos para graficar' }: { mensaje?: string }) {
  return (
    <div className="flex h-full min-h-[140px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {mensaje}
    </div>
  )
}
