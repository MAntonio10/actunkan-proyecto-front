'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarRange,
  CheckCircle2,
  Eye,
  FileBarChart,
  FileDown,
  FileSpreadsheet,
  HandHeart,
  Lock,
  MousePointerClick,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Ticket,
  TreePine,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FiltrosReporte } from '@/componentes/filtros_reporte'
import { ResultadoReporteVista } from '@/componentes/resultado_reporte'
import { SelectorPeriodo } from '@/componentes/selector_periodo'
import { useDescargaReporte } from '@/hooks/use_descarga_reporte'
import { api } from '@/lib/api'
import {
  construirQueryReporte,
  describirRango,
  errorDeRango,
  filtrosIncompletos,
  mensajeDeError,
  rangoMesEnCurso,
  type RangoFechas,
} from '@/lib/formato_reporte'
import { cn, normalizarNombreModulo } from '@/lib/utils'
import type {
  DefinicionReporte,
  RespuestaCatalogoReportes,
  ResultadoReporte,
  ValoresFiltrosReporte,
} from '@/tipos'

/**
 * Reportes predeterminados: período, reporte y archivo, en ese orden.
 *
 * El recorrido está pensado para quien solo quiere el PDF o el Excel: elige el
 * período una vez, toca un reporte y lo descarga. La vista en pantalla queda
 * como paso opcional, no como requisito para descargar.
 *
 * Las reglas de siempre (REPORTES_FRONTEND.md) siguen en pie:
 *  - La lista sale de `GET /reportes`, que ya viene filtrado por permisos; una
 *    lista escrita acá ofrecería reportes que responden 403.
 *  - La query se arma con los `parametros` que declara cada reporte
 *    (`construirQueryReporte`): el período se vuelca en los del filtro
 *    `rangoFechas`, y los reportes que no lo declaran —usuarios, arqueo— no
 *    lo reciben, porque un parámetro no declarado es un 400.
 */

const ORDEN_CATEGORIAS = ['Tickets', 'Cajas', 'Donaciones', 'Bitácora', 'Usuarios', 'Actividades']

const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  Tickets: Ticket,
  Cajas: Wallet,
  Donaciones: HandHeart,
  Bitácora: ScrollText,
  Usuarios: Users,
  Actividades: TreePine,
}

/** Una categoría que el backend agregue después va al final, no al principio. */
function posicionCategoria(categoria: string): number {
  const posicion = ORDEN_CATEGORIAS.indexOf(categoria)
  return posicion === -1 ? ORDEN_CATEGORIAS.length : posicion
}

function iconoDe(categoria: string): LucideIcon {
  return ICONO_CATEGORIA[categoria] ?? FileBarChart
}

function agruparPorCategoria(reportes: DefinicionReporte[]) {
  const grupos = new Map<string, DefinicionReporte[]>()
  for (const reporte of reportes) {
    const lista = grupos.get(reporte.categoria) ?? []
    lista.push(reporte)
    grupos.set(reporte.categoria, lista)
  }
  return [...grupos.entries()].sort(
    (a, b) => posicionCategoria(a[0]) - posicionCategoria(b[0]),
  )
}

function EncabezadoPaso({
  numero,
  titulo,
  descripcion,
}: {
  numero: number
  titulo: string
  descripcion?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
        {numero}
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{titulo}</p>
        {descripcion && <p className="text-xs text-muted-foreground">{descripcion}</p>}
      </div>
    </div>
  )
}

function TarjetaReporte({
  reporte,
  seleccionado,
  onElegir,
}: {
  reporte: DefinicionReporte
  seleccionado: boolean
  onElegir: () => void
}) {
  const Icono = iconoDe(reporte.categoria)
  const usaPeriodo = reporte.filtros.some((filtro) => filtro.tipo === 'rangoFechas')

  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={seleccionado}
      className={cn(
        'group relative flex h-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-all',
        seleccionado
          ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/25'
          : 'border-border/60 bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-md',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          seleccionado
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary/10 text-primary group-hover:bg-primary/15',
        )}
      >
        <Icono className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block pr-5 text-sm font-semibold leading-tight">{reporte.titulo}</span>
        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
          {reporte.descripcion}
        </span>
        {(reporte.soloSupervisor || !usaPeriodo) && (
          <span className="mt-2 flex flex-wrap gap-1">
            {reporte.soloSupervisor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                <ShieldCheck className="h-3 w-3" />
                Solo supervisor
              </span>
            )}
            {!usaPeriodo && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Sin período
              </span>
            )}
          </span>
        )}
      </span>
      {seleccionado && (
        <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-primary" />
      )}
    </button>
  )
}

function BotonFormato({
  formato,
  onClick,
  deshabilitado,
  descargando,
}: {
  formato: 'pdf' | 'excel'
  onClick: () => void
  deshabilitado: boolean
  descargando: boolean
}) {
  const esPdf = formato === 'pdf'
  const Icono = esPdf ? FileDown : FileSpreadsheet

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50',
        esPdf
          ? 'border-red-500/30 bg-red-500/5 text-red-700 enabled:hover:border-red-500/60 enabled:hover:bg-red-500/10 dark:text-red-400'
          : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 enabled:hover:border-emerald-500/60 enabled:hover:bg-emerald-500/10 dark:text-emerald-400',
      )}
    >
      {descargando ? <Spinner className="h-6 w-6" /> : <Icono className="h-6 w-6" />}
      <span className="text-sm font-semibold">{esPdf ? 'Descargar PDF' : 'Descargar Excel'}</span>
      <span className="text-[10px] opacity-80">
        {esPdf ? 'Para imprimir o archivar' : 'Para filtrar y sumar'}
      </span>
    </button>
  )
}

export function ReportesPredeterminados({
  catalogo,
  puedeExportar,
}: {
  catalogo: RespuestaCatalogoReportes
  /** Sin `Reportes.Exportar` solo se ofrece la vista en pantalla. */
  puedeExportar: boolean
}) {
  // El mes en curso es lo que el backend asume sin fechas: así el formulario
  // muestra lo que va a pedir en vez de un comportamiento implícito.
  const [periodo, setPeriodo] = useState<RangoFechas>(rangoMesEnCurso)
  const [categoria, setCategoria] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [claveSeleccionada, setClaveSeleccionada] = useState<string | null>(null)
  /**
   * Filtros propios de los reportes, por nombre de parámetro. Sobreviven al
   * cambio de reporte: los de venta comparten los mismos siete, y quien fijó
   * un vendedor espera verlo puesto en el siguiente. No se cuelan donde no
   * corresponde porque la query solo lleva lo que el reporte declara.
   */
  const [valores, setValores] = useState<ValoresFiltrosReporte>({})

  const [vistaPrevia, setVistaPrevia] = useState<{
    clave: string
    query: string
    resultado: ResultadoReporte
  } | null>(null)
  const [generando, setGenerando] = useState(false)
  const { descargar, descargando } = useDescargaReporte()

  const panelRef = useRef<HTMLDivElement>(null)
  const vistaRef = useRef<HTMLDivElement>(null)

  const definicion = useMemo(
    () => catalogo.datos.find((item) => item.clave === claveSeleccionada) ?? null,
    [catalogo, claveSeleccionada],
  )
  const filtroPeriodo = definicion?.filtros.find((filtro) => filtro.tipo === 'rangoFechas')

  /**
   * Los valores con el período volcado en los parámetros del reporte. Se usan
   * los `parametros` de su filtro de rango y no `desde`/`hasta` escritos a
   * mano: es lo que dice el contrato.
   */
  const valoresCompletos = useMemo(() => {
    if (!filtroPeriodo) return valores
    const [desde, hasta] = filtroPeriodo.parametros
    return { ...valores, [desde]: periodo.desde, [hasta]: periodo.hasta }
  }, [valores, filtroPeriodo, periodo])

  const errorPeriodo = filtroPeriodo ? errorDeRango(periodo) : null
  const faltantes = definicion ? filtrosIncompletos(definicion, valoresCompletos) : []
  const listo = definicion !== null && !errorPeriodo && faltantes.length === 0
  const query = definicion ? construirQueryReporte(definicion, valoresCompletos) : ''

  // La vista previa es la del reporte y los filtros de ahora; si algo cambió,
  // se ofrece actualizarla en vez de mostrar cifras que ya no corresponden a
  // lo que bajarían los botones.
  const vistaVigente =
    vistaPrevia !== null && vistaPrevia.clave === definicion?.clave && vistaPrevia.query === query
  const vistaDesactualizada =
    vistaPrevia !== null && vistaPrevia.clave === definicion?.clave && !vistaVigente

  useEffect(() => {
    if (vistaPrevia) vistaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [vistaPrevia])

  const conteoPorCategoria = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const reporte of catalogo.datos) {
      conteo.set(reporte.categoria, (conteo.get(reporte.categoria) ?? 0) + 1)
    }
    return [...conteo.entries()].sort((a, b) => posicionCategoria(a[0]) - posicionCategoria(b[0]))
  }, [catalogo])

  const grupos = useMemo(() => {
    const termino = normalizarNombreModulo(busqueda)
    const visibles = catalogo.datos.filter(
      (reporte) =>
        (!categoria || reporte.categoria === categoria) &&
        (!termino ||
          normalizarNombreModulo(
            `${reporte.titulo} ${reporte.descripcion} ${reporte.categoria}`,
          ).includes(termino)),
    )
    return agruparPorCategoria(visibles)
  }, [catalogo, categoria, busqueda])

  /**
   * Deja el paso 3 —y sus botones de descarga— a la vista. En pantallas
   * angostas queda debajo de la lista y se lleva la vista hasta su inicio; en
   * escritorio está al lado, y `nearest` solo desplaza lo justo para que asome
   * su pie cuando quedaba bajo el borde (después el panel se queda fijo).
   */
  const mostrarPanel = useCallback((soloEnEscritorio: boolean) => {
    const angosta = window.matchMedia('(max-width: 1023px)').matches
    if (angosta && soloEnEscritorio) return
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: angosta ? 'start' : 'nearest',
      }),
    )
  }, [])

  const seleccionar = useCallback(
    (reporte: DefinicionReporte) => {
      setClaveSeleccionada(reporte.clave)
      mostrarPanel(false)
    },
    [mostrarPanel],
  )

  const cambiarValor = useCallback((nombre: string, valor: string) => {
    setValores((previos) => ({ ...previos, [nombre]: valor }))
  }, [])

  const verEnPantalla = useCallback(async () => {
    if (!definicion || !listo || generando) return
    setGenerando(true)
    try {
      const resultado = await api.reportes.generar(definicion.clave, query)
      setVistaPrevia({ clave: definicion.clave, query, resultado })
    } catch (error: unknown) {
      // El mensaje se muestra íntegro: un 422 trae los candidatos cuando un
      // nombre resulta ambiguo, y un 400 dice exactamente qué corregir.
      toast.error('No se pudo generar el reporte', {
        description: mensajeDeError(error, 'Revise los filtros e intente de nuevo.'),
      })
    } finally {
      setGenerando(false)
    }
  }, [definicion, listo, generando, query])

  const descargarArchivo = useCallback(
    (formato: 'pdf' | 'excel') => {
      if (!definicion || !listo) return
      const sufijo = filtroPeriodo ? `-${periodo.desde}-a-${periodo.hasta}` : ''
      void descargar(
        formato,
        () => api.reportes.descargar(definicion.clave, formato, query),
        `${definicion.clave}${sufijo}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`,
      )
    },
    [definicion, listo, filtroPeriodo, periodo, query, descargar],
  )

  const IconoSeleccionado = definicion ? iconoDe(definicion.categoria) : FileBarChart

  return (
    <div className="space-y-6">
      <Card className="gap-4 border-border/50 bg-card">
        <CardHeader>
          <EncabezadoPaso
            numero={1}
            titulo="Elija el período"
            descripcion="Vale para cualquier reporte que genere después."
          />
        </CardHeader>
        <CardContent>
          <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="gap-4 border-border/50 bg-card">
          <CardHeader>
            <EncabezadoPaso
              numero={2}
              titulo="Elija el reporte"
              descripcion={`${catalogo.total} disponibles para su usuario`}
            />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorías">
                {[
                  { clave: null, etiqueta: 'Todos', cantidad: catalogo.datos.length },
                  ...conteoPorCategoria.map(([nombre, cantidad]) => ({
                    clave: nombre,
                    etiqueta: nombre,
                    cantidad,
                  })),
                ].map((opcion) => {
                  const activo = categoria === opcion.clave
                  const Icono = opcion.clave ? iconoDe(opcion.clave) : null
                  return (
                    <button
                      key={opcion.etiqueta}
                      type="button"
                      onClick={() => setCategoria(opcion.clave)}
                      aria-pressed={activo}
                      className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        activo
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border/70 bg-card hover:border-primary/50 hover:text-primary',
                      )}
                    >
                      {Icono && <Icono className="h-3.5 w-3.5" />}
                      {opcion.etiqueta}
                      <span className="tabular-nums opacity-70">{opcion.cantidad}</span>
                    </button>
                  )
                })}
              </div>
              <div className="relative xl:w-60">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar reporte…"
                  className="pl-8"
                  aria-label="Buscar reporte"
                />
              </div>
            </div>

            {grupos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ningún reporte coincide con la búsqueda.
              </p>
            ) : (
              grupos.map(([nombre, reportes]) => {
                const Icono = iconoDe(nombre)
                return (
                  <section key={nombre} className="space-y-2">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Icono className="h-3.5 w-3.5" />
                      {nombre}
                      <span className="font-normal">· {reportes.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                      {reportes.map((reporte) => (
                        <TarjetaReporte
                          key={reporte.clave}
                          reporte={reporte}
                          seleccionado={reporte.clave === claveSeleccionada}
                          onElegir={() => seleccionar(reporte)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })
            )}
          </CardContent>
        </Card>

        <div ref={panelRef} className="scroll-mt-24 lg:sticky lg:top-24">
          {/* En escritorio el panel acompaña al scroll y tiene alto tope: los
              filtros se desplazan por dentro y los botones quedan fijos al pie,
              a la vista aunque se abran los siete filtros de venta. */}
          <Card className="gap-0 border-border/50 bg-card py-0 lg:max-h-[calc(100vh-7rem)]">
            <CardHeader className="pb-4 pt-6">
              <EncabezadoPaso numero={3} titulo="Genere su reporte" />
            </CardHeader>
            <CardContent className="space-y-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {!definicion ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MousePointerClick className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="font-medium">Elija un reporte de la lista</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verá aquí sus filtros y podrá descargarlo en PDF o Excel.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                      <IconoSeleccionado className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{definicion.titulo}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {definicion.categoria}
                        </Badge>
                        {definicion.soloSupervisor && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
                          >
                            Solo supervisor
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{definicion.descripcion}</p>

                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                      errorPeriodo
                        ? 'border-destructive/40 bg-destructive/5 text-destructive'
                        : 'border-primary/25 bg-primary/5',
                    )}
                  >
                    <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {!filtroPeriodo ? (
                      <span className="text-muted-foreground">
                        Este reporte no usa el período: muestra la información vigente.
                      </span>
                    ) : errorPeriodo ? (
                      <span>Revise el período (paso 1): {errorPeriodo}</span>
                    ) : (
                      <span>
                        <span className="text-muted-foreground">Período: </span>
                        <span className="font-medium">{describirRango(periodo)}</span>
                      </span>
                    )}
                  </div>

                  <FiltrosReporte
                    key={definicion.clave}
                    definicion={definicion}
                    valores={valores}
                    onCambio={cambiarValor}
                    onLimpiar={() => setValores({})}
                    // Desplegar los opcionales alarga el panel: se vuelve a
                    // traer su pie a la vista. En móvil no, porque ahí el panel
                    // no es fijo y saltaría al inicio de lo que se acaba de abrir.
                    onDesplegar={() => mostrarPanel(true)}
                  />

                  {!errorPeriodo && faltantes.length > 0 && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Falta completar: {faltantes.join(', ')}.
                    </p>
                  )}
                </>
              )}
            </CardContent>

            {definicion && (
              <div className="space-y-2 border-t border-border/50 px-6 py-4">
                {puedeExportar ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <BotonFormato
                        formato="pdf"
                        onClick={() => descargarArchivo('pdf')}
                        deshabilitado={!listo || descargando !== null}
                        descargando={descargando === 'pdf'}
                      />
                      <BotonFormato
                        formato="excel"
                        onClick={() => descargarArchivo('excel')}
                        deshabilitado={!listo || descargando !== null}
                        descargando={descargando === 'excel'}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer gap-2"
                      onClick={verEnPantalla}
                      disabled={!listo || generando}
                    >
                      {generando ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      Ver en pantalla
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="h-11 w-full cursor-pointer gap-2"
                      onClick={verEnPantalla}
                      disabled={!listo || generando}
                    >
                      {generando ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      Ver reporte en pantalla
                    </Button>
                    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      Para descargar en PDF o Excel hace falta el permiso Exportar del módulo
                      Reportes.
                    </p>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div ref={vistaRef} className="scroll-mt-24 space-y-4">
        {generando && !vistaVigente && (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
            <Spinner className="h-5 w-5 text-primary" />
            Generando la vista previa…
          </div>
        )}

        {vistaDesactualizada && !generando && (
          <Card className="border-dashed border-primary/40 bg-primary/5 py-4">
            <CardContent className="flex flex-col items-start gap-3 px-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>Cambió el período o algún filtro desde la última vista previa.</span>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer gap-2"
                onClick={verEnPantalla}
                disabled={!listo}
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar vista previa
              </Button>
            </CardContent>
          </Card>
        )}

        {vistaVigente && vistaPrevia && (
          <ResultadoReporteVista
            reporte={vistaPrevia.resultado}
            descargando={descargando}
            onDescargar={puedeExportar ? descargarArchivo : undefined}
          />
        )}
      </div>
    </div>
  )
}
