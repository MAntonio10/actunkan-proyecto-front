'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Eraser,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type {
  CatalogosTickets,
  DefinicionReporte,
  EsquemaFiltroReporte,
  TipoFiltroReporte,
  ValoresFiltrosReporte,
} from '@/tipos'

/**
 * Filtros propios de un reporte, armados desde el catálogo.
 *
 * Cada entrada de `definicion.filtros` describe un control, y lo que viaja en
 * la URL son sus `parametros`, no su `clave`. Por eso el estado se indexa por
 * nombre de parámetro y no por control.
 *
 * El rango de fechas no se dibuja acá: es un solo período para todo el
 * catálogo (`componentes/selector_periodo.tsx`), y quien arma la query lo
 * vuelca en los `parametros` del filtro `rangoFechas` de cada reporte.
 *
 * Los obligatorios van siempre a la vista; los opcionales, cuando son muchos
 * —los de venta son siete—, se pliegan para que elegir un reporte y
 * descargarlo no exija recorrer un formulario entero.
 *
 * Los combos se alimentan de los catálogos que ya usa el resto de la
 * aplicación. Si alguno responde 403 —un usuario puede tener `Reportes.Ver` sin
 * `Usuarios.Ver`— el control **no desaparece**: cae a un campo de texto, que la
 * API resuelve por coincidencia parcial del nombre. Perder el filtro entero por
 * no poder listar sus opciones sería peor que escribirlo a mano.
 */

// Un catálogo por sesión de pantalla: cambiar de reporte no vuelve a pedirlos.
let cacheCatalogos: Promise<CatalogosTickets> | null = null
let cacheUsuarios: Promise<Array<{ valor: string; etiqueta: string }>> | null = null
let cacheCajas: Promise<Array<{ valor: string; etiqueta: string }>> | null = null
let cacheSectores: Promise<Array<{ valor: string; etiqueta: string }>> | null = null

interface Opcion {
  valor: string
  etiqueta: string
}

function catalogosTickets(): Promise<CatalogosTickets> {
  cacheCatalogos ??= api.tickets.getCatalogos()
  return cacheCatalogos
}

const desdeCatalogo = (
  seleccionar: (catalogos: CatalogosTickets) => Array<{ id: number; nombre: string }>,
) => async (): Promise<Opcion[]> => {
  const catalogos = await catalogosTickets()
  return seleccionar(catalogos).map((item) => ({
    valor: String(item.id),
    etiqueta: item.nombre,
  }))
}

/**
 * Estos listados vienen paginados. Un combo no se pagina: se pide el tope del
 * backend de una vez. Con el `limite` por omisión (50) el día que haya más
 * usuarios o más turnos el combo empezaría a esconder opciones sin avisar, y
 * un filtro que no ofrece el valor buscado no se ve como un error.
 */
const TOPE_COMBO = 200

/** Qué carga cada tipo de filtro. `null` = no es un combo. */
const CARGADORES: Partial<Record<TipoFiltroReporte, () => Promise<Opcion[]>>> = {
  usuario: () => {
    cacheUsuarios ??= api.usuarios
      .getUsuarios(false, { limite: TOPE_COMBO })
      .then((res) =>
        res.datos.map((usuario) => ({
          valor: String(usuario.id),
          etiqueta: usuario.nombre,
        })),
      )
      .catch((error) => {
        cacheUsuarios = null
        throw error
      })
    return cacheUsuarios
  },
  atraccion: desdeCatalogo((c) => c.atracciones),
  origen: desdeCatalogo((c) => c.origenes),
  pais: desdeCatalogo((c) => c.paises),
  guia: desdeCatalogo((c) => c.guias),
  tipoVisitante: desdeCatalogo((c) => c.tiposVisitante),
  tipoRecorrido: desdeCatalogo((c) => c.tiposRecorrido),
  opcionPago: desdeCatalogo((c) => c.opcionesPago),
  aperturaCaja: () => {
    cacheCajas ??= api.cajas
      .listar({ limite: TOPE_COMBO })
      .then((res) =>
        res.datos.map((caja) => ({
          valor: String(caja.id),
          etiqueta: `Turno ${caja.id} · ${caja.usuario?.nombre ?? 'Sin usuario'} · ${String(
            caja.fechaCreacion,
          ).slice(0, 10)}`,
        })),
      )
      .catch((error) => {
        cacheCajas = null
        throw error
      })
    return cacheCajas
  },
  sector: () => {
    cacheSectores ??= api.sectores
      .listar()
      .then((sectores) =>
        sectores.map((sector) => ({ valor: String(sector.id), etiqueta: sector.nombre })),
      )
      .catch((error) => {
        cacheSectores = null
        throw error
      })
    return cacheSectores
  },
}

/** Valor centinela: Radix no admite un `SelectItem` con valor vacío. */
const SIN_FILTRO = '__todos__'
/** A partir de aquí el combo se busca en vez de recorrerse (países, guías). */
const UMBRAL_BUSQUEDA = 12

function useOpciones(tipo: TipoFiltroReporte) {
  const [opciones, setOpciones] = useState<Opcion[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const cargador = CARGADORES[tipo]
    if (!cargador) return

    let vigente = true
    setError(false)
    cargador()
      .then((lista) => {
        if (vigente) setOpciones(lista)
      })
      .catch(() => {
        // Sin permiso para listar el catálogo: el control cae a texto libre.
        if (vigente) setError(true)
      })
    return () => {
      vigente = false
    }
  }, [tipo])

  return { opciones, error, cargando: opciones === null && !error }
}

function ComboBuscable({
  opciones,
  valor,
  onCambio,
  etiqueta,
  requerido = false,
}: {
  opciones: Opcion[]
  valor: string
  onCambio: (valor: string) => void
  etiqueta: string
  requerido?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const seleccionada = opciones.find((opcion) => opcion.valor === valor)

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          className="w-full justify-between font-normal cursor-pointer"
        >
          <span className={cn('truncate', !seleccionada && 'text-muted-foreground')}>
            {seleccionada?.etiqueta ?? (requerido ? 'Elija una opción' : 'Todos')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${etiqueta.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Sin coincidencias.</CommandEmpty>
            <CommandGroup>
              {!requerido && (
                <CommandItem
                  value="Todos"
                  onSelect={() => {
                    onCambio('')
                    setAbierto(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', valor ? 'opacity-0' : 'opacity-100')} />
                  Todos
                </CommandItem>
              )}
              {opciones.map((opcion) => (
                <CommandItem
                  key={opcion.valor}
                  value={opcion.etiqueta}
                  onSelect={() => {
                    onCambio(opcion.valor)
                    setAbierto(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      valor === opcion.valor ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opcion.etiqueta}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ControlFiltro({
  filtro,
  valores,
  onCambio,
}: {
  filtro: EsquemaFiltroReporte
  valores: ValoresFiltrosReporte
  onCambio: (nombre: string, valor: string) => void
}) {
  const { opciones, error, cargando } = useOpciones(filtro.tipo)
  const nombre = filtro.parametros[0]

  // Lista cerrada: las opciones vienen en el propio catálogo, así que este
  // control no sabe —ni tiene por qué saber— qué es una dimensión.
  if (filtro.tipo === 'opciones' && filtro.opciones) {
    return (
      <CampoFiltro filtro={filtro} htmlFor={nombre}>
        <Select
          value={valores[nombre] || SIN_FILTRO}
          onValueChange={(valor) => onCambio(nombre, valor === SIN_FILTRO ? '' : valor)}
        >
          <SelectTrigger id={nombre} className="w-full cursor-pointer">
            <SelectValue placeholder={filtro.requerido ? 'Elija una opción' : 'Todos'} />
          </SelectTrigger>
          <SelectContent>
            {!filtro.requerido && <SelectItem value={SIN_FILTRO}>Ninguna</SelectItem>}
            {filtro.opciones.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CampoFiltro>
    )
  }

  if (filtro.tipo === 'numero') {
    return (
      <CampoFiltro filtro={filtro} htmlFor={nombre}>
        <Input
          id={nombre}
          type="number"
          min={1}
          inputMode="numeric"
          value={valores[nombre] ?? ''}
          onChange={(evento) => onCambio(nombre, evento.target.value)}
          placeholder="Todas"
        />
      </CampoFiltro>
    )
  }

  if (filtro.tipo === 'booleano') {
    return (
      <div className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={nombre} className="cursor-pointer text-xs font-medium">
            {filtro.etiqueta}
          </Label>
          <Switch
            id={nombre}
            checked={valores[nombre] === 'true'}
            onCheckedChange={(activo) => onCambio(nombre, activo ? 'true' : '')}
            className="cursor-pointer"
          />
        </div>
        <AyudaFiltro texto={filtro.descripcion} />
      </div>
    )
  }

  const esTextoLibre = filtro.tipo === 'modulo' || filtro.tipo === 'accion' || error

  return (
    <CampoFiltro filtro={filtro} htmlFor={nombre}>
      {esTextoLibre ? (
        <div className="relative">
          <Input
            id={nombre}
            value={valores[nombre] ?? ''}
            onChange={(evento) => onCambio(nombre, evento.target.value)}
            placeholder={error ? 'Escriba el nombre' : 'Todos'}
            className={error ? 'pl-8' : undefined}
          />
          {error && (
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      ) : cargando ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 px-3 text-xs text-muted-foreground">
          <Spinner className="h-3.5 w-3.5" />
          Cargando…
        </div>
      ) : (opciones?.length ?? 0) > UMBRAL_BUSQUEDA ? (
        <ComboBuscable
          opciones={opciones ?? []}
          valor={valores[nombre] ?? ''}
          onCambio={(valor) => onCambio(nombre, valor)}
          etiqueta={filtro.etiqueta}
          requerido={filtro.requerido}
        />
      ) : (
        <Select
          value={valores[nombre] || (filtro.requerido ? '' : SIN_FILTRO)}
          onValueChange={(valor) => onCambio(nombre, valor === SIN_FILTRO ? '' : valor)}
        >
          <SelectTrigger id={nombre} className="w-full cursor-pointer">
            <SelectValue placeholder={filtro.requerido ? 'Elija una opción' : 'Todos'} />
          </SelectTrigger>
          <SelectContent>
            {/* «Todos» en un filtro obligatorio sería una opción que la API rechaza. */}
            {!filtro.requerido && <SelectItem value={SIN_FILTRO}>Todos</SelectItem>}
            {(opciones ?? []).map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </CampoFiltro>
  )
}

/**
 * La descripción del catálogo, como ayuda bajo el control. Está escrita
 * también para que la IA elija filtros, así que puede ser larga: se recorta a
 * dos líneas y el texto entero queda en el `title`.
 */
function AyudaFiltro({ texto }: { texto?: string }) {
  if (!texto) return null
  return (
    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground" title={texto}>
      {texto}
    </p>
  )
}

function CampoFiltro({
  filtro,
  htmlFor,
  children,
}: {
  filtro: EsquemaFiltroReporte
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="gap-0.5 text-xs font-medium">
        {filtro.etiqueta}
        {filtro.requerido && <span className="text-destructive">*</span>}
      </Label>
      {children}
      <AyudaFiltro texto={filtro.descripcion} />
    </div>
  )
}

/** Con más opcionales que estos, se pliegan bajo un solo encabezado. */
const MAXIMO_OPCIONALES_A_LA_VISTA = 3

export function FiltrosReporte({
  definicion,
  valores,
  onCambio,
  onLimpiar,
  onDesplegar,
}: {
  definicion: DefinicionReporte
  valores: ValoresFiltrosReporte
  onCambio: (nombre: string, valor: string) => void
  onLimpiar: () => void
  /** Se llama al abrir los filtros opcionales plegados. */
  onDesplegar?: () => void
}) {
  const filtros = definicion.filtros.filter((filtro) => filtro.tipo !== 'rangoFechas')
  const requeridos = filtros.filter((filtro) => filtro.requerido)
  const opcionales = filtros.filter((filtro) => !filtro.requerido)
  const activos = opcionales.filter((filtro) =>
    filtro.parametros.some((nombre) => valores[nombre]),
  ).length
  const plegar = opcionales.length > MAXIMO_OPCIONALES_A_LA_VISTA
  // Arranca abierto si ya hay alguno puesto: esconder un filtro activo haría
  // creer que el reporte sale sin él.
  const [abierto, setAbierto] = useState(activos > 0)

  if (filtros.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
        Este reporte no tiene filtros adicionales.
      </p>
    )
  }

  const controles = (lista: EsquemaFiltroReporte[]) => (
    <div className="grid grid-cols-1 gap-3">
      {lista.map((filtro) => (
        <ControlFiltro
          key={filtro.clave}
          filtro={filtro}
          valores={valores}
          onCambio={onCambio}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-3">
      {requeridos.length > 0 && controles(requeridos)}

      {opcionales.length > 0 &&
        (plegar ? (
          <Collapsible
            open={abierto}
            onOpenChange={(abrir) => {
              setAbierto(abrir)
              if (abrir) onDesplegar?.()
            }}
            className="rounded-xl border border-border/60 bg-muted/20"
          >
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left">
              <span className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filtros opcionales
                <span className="text-xs font-normal text-muted-foreground">
                  ({opcionales.length})
                </span>
              </span>
              <span className="flex items-center gap-2">
                {activos > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {activos} {activos === 1 ? 'activo' : 'activos'}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    abierto && 'rotate-180',
                  )}
                />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border/50 p-3">
              {controles(opcionales)}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          controles(opcionales)
        ))}

      {activos > 0 && (
        <button
          type="button"
          onClick={onLimpiar}
          className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          <Eraser className="h-3.5 w-3.5" />
          Quitar todos los filtros
        </button>
      )}
    </div>
  )
}
