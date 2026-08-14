'use client'

import { useState, useEffect, useMemo } from 'react'
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
  ArrowUpDown,
  ShieldAlert,
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
import { type BitacoraBackend } from '@/tipos'

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

export default function BitacoraPage() {
  const [bitacora, setBitacora] = useState<BitacoraBackend[]>([])
  const [cargando, setCargando] = useState<boolean>(true)
  const [busqueda, setBusqueda] = useState<string>('')
  const [filtroModulo, setFiltroModulo] = useState<string>('todos')
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(false)
  const [registroDetalle, setRegistroDetalle] = useState<BitacoraBackend | null>(null)

  const cargarBitacora = async () => {
    setCargando(true)
    try {
      const res = await api.bitacora.getBitacora({ limite: 200 })
      if (Array.isArray(res)) {
        setBitacora(res)
      } else {
        setBitacora([])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar bitacora'
      toast.error('Error al consultar bitacora', { description: msg })
      setBitacora([])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarBitacora()
  }, [])

  // Lista de módulos únicos presentes en los registros
  const modulosDisponibles = useMemo(() => {
    const setModulos = new Set<string>()
    bitacora.forEach((b) => {
      if (b.modulo) setModulos.add(b.modulo)
    })
    return Array.from(setModulos)
  }, [bitacora])

  // Filtrado y ordenamiento
  const registrosFiltrados = useMemo(() => {
    let resultado = bitacora

    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase().trim()
      resultado = resultado.filter(
        (r) =>
          r.usuarioNombre?.toLowerCase().includes(termino) ||
          r.descripcion?.toLowerCase().includes(termino) ||
          r.accion?.toLowerCase().includes(termino) ||
          r.modulo?.toLowerCase().includes(termino) ||
          r.usuario?.correo?.toLowerCase().includes(termino)
      )
    }

    if (filtroModulo !== 'todos') {
      resultado = resultado.filter(
        (r) => r.modulo?.toLowerCase() === filtroModulo.toLowerCase()
      )
    }

    return [...resultado].sort((a, b) => {
      const fechaA = new Date(a.fecha).getTime()
      const fechaB = new Date(b.fecha).getTime()
      return ordenAscendente ? fechaA - fechaB : fechaB - fechaA
    })
  }, [bitacora, busqueda, filtroModulo, ordenAscendente])

  // Métricas
  const metricas = useMemo(() => {
    const totalEventos = bitacora.length
    const usuariosUnicos = new Set(bitacora.map((r) => r.usuarioNombre || r.idUsuario)).size
    const iniciosSesion = bitacora.filter(
      (r) => (r.accion || '').toUpperCase().includes('INICIO') || (r.accion || '').toUpperCase().includes('LOGIN')
    ).length
    return { totalEventos, usuariosUnicos, iniciosSesion }
  }, [bitacora])

  const handleExportarCSV = () => {
    if (registrosFiltrados.length === 0) {
      toast.info('No hay registros para exportar')
      return
    }

    const cabeceras = ['ID', 'Fecha (UTC-6)', 'Usuario', 'Correo', 'Puesto', 'Módulo', 'Acción', 'Descripción']
    const filas = registrosFiltrados.map((r) => [
      r.id,
      formatearFecha(r.fecha),
      `"${r.usuarioNombre || ''}"`,
      `"${r.usuario?.correo || ''}"`,
      `"${r.usuario?.puesto?.nombre || ''}"`,
      `"${r.modulo || ''}"`,
      `"${r.accion || ''}"`,
      `"${r.descripcion ? r.descripcion.replace(/"/g, '""') : ''}"`,
    ])

    const contenidoCSV = [cabeceras.join(','), ...filas.map((f) => f.join(','))].join('\n')
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bitacora_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Bitácora exportada correctamente', {
      description: `Se descargaron ${registrosFiltrados.length} registros.`,
    })
  }

  const formatearFecha = (fechaIso: string) => {
    try {
      const date = new Date(fechaIso)
      return new Intl.DateTimeFormat('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Guatemala',
      }).format(date)
    } catch {
      return fechaIso
    }
  }

  return (
    <RutaProtegida moduloRequerido="Bitacora">
      <div className="min-h-screen bg-background flex flex-col">
        <BarraNavegacionSuperior />
        
        <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-7xl">
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
              <Button onClick={handleExportarCSV} variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Total Registros Auditados
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {metricas.totalEventos} Eventos
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Usuarios Ejecutores
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.usuariosUnicos} Usuarios Activos
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Inicios de Sesión
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {metricas.iniciosSesion} Accesos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-6">
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
                <Select value={filtroModulo} onValueChange={setFiltroModulo}>
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

                {/* Ordenar */}
                <Button
                  variant="outline"
                  className="gap-2 h-10 cursor-pointer"
                  onClick={() => setOrdenAscendente(!ordenAscendente)}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {ordenAscendente ? 'Más antiguo primero' : 'Más reciente primero'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Bitácora */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Mostrando {registrosFiltrados.length} eventos de bitácora
              </CardTitle>
              <CardDescription>
                Registro de auditoría ordenado descendentemente por fecha (UTC-6).
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
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="border-border/50">
                          <TableHead className="w-[180px]">Fecha y Hora (UTC-6)</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead className="w-[130px]">Módulo</TableHead>
                          <TableHead className="w-[170px]">Acción</TableHead>
                          <TableHead>Descripción del Evento</TableHead>
                          <TableHead className="w-[80px] text-right">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrosFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No se encontraron registros de bitácora con los filtros seleccionados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          registrosFiltrados.map((registro) => (
                            <TableRow key={registro.id} className="border-border/30 hover:bg-muted/20">
                              <TableCell className="font-mono text-xs font-semibold text-primary">
                                {formatearFecha(registro.fecha)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground text-xs">{registro.usuarioNombre}</span>
                                  {registro.usuario?.puesto?.nombre && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {registro.usuario.puesto.nombre}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs bg-muted/30">
                                  {registro.modulo}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1">
                                  {OBTENER_ICONO_ACCION(registro.accion)}
                                  {registro.accion}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm max-w-md truncate">
                                {registro.descripcion}
                              </TableCell>
                              <TableCell className="text-right">
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
                  <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                    {registrosFiltrados.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                        No se encontraron registros de bitácora.
                      </div>
                    ) : (
                      registrosFiltrados.map((registro) => (
                        <div key={registro.id} className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3 shadow-sm">
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
