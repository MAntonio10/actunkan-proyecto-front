'use client'

import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Tarjeta de cifra para las filas de indicadores de cada módulo.
 *
 * El acabado es de vidrio esmerilado —el material de iOS— pero deliberadamente
 * contenido: el sistema entero es opaco y cálido, así que una pieza de vidrio
 * franco se vería pegada de otro diseño. Lo que la hace leer como vidrio es
 * sobre todo la luz, no la transparencia: el filo claro de arriba, el barrido
 * diagonal del acento y la sombra baja y difusa. La translucidez es la mínima
 * que deja notar el desenfoque.
 *
 * Decisiones que vale la pena no deshacer:
 *
 * - **No es un `<Card>` de shadcn.** Esa pieza lleva un gradiente opaco en
 *   `globals.css` que tapa cualquier color de fondo que se le ponga, así que las
 *   tarjetas tintadas se veían todas iguales. Acá la superficie se controla
 *   entera y el acento sí se ve.
 * - **El desenfoque es lo que permite la transparencia.** `globals.css` pide
 *   superficies opacas porque el mapa del fondo se transparentaba a través de
 *   ellas y ensuciaba el texto. Acá se vuelve a abrir un 12 %, pero con
 *   `backdrop-filter`: el desenfoque deshace el dibujo en una mancha de color
 *   sin forma, que es justo lo que no se podía hacer con una superficie
 *   traslúcida y nítida. Sin el desenfoque hay que volver a cerrarla.
 * - **La proporción se dibuja como medidor, no como dona.** Una dona de dos
 *   porciones —activos contra anulados— es de los casos en que el gráfico
 *   estorba: dos ángulos parecidos se comparan peor que dos longitudes. El
 *   carril del medidor es un paso más claro del **mismo** tono, no gris, para
 *   que el estado se lea a lo largo de toda la barra.
 * - **No hay medidor cuando no hay proporción honesta.** Un total es el entero,
 *   no una parte de nada; y `tickets` contra `personas` contra `quetzales` son
 *   unidades distintas que no forman un porcentaje. Dibujar ahí una barra sería
 *   decorar con forma de dato.
 * - **No hay líneas de tendencia.** Harían falta series históricas que el
 *   dispositivo no tiene; inventarlas para que la tarjeta "se vea mejor" sería
 *   mostrar una forma que no corresponde a ningún dato.
 * - **El color nunca es el único canal.** Verde y rojo quedan por debajo del
 *   umbral de separación con protanopía, así que cada tarjeta lleva su icono y
 *   su rótulo: el color refuerza, no identifica. Eso es también lo que permitió
 *   quitar el filo de color de la izquierda sin perder la identidad de cada
 *   tarjeta — el icono y el rótulo ya la llevaban.
 */

export type TonoEstadistica = 'primary' | 'positivo' | 'negativo' | 'neutro' | 'info'

/** Cada tono nombra su acento; el carril y el barrido salen del mismo con `color-mix`. */
const ACENTO: Record<TonoEstadistica, string> = {
  primary: 'var(--primary)',
  positivo: 'var(--color-emerald-600)',
  negativo: 'var(--destructive)',
  neutro: 'var(--muted-foreground)',
  info: 'var(--color-sky-600)',
}

interface Props {
  /** En minúscula de frase, sin dos puntos al final. */
  etiqueta: string
  valor: React.ReactNode
  icono: LucideIcon
  tono?: TonoEstadistica
  /**
   * Parte y total de una proporción real. Solo se pasa cuando el valor ES una
   * parte del total; si no, la tarjeta queda sin medidor y está bien así.
   */
  proporcion?: { parte: number; total: number }
  /** Línea breve bajo la cifra: una media, un contexto, una unidad. */
  pie?: string
  className?: string
}

export function TarjetaEstadistica({
  etiqueta,
  valor,
  icono: Icono,
  tono = 'primary',
  proporcion,
  pie,
  className,
}: Props) {
  const acento = ACENTO[tono]
  const total = proporcion?.total ?? 0
  const parte = proporcion?.parte ?? 0
  const porcentaje = total > 0 ? Math.min(100, Math.max(0, (parte / total) * 100)) : null

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl border p-4', className)}
      style={{
        // Base traslúcida: 12 % de apertura, lo justo para que el desenfoque
        // tenga algo que desenfocar. Más que esto y vuelve a leerse el mapa.
        backgroundColor: 'color-mix(in oklch, var(--card) 88%, transparent)',
        // Barrido del acento desde el ángulo superior: es lo que da la sensación
        // de luz entrando de lado, y lo que sustituye al filo de color que la
        // tarjeta tenía a la izquierda.
        backgroundImage: `linear-gradient(150deg, color-mix(in oklch, ${acento} 14%, transparent) 0%, transparent 58%)`,
        backdropFilter: 'blur(14px) saturate(1.6)',
        // Safari e iOS todavía lo piden con prefijo, y las tablets del parque
        // son justamente ahí donde esto se mira.
        WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
        borderColor: `color-mix(in oklch, ${acento} 20%, transparent)`,
        boxShadow: [
          // Filo especular de arriba: el detalle que más hace por el efecto.
          'inset 0 1px 0 0 color-mix(in srgb, #fff 60%, transparent)',
          '0 1px 2px -1px rgb(0 0 0 / 0.07)',
          '0 12px 28px -18px rgb(0 0 0 / 0.32)',
        ].join(', '),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {etiqueta}
          </p>
          {/* Escalonado: en una tarjeta de media pantalla a 320 px, un monto
              como Q1,234,567.00 no entra en text-2xl. */}
          <p className="mt-1 text-xl sm:text-2xl font-bold leading-tight text-foreground">
            {valor}
          </p>
          {pie && <p className="mt-0.5 text-[11px] text-muted-foreground">{pie}</p>}
        </div>

        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklch, ${acento} 15%, transparent)`,
            boxShadow: 'inset 0 1px 0 0 color-mix(in srgb, #fff 45%, transparent)',
            color: acento,
          }}
        >
          <Icono className="h-5 w-5" />
        </span>
      </div>

      {porcentaje !== null && (
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            // El carril es un paso más claro del mismo tono, no gris: así el
            // estado se lee a lo largo de toda la barra y no solo en el relleno.
            style={{ backgroundColor: `color-mix(in oklch, ${acento} 18%, var(--card))` }}
            role="img"
            aria-label={`${Math.round(porcentaje)} por ciento de ${total}`}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${porcentaje}%`, backgroundColor: acento }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {Math.round(porcentaje)}% de {total}
          </p>
        </div>
      )}
    </div>
  )
}
