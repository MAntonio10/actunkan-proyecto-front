'use client'

import { useMemo } from 'react'
import { CalendarRange, TriangleAlert } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  describirRango,
  diasDelRango,
  errorDeRango,
  rangosRapidos,
  type RangoFechas,
} from '@/lib/formato_reporte'
import { cn } from '@/lib/utils'

/**
 * Período de los reportes predeterminados: atajos de uso diario más dos fechas.
 *
 * Es uno solo para todo el catálogo —casi todos los reportes declaran el rango
 * de fechas—, así que se elige una vez y vale para cualquier reporte que se
 * genere después. Valida con las mismas reglas que la API para que el error se
 * vea junto al control y no como un 400 al descargar.
 */
export function SelectorPeriodo({
  valor,
  onCambio,
}: {
  valor: RangoFechas
  onCambio: (rango: RangoFechas) => void
}) {
  const atajos = useMemo(() => rangosRapidos(), [])
  const error = errorDeRango(valor)
  const dias = diasDelRango(valor)
  const atajoActivo = atajos.find(
    (atajo) => atajo.desde === valor.desde && atajo.hasta === valor.hasta,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Períodos frecuentes">
        {atajos.map((atajo) => {
          const activo = atajo === atajoActivo
          return (
            <button
              key={atajo.etiqueta}
              type="button"
              onClick={() => onCambio({ desde: atajo.desde, hasta: atajo.hasta })}
              aria-pressed={activo}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                activo
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/70 bg-card text-foreground hover:border-primary/50 hover:text-primary',
              )}
            >
              {atajo.etiqueta}
            </button>
          )
        })}
        {!atajoActivo && !error && (
          <span className="rounded-full border border-dashed border-primary/60 px-3 py-1.5 text-xs font-medium text-primary">
            Personalizado
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="periodo-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="periodo-desde"
            type="date"
            value={valor.desde}
            max={valor.hasta || undefined}
            onChange={(evento) => onCambio({ ...valor, desde: evento.target.value })}
            className="w-40 cursor-pointer"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodo-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="periodo-hasta"
            type="date"
            value={valor.hasta}
            min={valor.desde || undefined}
            onChange={(evento) => onCambio({ ...valor, hasta: evento.target.value })}
            className="w-40 cursor-pointer"
          />
        </div>

        {error ? (
          <p className="flex items-center gap-1.5 pb-2 text-xs font-medium text-destructive">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">{describirRango(valor)}</span>
              {' · '}
              {dias} {dias === 1 ? 'día' : 'días'}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
