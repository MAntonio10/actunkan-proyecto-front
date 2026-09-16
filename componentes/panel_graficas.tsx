'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { MonoRoundedBarChart } from '@/components/mono-charts/mono-rounded-bar'
import { MonoRoundedDonutChart } from '@/components/mono-charts/mono-rounded-donut'
import { MonoRoundedLineChart } from '@/components/mono-charts/mono-rounded-line'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import {
  describirRango,
  formateadorDe,
  mensajeDeError,
  nombreDelMes,
  rangoDelMes,
} from '@/lib/formato_reporte'
import { cn } from '@/lib/utils'
import type { Dashboard, SerieDashboard } from '@/tipos'

/**
 * Panel de gráficas: cómo va el mes, de un vistazo.
 *
 * Son cuatro gráficas fijas —línea, pastel, barras y columnas— y siempre de un
 * mes calendario. El filtro de fechas libre vive en la pestaña de reportes
 * predeterminados; acá solo se cambia de mes, para que el panel se lea igual
 * cada vez que se abre.
 *
 * Todo llega hecho de `GET /reportes/dashboard`: las series, los totales exactos
 * y la comparación con el período anterior. Acá no se calcula ninguna cifra;
 * solo se elige qué series pintar. Es lo que garantiza que el panel y el PDF de
 * un reporte del mismo mes digan lo mismo.
 */

type FormaGrafica = 'linea' | 'pastel' | 'barras' | 'columnas'

/**
 * Qué serie del backend va en cada gráfica, en orden de preferencia.
 *
 * El backend arma una docena de series y el panel muestra cuatro. Se eligen por
 * `clave` y no por posición porque qué series llegan depende de los permisos:
 * sin `EmisionTickets.Ver` no llega ninguna de ventas, y entonces la línea cae
 * a las donaciones para que el panel no quede vacío.
 */
const GRAFICAS: Array<{ forma: FormaGrafica; candidatas: string[] }> = [
  { forma: 'linea', candidatas: ['ventas-por-periodo', 'donaciones-por-periodo'] },
  { forma: 'pastel', candidatas: ['personas-por-tipo'] },
  { forma: 'barras', candidatas: ['top-vendedores'] },
  { forma: 'columnas', candidatas: ['ventas-por-dia-semana'] },
]

/** Alto común del área de dibujo, para que las tarjetas de una fila se alineen. */
const ALTO_GRAFICA = 240

function TarjetaKpi({ kpi }: { kpi: Dashboard['kpis'][number] }) {
  const variacion = kpi.variacion
  const Icono =
    variacion?.direccion === 'sube'
      ? TrendingUp
      : variacion?.direccion === 'baja'
        ? TrendingDown
        : Minus

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <p className="text-xs text-muted-foreground">{kpi.etiqueta}</p>
      {/* Ya viene formateado del servidor: se pinta tal cual. */}
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{kpi.valor}</p>
      {variacion ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px]',
            variacion.direccion === 'sube'
              ? 'text-emerald-600 dark:text-emerald-400'
              : variacion.direccion === 'baja'
                ? 'text-destructive'
                : 'text-muted-foreground',
          )}
        >
          <Icono className="h-3 w-3 shrink-0" />
          <span className="font-medium tabular-nums">
            {(variacion.porcentaje * 100).toFixed(1)}%
          </span>
          <span className="truncate text-muted-foreground">{variacion.etiqueta}</span>
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sin período anterior con el que comparar
        </p>
      )}
    </div>
  )
}

function GraficaDelPanel({ forma, serie }: { forma: FormaGrafica; serie: SerieDashboard }) {
  const comunes = {
    data: serie.puntos.map((punto) => ({ label: punto.etiqueta, value: punto.valor })),
    title: serie.titulo,
    formatValue: formateadorDe(serie.formato),
    // El total viene exacto del servidor: nunca se obtiene sumando los puntos.
    summary: serie.total,
    summaryDetail: serie.unidad.toLowerCase(),
    height: ALTO_GRAFICA,
  }

  switch (forma) {
    case 'linea':
      return <MonoRoundedLineChart {...comunes} seriesName={serie.unidad} badge="Línea" />
    case 'pastel':
      // La leyenda con porcentajes ocupa una línea bajo el pastel.
      return (
        <MonoRoundedDonutChart
          {...comunes}
          variant="pie"
          badge="Pastel"
          height={ALTO_GRAFICA - 24}
        />
      )
    case 'barras':
      return (
        <MonoRoundedBarChart
          {...comunes}
          seriesName={serie.unidad}
          badge="Barras"
          defaultLayout="fila"
          layoutSwitch={false}
        />
      )
    case 'columnas':
      return (
        <MonoRoundedBarChart
          {...comunes}
          seriesName={serie.unidad}
          badge="Columnas"
          defaultLayout="columna"
          layoutSwitch={false}
          maxLabelLength={10}
        />
      )
  }
}

export function PanelGraficas() {
  const hoy = useMemo(() => new Date(), [])
  const [mes, setMes] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() })
  const [recarga, setRecarga] = useState(0)
  const [panel, setPanel] = useState<Dashboard | null>(null)
  const [cargando, setCargando] = useState(true)

  const esMesEnCurso = mes.anio === hoy.getFullYear() && mes.mes === hoy.getMonth()
  const rango = rangoDelMes(mes.anio, mes.mes)

  useEffect(() => {
    // Con `vigente`, pasar varios meses seguidos no deja que una respuesta
    // atrasada pinte un mes que ya no es el elegido.
    let vigente = true
    api.reportes
      // Grano fijo por día: la línea recorre el mes, no un solo punto mensual.
      .dashboard(`desde=${rango.desde}&hasta=${rango.hasta}&grano=dia`)
      .then((respuesta) => {
        if (vigente) setPanel(respuesta)
      })
      .catch((error: unknown) => {
        if (vigente) {
          toast.error('No se pudo cargar el panel', {
            description: mensajeDeError(error, 'Intente de nuevo en un momento.'),
          })
        }
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [rango.desde, rango.hasta, recarga])

  const irAlMes = (anio: number, numero: number) => {
    // `Date` normaliza el desborde: el mes 12 es enero del año siguiente.
    const fecha = new Date(anio, numero, 1)
    setCargando(true)
    setMes({ anio: fecha.getFullYear(), mes: fecha.getMonth() })
  }

  const recargar = () => {
    setCargando(true)
    setRecarga((numero) => numero + 1)
  }

  const graficas = useMemo(() => {
    if (!panel) return []
    return GRAFICAS.flatMap(({ forma, candidatas }) => {
      const serie = candidatas
        .map((clave) => panel.series.find((item) => item.clave === clave))
        .find((item): item is SerieDashboard => item !== undefined)
      return serie ? [{ forma, serie }] : []
    })
  }, [panel])

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card py-4">
        <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen mensual
              </p>
              <p className="truncate text-lg font-semibold leading-tight">
                {nombreDelMes(mes.anio, mes.mes)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {esMesEnCurso ? `Del ${describirRango(rango)} (hasta hoy)` : `Del ${describirRango(rango)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {!esMesEnCurso && (
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => irAlMes(hoy.getFullYear(), hoy.getMonth())}
              >
                Mes actual
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer"
              onClick={() => irAlMes(mes.anio, mes.mes - 1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer"
              onClick={() => irAlMes(mes.anio, mes.mes + 1)}
              disabled={esMesEnCurso}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={recargar}
              disabled={cargando}
              aria-label="Actualizar"
            >
              {cargando ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {cargando && !panel ? (
        <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5 text-primary" />
          Cargando el panel…
        </div>
      ) : !panel ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
            No se pudo cargar el panel.
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={recargar}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn('space-y-6 transition-opacity', cargando && 'opacity-60')}>
          {panel.kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {panel.kpis.map((kpi) => (
                <TarjetaKpi key={kpi.clave} kpi={kpi} />
              ))}
            </div>
          )}

          {/* Un panel que falta sin explicación se lee como una avería. */}
          {panel.omitidos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {panel.omitidos.map((omitido) => (
                <Badge
                  key={omitido.panel}
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-xs font-normal"
                  title={omitido.motivo}
                >
                  Sin «{omitido.panel}»: {omitido.motivo}
                </Badge>
              ))}
            </div>
          )}

          {graficas.length === 0 ? (
            <Card className="border-border/50 bg-card">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No hay ninguna gráfica disponible para su usuario en este mes.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {graficas.map(({ forma, serie }) => (
                <div key={forma} className="space-y-1.5">
                  <GraficaDelPanel forma={forma} serie={serie} />
                  {serie.descripcion && (
                    <p className="flex items-start gap-1 px-1 text-[11px] text-muted-foreground">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {serie.descripcion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Generado por {panel.generadoPor} el{' '}
            {panel.generadoEn.slice(0, 16).replace('T', ' ')}
          </p>
        </div>
      )}
    </div>
  )
}
