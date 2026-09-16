'use client'

import { CalendarRange, FileDown, FileSpreadsheet, TriangleAlert, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { GraficasReporte } from '@/componentes/graficas_reporte'
import { TablaReporte } from '@/componentes/tabla_reporte'
import type { ResultadoReporte } from '@/tipos'

/**
 * Un reporte ya ejecutado, con sus indicadores, gráficas y tablas.
 *
 * Lo comparten las dos vías: la del catálogo y la petición escrita, porque el
 * `resultado` que devuelve `/reportes/interpretar` es exactamente el mismo
 * objeto de `/reportes/:clave`.
 *
 * Dos cosas que no hay que "mejorar":
 *  - Los KPIs se pintan tal cual. Ya vienen formateados por el backend, con la
 *    misma función que imprime el PDF; reformatearlos acá los desalinearía del
 *    documento que el usuario archiva.
 *  - Se recorren **todas** las secciones. Seis reportes traen más de una tabla
 *    (atracción, origen, donaciones, bitácora, sectores, arqueo) y quedarse con
 *    la primera esconde justo el desglose por el que se pidió el reporte.
 */
export function ResultadoReporteVista({
  reporte,
  onDescargar,
  descargando = null,
  formatoDestacado,
}: {
  reporte: ResultadoReporte
  /** Sin esto no se pintan los botones: el usuario no tiene `Reportes.Exportar`. */
  onDescargar?: (formato: 'pdf' | 'excel') => void
  descargando?: 'pdf' | 'excel' | null
  /** El formato que pidió la petición escrita (`formato` de `/interpretar`). */
  formatoDestacado?: 'pdf' | 'excel'
}) {
  const notas = reporte.notas ?? []
  // Cuando se truncó, la primera nota es el motivo y se muestra destacada
  // arriba; repetirla al pie sería decir dos veces lo mismo.
  const notasAlPie = reporte.truncado ? notas.slice(1) : notas

  return (
    <div className="space-y-5">
      <Card className="bg-card border-border/50">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{reporte.titulo}</CardTitle>
              {reporte.subtitulo && <CardDescription>{reporte.subtitulo}</CardDescription>}
              {reporte.periodo && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                  {reporte.periodo.etiqueta}
                </p>
              )}
            </div>

            {onDescargar && (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant={formatoDestacado === 'pdf' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 cursor-pointer"
                  onClick={() => onDescargar('pdf')}
                  disabled={descargando !== null}
                >
                  {descargando === 'pdf' ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant={formatoDestacado === 'excel' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 cursor-pointer"
                  onClick={() => onDescargar('excel')}
                  disabled={descargando !== null}
                >
                  {descargando === 'excel' ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Excel
                </Button>
              </div>
            )}
          </div>

          {reporte.filtrosAplicados.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {reporte.filtrosAplicados.map((filtro) => (
                <Badge
                  key={`${filtro.etiqueta}-${filtro.valor}`}
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-xs font-normal"
                >
                  <span className="text-muted-foreground">{filtro.etiqueta}:</span>
                  <span className="ml-1 font-medium">{filtro.valor}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        {reporte.kpis.length > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {reporte.kpis.map((kpi) => (
                <div
                  key={kpi.etiqueta}
                  className="rounded-xl border border-border/50 bg-muted/30 p-3"
                >
                  <p className="text-xs text-muted-foreground">{kpi.etiqueta}</p>
                  {/* Ya viene formateado desde el backend: no se reformatea. */}
                  <p className="mt-0.5 text-xl font-bold tabular-nums">{kpi.valor}</p>
                  {kpi.detalle && (
                    <p className="text-[11px] text-muted-foreground">{kpi.detalle}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {reporte.truncado && notas[0] && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{notas[0]}</p>
            {onDescargar && (
              <p className="mt-1 text-xs opacity-90">
                El Excel admite diez veces más filas que esta vista: descárguelo si necesita
                el detalle completo.
              </p>
            )}
          </div>
        </div>
      )}

      {reporte.secciones.map((seccion, indice) => (
        <Card key={indice} className="bg-card border-border/50">
          {(seccion.titulo || seccion.descripcion) && (
            <CardHeader>
              {seccion.titulo && <CardTitle className="text-base">{seccion.titulo}</CardTitle>}
              {seccion.descripcion && <CardDescription>{seccion.descripcion}</CardDescription>}
            </CardHeader>
          )}
          <CardContent className="space-y-4">
            <GraficasReporte seccion={seccion} />
            <TablaReporte seccion={seccion} />
            {seccion.filasDisponibles !== undefined &&
              seccion.filasDisponibles > seccion.filas.length && (
                <p className="text-xs text-muted-foreground">
                  Se muestran {seccion.filas.length} de {seccion.filasDisponibles} filas.
                </p>
              )}
          </CardContent>
        </Card>
      ))}

      {notasAlPie.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {notasAlPie.map((nota, indice) => (
            <li key={indice}>· {nota}</li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="h-3 w-3" />
        Generado por {reporte.generadoPor} el{' '}
        {reporte.generadoEn.slice(0, 16).replace('T', ' ')}
      </p>
    </div>
  )
}
