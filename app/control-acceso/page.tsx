'use client'

import { useState, useMemo } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ScanLine, 
  Users, 
  LogIn, 
  LogOut, 
  Search,
  Clock,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { ENTRADAS_SALIDAS_DEMO, type EntradaSalida } from '@/tipos'

export default function ControlAccesoPage() {
  const [entradas, setEntradas] = useState<EntradaSalida[]>(ENTRADAS_SALIDAS_DEMO)
  const [busquedaTicket, setBusquedaTicket] = useState('')

  const visitantesActivos = useMemo(() => {
    return entradas.filter(e => e.estado === 'dentro')
  }, [entradas])

  const totalPersonasDentro = useMemo(() => {
    return visitantesActivos.reduce((acc, e) => acc + e.cantidad_personas, 0)
  }, [visitantesActivos])

  const registrarSalida = (id: string) => {
    setEntradas(prev => prev.map(e => {
      if (e.id === id) {
        toast.success('Salida registrada', {
          description: `${e.nombre_grupo} ha salido del parque`,
        })
        return { ...e, estado: 'fuera' as const, hora_salida: new Date() }
      }
      return e
    }))
  }

  const formatearHora = (fecha: Date) => {
    return new Intl.DateTimeFormat('es-GT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(fecha)
  }

  const calcularTiempoDentro = (horaEntrada: Date) => {
    const ahora = new Date()
    const diff = ahora.getTime() - horaEntrada.getTime()
    const minutos = Math.floor(diff / (1000 * 60))
    const horas = Math.floor(minutos / 60)
    const mins = minutos % 60
    
    if (horas > 0) {
      return `${horas}h ${mins}m`
    }
    return `${mins}m`
  }

  const simularEntrada = () => {
    const nuevaEntrada: EntradaSalida = {
      id: `${Date.now()}`,
      ticket_id: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      nombre_grupo: `Visitante ${Math.floor(Math.random() * 100)}`,
      tipo_recorrido: Math.random() > 0.5 ? 'largo' : 'corto',
      cantidad_personas: Math.floor(Math.random() * 5) + 1,
      hora_entrada: new Date(),
      estado: 'dentro',
      registrado_por: '1',
    }
    
    setEntradas(prev => [nuevaEntrada, ...prev])
    toast.success('Entrada registrada', {
      description: `${nuevaEntrada.nombre_grupo} - ${nuevaEntrada.cantidad_personas} personas`,
    })
  }

  return (
    <RutaProtegida moduloRequerido="Registro Visitantes">
      <div className="min-h-screen bg-background">
        <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            Control de Entrada y Salida
          </h1>
          <p className="text-muted-foreground">Monitoreo en tiempo real de visitantes en el parque</p>
        </div>

        {/* Estadisticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visitantes Activos</p>
                  <p className="text-4xl font-bold text-primary">{totalPersonasDentro}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Grupos Dentro</p>
                  <p className="text-4xl font-bold">{visitantesActivos.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Salidas Hoy</p>
                  <p className="text-4xl font-bold">{entradas.filter(e => e.estado === 'fuera').length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <LogOut className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de acciones */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Busqueda de ticket */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por numero de ticket o nombre..."
                  value={busquedaTicket}
                  onChange={(e) => setBusquedaTicket(e.target.value)}
                  className="pl-10 bg-muted/50 border-border/50"
                />
              </div>

              {/* Boton de entrada manual */}
              <Button onClick={simularEntrada} className="gap-2 bg-primary hover:bg-primary/90">
                <LogIn className="h-4 w-4" />
                Registrar Entrada
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerta de capacidad */}
        {totalPersonasDentro > 50 && (
          <Card className="bg-amber-500/10 border-amber-500/30 mb-6">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <p className="text-sm">
                  <span className="font-medium">Aviso de capacidad:</span> El parque tiene mas de 50 visitantes activos.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla de visitantes activos */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Visitantes Actualmente en el Parque
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Ticket</TableHead>
                    <TableHead>Grupo / Visitante</TableHead>
                    <TableHead className="text-center">Personas</TableHead>
                    <TableHead>Recorrido</TableHead>
                    <TableHead>Hora Entrada</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitantesActivos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay visitantes dentro del parque actualmente
                      </TableCell>
                    </TableRow>
                  ) : (
                    visitantesActivos.map((entrada) => (
                      <TableRow key={entrada.id} className="border-border/30">
                        <TableCell className="font-mono text-sm">
                          {entrada.ticket_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entrada.nombre_grupo}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{entrada.cantidad_personas}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={entrada.tipo_recorrido === 'largo' ? 'border-primary text-primary' : ''}
                          >
                            {entrada.tipo_recorrido === 'largo' ? 'Largo' : 'Corto'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatearHora(entrada.hora_entrada)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {calcularTiempoDentro(entrada.hora_entrada)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => registrarSalida(entrada.id)}
                          >
                            <LogOut className="h-3 w-3" />
                            Salida
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      </div>
    </RutaProtegida>
  )
}
