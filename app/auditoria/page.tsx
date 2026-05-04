'use client'

import { useState, useMemo } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'
import { AUDITORIA_DEMO, type RegistroAuditoria, type TipoActividad } from '@/tipos'

const ICONOS_ACTIVIDAD: Record<TipoActividad, React.ReactNode> = {
  login: <LogIn className="h-4 w-4 text-green-500" />,
  logout: <LogOut className="h-4 w-4 text-orange-500" />,
  emision_ticket: <Ticket className="h-4 w-4 text-primary" />,
  cancelacion_ticket: <XCircle className="h-4 w-4 text-destructive" />,
  registro_entrada: <LogIn className="h-4 w-4 text-blue-500" />,
  registro_salida: <LogOut className="h-4 w-4 text-purple-500" />,
  cierre_caja: <Calculator className="h-4 w-4 text-amber-500" />,
  sincronizacion: <RefreshCw className="h-4 w-4 text-cyan-500" />,
  modificacion_usuario: <History className="h-4 w-4 text-muted-foreground" />,
}

const ETIQUETAS_ACTIVIDAD: Record<TipoActividad, string> = {
  login: 'Inicio Sesion',
  logout: 'Cierre Sesion',
  emision_ticket: 'Emision Ticket',
  cancelacion_ticket: 'Cancelacion',
  registro_entrada: 'Entrada',
  registro_salida: 'Salida',
  cierre_caja: 'Cierre Caja',
  sincronizacion: 'Sincronizacion',
  modificacion_usuario: 'Mod. Usuario',
}

// Generar mas datos de ejemplo
const generarMasAuditoria = (): RegistroAuditoria[] => {
  const actividades: TipoActividad[] = ['login', 'emision_ticket', 'registro_entrada', 'registro_salida', 'logout']
  const usuarios = [
    { id: '1', nombre: 'Luis Ramos' },
    { id: '2', nombre: 'Maria Garcia' },
    { id: '3', nombre: 'Carlos Lopez' },
  ]
  
  const registros: RegistroAuditoria[] = [...AUDITORIA_DEMO]
  
  for (let i = 0; i < 20; i++) {
    const usuario = usuarios[Math.floor(Math.random() * usuarios.length)]
    const actividad = actividades[Math.floor(Math.random() * actividades.length)]
    
    registros.push({
      id: `audit-${i + 10}`,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre,
      tipo_actividad: actividad,
      descripcion: `Accion de ${ETIQUETAS_ACTIVIDAD[actividad].toLowerCase()}`,
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

    // Filtrar por busqueda
    if (busqueda) {
      const termino = busqueda.toLowerCase()
      resultado = resultado.filter(
        r => r.usuario_nombre.toLowerCase().includes(termino) ||
             r.descripcion.toLowerCase().includes(termino)
      )
    }

    // Filtrar por tipo de actividad
    if (filtroActividad !== 'todas') {
      resultado = resultado.filter(r => r.tipo_actividad === filtroActividad)
    }

    // Ordenar
    if (ordenAscendente) {
      resultado = [...resultado].sort((a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime())
    }

    return resultado
  }, [busqueda, filtroActividad, ordenAscendente])

  const formatearFecha = (fecha: Date) => {
    return new Intl.DateTimeFormat('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(fecha)
  }

  return (
    <div className="min-h-screen bg-background">
      <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Registro de Auditoria
            </h1>
            <p className="text-muted-foreground">Historial de actividades del sistema</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Busqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuario o descripcion..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 bg-muted/50 border-border/50"
                />
              </div>

              {/* Filtro por actividad */}
              <Select value={filtroActividad} onValueChange={setFiltroActividad}>
                <SelectTrigger className="w-full sm:w-[200px] bg-muted/50 border-border/50">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las actividades</SelectItem>
                  <SelectItem value="login">Inicio Sesion</SelectItem>
                  <SelectItem value="logout">Cierre Sesion</SelectItem>
                  <SelectItem value="emision_ticket">Emision Ticket</SelectItem>
                  <SelectItem value="registro_entrada">Entrada</SelectItem>
                  <SelectItem value="registro_salida">Salida</SelectItem>
                  <SelectItem value="cierre_caja">Cierre Caja</SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenar */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setOrdenAscendente(!ordenAscendente)}
              >
                <ArrowUpDown className="h-4 w-4" />
                {ordenAscendente ? 'Mas antiguo' : 'Mas reciente'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de auditoria */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {registrosFiltrados.length} registros encontrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="w-[150px]">Actividad</TableHead>
                    <TableHead>Descripcion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id} className="border-border/30">
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatearFecha(registro.fecha_hora)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {registro.usuario_nombre}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 font-normal">
                          {ICONOS_ACTIVIDAD[registro.tipo_actividad]}
                          {ETIQUETAS_ACTIVIDAD[registro.tipo_actividad]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {registro.descripcion}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
