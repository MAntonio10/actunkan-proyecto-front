'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  History, 
  Search, 
  Filter, 
  Download,
  LogIn,
  LogOut,
  Ticket,
  XCircle,
  Calculator,
  RefreshCw,
  ShieldAlert,
  ArrowUpDown,
  Users,
  Activity,
  UserCheck,
  Key,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { api } from '@/lib/api'
import { exportarBitacoraAExcel } from '@/lib/exportar_bitacora'
import { Paginador } from '@/componentes/paginador'
import { TarjetaEstadistica } from '@/componentes/tarjeta_estadistica'
import { type BitacoraBackend } from '@/tipos'
import { formatearFechaApi } from '@/lib/fecha_guatemala'

const OBTENER_ICONO_ACCION = (accion: string): React.ReactNode => {
  const accUpper = (accion || '').toUpperCase()
  if (accUpper.includes('INICIO') || accUpper.includes('LOGIN')) {
    return <LogIn className="h-4 w-4 text-emerald-500" />
  }
  if (accUpper.includes('CIERRE_SESION') || accUpper.includes('LOGOUT')) {
    return <LogOut className="h-4 w-4 text-amber-500" />
  }
  if (accUpper.includes('CREAR')) {
    return <UserCheck className="h-4 w-4 text-blue-500" />
  }
  if (accUpper.includes('EDITAR') || accUpper.includes('ACTUALIZAR')) {
    return <RefreshCw className="h-4 w-4 text-cyan-500" />
  }
  if (accUpper.includes('ANULAR') || accUpper.includes('DESACTIVAR') || accUpper.includes('ELIMINAR')) {
    return <XCircle className="h-4 w-4 text-destructive" />
  }
  if (accUpper.includes('PERMISOS')) {
    return <Key className="h-4 w-4 text-amber-500" />
  }
  if (accUpper.includes('TICKET')) {
    return <Ticket className="h-4 w-4 text-primary" />
  }
  if (accUpper.includes('CAJA') || accUpper.includes('CIERRE')) {
    return <Calculator className="h-4 w-4 text-purple-500" />
  }
  return <Activity className="h-4 w-4 text-muted-foreground" />
}

/** Tamaño de página, igual en las siete pantallas de listado del sistema. */
const LIMITE = 20

/** Tamaño de lote al exportar: el tope que acepta `GET /bitacora`. */
const LIMITE_EXPORTACION = 200

/** Techo de lotes, para que un filtro muy amplio no dispare cientos de
 *  peticiones seguidas. 50 x 200 = 10.000 registros por archivo. */
const TOPE_PAGINAS_EXPORTACION = 50

/**
 * Módulos que aparecen en la bitácora.
 *
 * Escritos acá y no traídos de `GET /modulos` a propósito: el campo `modulo` de
 * la bitácora lo escribe cada service como texto libre, no es una llave foránea,
 * y los valores no coinciden con la tabla `Modulo`. Poblar el desplegable desde
 * `/modulos` perdería `Tickets` -- el segundo en volumen -- y `Auth`, y a cambio
 * ofrecería nueve módulos sin un solo registro que mostrar.
 *
 * Tampoco se arma solo con lo que trae la página cargada: en cuanto el filtro se
 * resuelve en el servidor, elegir "Cajas" devuelve solo registros de Cajas, el
 * desplegable se recalcularía a esa única opción y el usuario quedaría encerrado
 * sin poder volver. Esta lista es el piso; lo que venga en la página se le suma
 * (ver `modulosDisponibles`), así que un módulo nuevo aparece solo.
 */
const MODULOS_BITACORA = [
  'ActividadesParque',
  'Auth',
  'Cajas',
  'Donaciones',
  'EmisionTickets',
  'Gastos',
  'Modulos',
  'Reportes',
  'Tarifas',
  'Tickets',
  'TiposGasto',
  'Usuarios',
]

export default function BitacoraPage() {
  const [bitacora, setBitacora] = useState<BitacoraBackend[]>([])
  const [total, setTotal] = useState<number>(0)
  const [pagina, setPagina] = useState<number>(1)
  const [exportando, setExportando] = useState<boolean>(false)
  const [cargando, setCargando] = useState<boolean>(true)
  const [busqueda, setBusqueda] = useState<string>('')
  const [busquedaAplicada, setBusquedaAplicada] = useState<string>('')
  const [filtroModulo, setFiltroModulo] = useState<string>('todos')
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(false)
  const [registroDetalle, setRegistroDetalle] = useState<BitacoraBackend | null>(null)

  // La búsqueda la resuelve el servidor, así que sale con retardo: sin esto
  // cada pulsación sería una petición. El mismo patrón que ya usan el historial
  // de tickets, actividades y donaciones.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim())
      setPagina(1)
    }, 400)
    return () => clearTimeout(t)
  }, [busqueda])

  // Las respuestas se descartan si ya salió otra petición después: pulsar
  // "siguiente" dos veces seguidas puede devolver las páginas en desorden, y la
  // que llegue tarde pintaría datos que no corresponden al paginador.
  const peticionVigente = useRef(0)

  const cargarBitacora = useCallback(async () => {
    const idPeticion = ++peticionVigente.current
    setCargando(true)
    try {
      const res = await api.bitacora.getBitacora({
        // El backend compara con `contains`, no con igualdad. Sobre los valores
        // que existen hoy eso solapa un solo par: filtrar por "Tickets" trae
        // además los de "EmisionTickets". Se acepta -- el resultado queda más
        // amplio, no equivocado -- y se deja dicho acá para que no parezca un
        // error cuando alguien lo note. Ningún otro par se solapa ("Gastos" no
        // alcanza a "TiposGasto": esa cadena lleva "Gasto" en singular).
        modulo: filtroModulo !== 'todos' ? filtroModulo : undefined,
        // El servidor busca en descripcion, accion, modulo, usuarioNombre y el
        // correo del ejecutor -- los mismos cinco campos que antes se recorrían
        // acá -- y se combina con el filtro de módulo en vez de reemplazarlo.
        buscar: busquedaAplicada || undefined,
        // El orden lo decide el servidor. Ordenar acá el arreglo recibido
        // reordenaría solo la página visible aparentando ser global: con el
        // histórico paginado, "más antiguo primero" mostraría el más antiguo
        // de estas cien filas, no el de la bitácora.
        orden: ordenAscendente ? 'asc' : 'desc',
        pagina,
        limite: LIMITE,
      })
      if (idPeticion !== peticionVigente.current) return
      setBitacora(Array.isArray(res?.datos) ? res.datos : [])
      setTotal(res?.total || 0)
    } catch (err: unknown) {
      if (idPeticion !== peticionVigente.current) return
      const msg = err instanceof Error ? err.message : 'Error al cargar bitacora'
      toast.error('Error al consultar bitacora', { description: msg })
      setBitacora([])
      setTotal(0)
    } finally {
      if (idPeticion === peticionVigente.current) setCargando(false)
    }
  }, [pagina, filtroModulo, busquedaAplicada, ordenAscendente])

  useEffect(() => {
    cargarBitacora()
  }, [cargarBitacora])

  // Los módulos conocidos más los que traiga la página, sin repetir. La unión es
  // lo que evita que el desplegable se encierre al filtrar y, a la vez, deja
  // aparecer uno nuevo sin tener que tocar la constante.
  const modulosDisponibles = useMemo(() => {
    const setModulos = new Set<string>(MODULOS_BITACORA)
    bitacora.forEach((b) => {
      if (b.modulo) setModulos.add(b.modulo)
    })
    return Array.from(setModulos).sort((a, b) => a.localeCompare(b, 'es'))
  }, [bitacora])

  // Acá no se filtra ni se ordena nada: de eso se encarga el servidor sobre el
  // histórico completo. La página se pinta tal como llega, del más reciente al
  // más antiguo; para ver lo más viejo se va a la última página.
  //
  // Hubo un botón para invertir el orden y se quitó: ordenaba en memoria, así
  // que daba vuelta los 20 registros de la página y no el histórico. Su alcance
  // no coincidía con el de los demás controles, que sí van al servidor.

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  // Métricas. Las dos de abajo solo pueden calcularse sobre lo que está
  // cargado, y sus etiquetas lo dicen. El conteo grande sale del `total` del
  // servidor, que desde que el módulo se filtra allá es el total DEL CONJUNTO
  // FILTRADO, no el del historial entero: por eso la etiqueta nombra el filtro
  // activo en vez de decir "total" a secas.
  const metricas = useMemo(() => {
    const usuariosUnicos = new Set(bitacora.map((r) => r.usuarioNombre || r.idUsuario)).size
    const iniciosSesion = bitacora.filter(
      (r) => (r.accion || '').toUpperCase().includes('INICIO') || (r.accion || '').toUpperCase().includes('LOGIN')
    ).length
    return { usuariosUnicos, iniciosSesion }
  }, [bitacora])

  /**
   * Exporta a Excel lo que el usuario está viendo filtrado, no la página.
   *
   * Hay que traer las páginas una por una porque el listado está paginado en el
   * servidor: `bitacora` solo tiene los 20 de la página actual, y exportar eso
   * dejaría fuera el resto sin que nadie lo note. Se pide de 200 en 200, que es
   * el tope del endpoint.
   */
  const exportarAExcel = async () => {
    if (exportando) return
    if (total === 0) {
      toast.info('No hay registros para exportar')
      return
    }

    const filtros = {
      modulo: filtroModulo !== 'todos' ? filtroModulo : undefined,
      buscar: busquedaAplicada || undefined,
      // El archivo sale en el mismo orden que la pantalla: si no, quien exporta
      // tras invertir el orden recibe algo distinto de lo que está viendo.
      orden: (ordenAscendente ? 'asc' : 'desc') as 'asc' | 'desc',
    }

    setExportando(true)
    const aviso = toast.loading('Preparando el archivo…')
    try {
      const paginas = Math.min(
        Math.ceil(total / LIMITE_EXPORTACION),
        TOPE_PAGINAS_EXPORTACION,
      )
      const registros: BitacoraBackend[] = []

      for (let pagina = 1; pagina <= paginas; pagina++) {
        const respuesta = await api.bitacora.getBitacora({
          ...filtros,
          pagina,
          limite: LIMITE_EXPORTACION,
        })
        registros.push(...(Array.isArray(respuesta?.datos) ? respuesta.datos : []))
        if (paginas > 1) {
          toast.loading(`Preparando el archivo… ${registros.length} de ${total}`, { id: aviso })
        }
      }

      const partes: string[] = []
      partes.push(filtroModulo !== 'todos' ? `Módulo: ${filtroModulo}` : 'Todos los módulos')
      if (busquedaAplicada) partes.push(`Búsqueda: "${busquedaAplicada}"`)

      const nombre = await exportarBitacoraAExcel({
        registros,
        descripcionFiltros: partes.join(' · '),
      })

      const recortado = registros.length < total
      toast.success('Bitácora exportada', {
        id: aviso,
        description: recortado
          ? `${nombre} · ${registros.length} de ${total} registros (se exporta un máximo de ${LIMITE_EXPORTACION * TOPE_PAGINAS_EXPORTACION}; afine los filtros para incluir el resto).`
          : `${nombre} · ${registros.length} registros.`,
      })
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo generar el archivo'
      toast.error('Error al exportar', { id: aviso, description: mensaje })
    } finally {
      setExportando(false)
    }
  }

  // Sin conversión de zona: la fecha viene de la API y sus componentes UTC ya
  // son la hora de pared de Guatemala. Ver `lib/fecha_guatemala.ts`.
  const formatearFecha = (fechaIso: string) =>
    formatearFechaApi(fechaIso, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  return (
    <RutaProtegida moduloRequerido="Bitacora">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />
        
        {/* Más ancho que el resto de las pantallas: son seis columnas, dos de
            ellas de texto largo, y a 1280 px la descripción se cortaba. */}
        <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-[1600px]">
          {/* Encabezado */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <History className="h-7 w-7 text-primary" />
                Módulo de Bitácora y Auditoría
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Registro histórico y trazabilidad de eventos de seguridad y operaciones del parque
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={cargarBitacora}
                variant="outline"
                size="sm"
                disabled={cargando}
                className="gap-2 border-border/60 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                onClick={exportarAExcel}
                disabled={exportando}
                variant="outline"
                size="sm"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
              >
                {exportando ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Exportar a Excel
              </Button>
            </div>
          </div>

          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {/* El total no lleva medidor: es el conjunto filtrado entero.
                En móvil se estira a las dos columnas. */}
            <TarjetaEstadistica
              className="col-span-2 md:col-span-1"
              etiqueta={
                filtroModulo === 'todos' && !busquedaAplicada
                  ? 'Total registros auditados'
                  : `Registros auditados${filtroModulo !== 'todos' ? ` · ${filtroModulo}` : ''}${
                      busquedaAplicada ? ` · "${busquedaAplicada}"` : ''
                    }`
              }
              valor={total}
              icono={Activity}
              tono="primary"
              pie={totalPaginas > 1 ? `${totalPaginas} páginas de ${LIMITE}` : undefined}
            />

            {/* Un recuento de personas distintas no es parte de ningún total:
                sin proporción honesta, va sin medidor. El pie dice sobre qué
                se contó, que es lo que de verdad hacía falta aclarar. */}
            <TarjetaEstadistica
              etiqueta="Usuarios ejecutores"
              valor={metricas.usuariosUnicos}
              icono={Users}
              tono="info"
              pie={`distintos entre los ${bitacora.length} registros de esta página`}
            />

            {/* Acá sí hay proporción real: los inicios de sesión son un
                subconjunto de los eventos cargados. */}
            <TarjetaEstadistica
              etiqueta="Inicios de sesión"
              valor={metricas.iniciosSesion}
              icono={ShieldAlert}
              tono="positivo"
              proporcion={{ parte: metricas.iniciosSesion, total: bitacora.length }}
            />
          </div>

          {/* Filtros */}
          <Card className="bg-card border-border/50 mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Búsqueda */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por usuario, correo, módulo o descripción..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-10 bg-muted/50 border-border/50 h-10"
                  />
                </div>

                {/* Filtro por módulo */}
                {/* El reinicio de página va en el mismo manejador que el
                    filtro, no en un efecto aparte: así sale una sola petición.
                    Sin él, aplicar un filtro estando en la página 5 deja
                    pidiendo una página que el conjunto filtrado no tiene. */}
                <Select
                  value={filtroModulo}
                  onValueChange={(valor) => {
                    setFiltroModulo(valor)
                    setPagina(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px] bg-muted/50 border-border/50 h-10">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los módulos</SelectItem>
                    {modulosDisponibles.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Vuelve a la página 1 junto con el orden: invertirlo estando
                    en la página 5 dejaría pidiendo una página del conjunto
                    anterior, y lo que el usuario espera al invertir es ver el
                    otro extremo del histórico. */}
                <Button
                  variant="outline"
                  className="gap-2 h-10 cursor-pointer"
                  onClick={() => {
                    setOrdenAscendente(!ordenAscendente)
                    setPagina(1)
                  }}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {ordenAscendente ? 'Más antiguo primero' : 'Más reciente primero'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Bitácora */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Mostrando {bitacora.length} de {total} eventos de bitácora
                {totalPaginas > 1 && ` · página ${pagina} de ${totalPaginas}`}
              </CardTitle>
              <CardDescription>
                Registro de auditoría en huso horario UTC-6,{' '}
                {ordenAscendente ? 'del más antiguo al más reciente' : 'del más reciente al más antiguo'}.
                La búsqueda y el filtro por módulo los aplica el servidor sobre el histórico
                completo, así que el conteo de arriba y el paginador ya reflejan lo que encontró;
                para ver lo más antiguo, vaya a la última página.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {cargando ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
                  <Spinner className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">Cargando registros de bitácora...</p>
                </div>
              ) : (
                <>
                  {/* Vista Escritorio (Tabla) */}
                  {/* Desde `lg` y no desde `md`: entre 768 y 1023 px las seis
                      columnas no caben y aparecia una barra horizontal. Abajo
                      de eso manda la lista de tarjetas. */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border/50">
                          {/* Los anchos salen de medir el contenido mas largo de
                              cada columna, para que ninguna parta su texto en dos
                              lineas:
                                fecha    160 -> "16/09/2026, 14:32:45" en monoespaciada
                                modulo   145 -> "ActividadesParque"
                                accion   220 -> "RESERVAR_FOLIOS_OFFLINE", la mas larga
                              El usuario ya venia pensado en dos lineas (nombre y
                              puesto), asi que no necesita ancho de una sola. */}
                          <TableHead className="w-[160px]">Fecha y Hora (UTC-6)</TableHead>
                          <TableHead className="w-[140px] whitespace-normal">Usuario</TableHead>
                          <TableHead className="w-[145px] whitespace-normal">Módulo</TableHead>
                          <TableHead className="w-[220px] whitespace-normal">Acción</TableHead>
                          {/* Sin ancho fijo: se queda con lo que sobre, que es la
                              columna que crece cuando hay pantalla de mas. */}
                          <TableHead className="min-w-[150px] whitespace-normal">
                            Descripción del Evento
                          </TableHead>
                          <TableHead className="w-[60px]">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bitacora.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No se encontraron registros de bitácora con los filtros seleccionados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          bitacora.map((registro) => (
                            <TableRow key={registro.id} className="border-border/30 hover:bg-muted/20">
                              <TableCell className="font-mono text-xs font-semibold text-primary">
                                {formatearFecha(registro.fecha)}
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground text-xs break-words">{registro.usuarioNombre}</span>
                                  {registro.usuario?.puesto?.nombre && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {registro.usuario.puesto.nombre}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-muted/30 whitespace-normal text-left"
                                >
                                  {registro.modulo}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-normal align-top">
                                <Badge
                                  variant="outline"
                                  className="gap-1.5 font-semibold text-xs py-1 whitespace-normal text-left break-words"
                                >
                                  {OBTENER_ICONO_ACCION(registro.accion)}
                                  {registro.accion}
                                </Badge>
                              </TableCell>
                              {/* Dos líneas en vez de `truncate`: una sola dejaba
                                  la mayoría de las descripciones en puntos
                                  suspensivos. El `line-clamp` va en un span
                                  porque sobre la celda rompería el layout de
                                  tabla (cambia el `display`). */}
                              <TableCell className="text-muted-foreground text-sm align-top whitespace-normal">
                                <span className="line-clamp-2 break-words">{registro.descripcion}</span>
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setRegistroDetalle(registro)}
                                  className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                                  title="Ver detalle"
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Vista Móvil (Tarjetas) */}
                  <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
                    {bitacora.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                        No se encontraron registros de bitácora.
                      </div>
                    ) : (
                      bitacora.map((registro) => (
                        <div key={registro.id} className="p-4 rounded-xl border border-border/60 bg-card space-y-3 shadow-sm">
                          {/* Fila 1: Fecha completa */}
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-primary">
                              {formatearFecha(registro.fecha)}
                            </span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {registro.modulo}
                            </Badge>
                          </div>

                          {/* Fila 2: Acción */}
                          <div className="flex items-center">
                            <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1">
                              {OBTENER_ICONO_ACCION(registro.accion)}
                              {registro.accion}
                            </Badge>
                          </div>

                          {/* Fila 3: Usuario */}
                          <div className="border-t border-border/30 pt-2">
                            <span className="text-muted-foreground block text-[10px] uppercase font-medium">Usuario</span>
                            <p className="font-semibold text-sm text-foreground">{registro.usuarioNombre}</p>
                          </div>

                          {/* Fila 4: Descripción */}
                          <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded border border-border/30 leading-relaxed">
                            {registro.descripcion}
                          </p>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRegistroDetalle(registro)}
                            className="w-full text-xs gap-1.5 cursor-pointer"
                          >
                            <Info className="h-3.5 w-3.5" />
                            Ver Detalle Completo
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* `className`: el CardContent de esta pantalla no lleva
                      padding en móvil (`p-0 sm:p-6`) y sin esto el paginador
                      quedaría pegado al borde. */}
                  <Paginador
                    pagina={pagina}
                    totalPaginas={totalPaginas}
                    total={total}
                    etiqueta="eventos"
                    cargando={cargando}
                    onCambiar={setPagina}
                    className="px-4 sm:px-0"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Modal Detalle de Evento de Bitácora */}
        <Dialog open={!!registroDetalle} onOpenChange={() => setRegistroDetalle(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Info className="h-5 w-5 text-primary" />
                Detalle del Registro de Bitácora #{registroDetalle?.id}
              </DialogTitle>
              <DialogDescription>
                Información técnica detallada del evento registrado en el sistema.
              </DialogDescription>
            </DialogHeader>

            {registroDetalle && (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">ID Registro</span>
                    <span className="font-mono font-bold text-foreground">#{registroDetalle.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Fecha y Hora</span>
                    <span className="font-mono font-bold text-primary">{formatearFecha(registroDetalle.fecha)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Módulo</span>
                    <span className="font-semibold text-foreground">{registroDetalle.modulo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Acción</span>
                    <Badge variant="outline" className="gap-1 mt-0.5 text-[11px] font-bold">
                      {OBTENER_ICONO_ACCION(registroDetalle.accion)}
                      {registroDetalle.accion}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 bg-muted/20 rounded-lg border border-border/40">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Usuario Ejecutor</span>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{registroDetalle.usuarioNombre}</p>
                      {registroDetalle.usuario && (
                        <p className="text-[11px] text-muted-foreground">
                          {registroDetalle.usuario.correo} — Puesto: {registroDetalle.usuario.puesto?.nombre || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Descripción del Evento</span>
                  <div className="p-3 bg-card rounded-lg border border-border/60 leading-relaxed text-foreground">
                    {registroDetalle.descripcion}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RutaProtegida>
  )
}
