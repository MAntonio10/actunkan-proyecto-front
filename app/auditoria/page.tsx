'use client'

import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { AUDITORIA_DEMO, type RegistroAuditoria, type TipoActividad } from '@/tipos'

const ICONOS_ACTIVIDAD: Record<TipoActividad, React.ReactNode> = {
  login: <LogIn className="h-4 w-4 text-emerald-500" />,
  logout: <LogOut className="h-4 w-4 text-amber-500" />,
  emision_ticket: <Ticket className="h-4 w-4 text-primary" />,
  cancelacion_ticket: <XCircle className="h-4 w-4 text-destructive" />,
  registro_entrada: <LogIn className="h-4 w-4 text-blue-500" />,
  registro_salida: <LogOut className="h-4 w-4 text-purple-500" />,
  cierre_caja: <Calculator className="h-4 w-4 text-amber-500" />,
  sincronizacion: <RefreshCw className="h-4 w-4 text-cyan-500" />,
  modificacion_usuario: <History className="h-4 w-4 text-muted-foreground" />,
}

const ETIQUETAS_ACTIVIDAD: Record<TipoActividad, string> = {
  login: 'Inicio Sesión',
  logout: 'Cierre Sesión',
  emision_ticket: 'Emisión Ticket',
  cancelacion_ticket: 'Cancelación',
  registro_entrada: 'Entrada',
  registro_salida: 'Salida',
  cierre_caja: 'Cierre Caja',
  sincronizacion: 'Sincronización',
  modificacion_usuario: 'Mod. Usuario',
}

const generarMasAuditoria = (): RegistroAuditoria[] => {
  const actividades: TipoActividad[] = ['login', 'emision_ticket', 'registro_entrada', 'registro_salida', 'logout', 'cierre_caja']
  const usuarios = [
    { id: '1', nombre: 'Luis Ramos' },
    { id: '2', nombre: 'María García' },
    { id: '3', nombre: 'Administrador del Sistema' },
  ]
  
  const registros: RegistroAuditoria[] = [...AUDITORIA_DEMO]
  
  for (let i = 0; i < 25; i++) {
    const usuario = usuarios[Math.floor(Math.random() * usuarios.length)]
    const actividad = actividades[Math.floor(Math.random() * actividades.length)]
    
    registros.push({
      id: `audit-${i + 10}`,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre,
      tipo_actividad: actividad,
      descripcion: `Acción de ${ETIQUETAS_ACTIVIDAD[actividad].toLowerCase()} ejecutada en el sistema`,
      fecha_hora: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7),
    })
  }
  
  return registros.sort((a, b) => b.fecha_hora.getTime() - a.fecha_hora.getTime())
}

const REGISTROS_AUDITORIA = generarMasAuditoria()

export default function AuditoriaPage() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroActividad, setFiltroActividad] = useState<string>('todas')
  const [ordenAscendente, setOrdenAscendente] = useState(false)

  const registrosFiltrados = useMemo(() => {
    let resultado = REGISTROS_AUDITORIA

    if (busqueda) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(
        r => r.usuario_nombre.toLowerCase().includes(termino) ||
             r.descripcion.toLowerCase().includes(termino)
      )
    }

    if (filtroActividad !== 'todas') {
      resultado = resultado.filter(r => r.tipo_actividad === filtroActividad)
    }

    if (ordenAscendente) {
      resultado = [...resultado].sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime())
    }

    return resultado
  }, [busqueda, filtroActividad, ordenAscendente])

  const metricas = useMemo(() => {
    const totalEventos = REGISTROS_AUDITORIA.length
    const usuariosUnicos = new Set(REGISTROS_AUDITORIA.map((r) => r.usuario_nombre)).size
    const iniciossesion = REGISTROS_AUDITORIA.filter((r) => r.tipo_actividad === 'login').length
    return { totalEventos, usuariosUnicos, iniciossesion }
  }, [])

  const handleExportarCSV = () => {
    toast.success('Bitácora de auditoría exportada', {
      description: `Se descargó el archivo auditoria_${new Date().toISOString().split('T')[0]}.csv (${registrosFiltrados.length} registros).`,
    })
  }

  const formatearFecha = (fecha: Date) => {
    return new Intl.DateTimeFormat('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(fecha)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-7 w-7 text-primary" />
              Módulo de Auditoría y Bitácora
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Registro histórico y trazabilidad de eventos de seguridad y operaciones del sistema
            </p>
          </div>
          <Button onClick={handleExportarCSV} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer">
            <Download className="h-4 w-4" />
            Exportar Bitácora CSV
          </Button>
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
                  Usuarios Auditados
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
                  {metricas.iniciossesion} Accesos
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
                  placeholder="Buscar por usuario o descripción de evento..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 bg-muted/50 border-border/50 h-10"
                />
              </div>

              {/* Filtro por actividad */}
              <Select value={filtroActividad} onValueChange={setFiltroActividad}>
                <SelectTrigger className="w-full sm:w-[220px] bg-muted/50 border-border/50 h-10">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las actividades</SelectItem>
                  <SelectItem value="login">Inicio Sesión</SelectItem>
                  <SelectItem value="logout">Cierre Sesión</SelectItem>
                  <SelectItem value="emision_ticket">Emisión Ticket</SelectItem>
                  <SelectItem value="registro_entrada">Entrada</SelectItem>
                  <SelectItem value="registro_salida">Salida</SelectItem>
                  <SelectItem value="cierre_caja">Cierre Caja</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenar */}
              <Button
                variant="outline"
                className="gap-2 h-10 cursor-pointer"
                onClick={() => setOrdenAscendente(!ordenAscendente)}
              >
                <ArrowUpDown className="h-4 w-4" />
                {ordenAscendente ? 'Más antiguo' : 'Más reciente'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de auditoría */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Mostrando {registrosFiltrados.length} eventos de auditoría
            </CardTitle>
            <CardDescription>
              Eventos ordenados por marca temporal de ejecución en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Vista Escritorio (Tabla) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/50">
                    <TableHead className="w-[200px]">Fecha y Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-[170px]">Actividad</TableHead>
                    <TableHead>Descripción del Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {formatearFecha(registro.fecha_hora)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {registro.usuario_nombre}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1">
                          {ICONOS_ACTIVIDAD[registro.tipo_actividad]}
                          {ETIQUETAS_ACTIVIDAD[registro.tipo_actividad]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {registro.descripcion}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Vista Móvil (Tarjetas) */}
            <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
              {registrosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                  No se encontraron eventos de auditoría.
                </div>
              ) : (
                registrosFiltrados.map((registro) => (
                  <div key={registro.id} className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1">
                        {ICONOS_ACTIVIDAD[registro.tipo_actividad]}
                        {ETIQUETAS_ACTIVIDAD[registro.tipo_actividad]}
                      </Badge>
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        {formatearFecha(registro.fecha_hora)}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground font-medium block">Usuario</span>
                      <p className="font-semibold text-sm text-foreground">{registro.usuario_nombre}</p>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/30">
                      {registro.descripcion}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
