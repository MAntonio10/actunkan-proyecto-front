'use client'

import { useState, useEffect } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  CloudCog, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  Play,
  Ticket,
  LogIn,
  Calculator,
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { type OperacionPendiente } from '@/tipos'

// Operaciones pendientes de ejemplo
const OPERACIONES_PENDIENTES_DEMO: OperacionPendiente[] = [
  {
    id: '1',
    tipo: 'crear_ticket',
    datos: { nombre: 'Familia Lopez', cantidad: 3 },
    fecha_creacion: new Date(Date.now() - 1000 * 60 * 5),
    intentos: 0,
  },
  {
    id: '2',
    tipo: 'registrar_salida',
    datos: { ticket_id: 'TKT-001' },
    fecha_creacion: new Date(Date.now() - 1000 * 60 * 3),
    intentos: 1,
    ultimo_intento: new Date(Date.now() - 1000 * 60 * 2),
  },
  {
    id: '3',
    tipo: 'crear_ticket',
    datos: { nombre: 'Tour Escolar', cantidad: 25 },
    fecha_creacion: new Date(Date.now() - 1000 * 60 * 10),
    intentos: 2,
    ultimo_intento: new Date(Date.now() - 1000 * 60 * 8),
    error: 'Error de conexion',
  },
]

const ICONOS_OPERACION = {
  crear_ticket: <Ticket className="h-4 w-4" />,
  actualizar_entrada: <LogIn className="h-4 w-4" />,
  registrar_salida: <LogIn className="h-4 w-4 rotate-180" />,
  cierre_caja: <Calculator className="h-4 w-4" />,
}

const ETIQUETAS_OPERACION = {
  crear_ticket: 'Crear Ticket',
  actualizar_entrada: 'Registrar Entrada',
  registrar_salida: 'Registrar Salida',
  cierre_caja: 'Cierre de Caja',
}

export default function SincronizacionPage() {
  const [estaConectado, setEstaConectado] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [operaciones, setOperaciones] = useState<OperacionPendiente[]>(OPERACIONES_PENDIENTES_DEMO)
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(new Date(Date.now() - 1000 * 60 * 15))
  const [progreso, setProgreso] = useState(0)

  // Detectar cambios de conexion
  useEffect(() => {
    const handleOnline = () => {
      setEstaConectado(true)
      toast.success('Conexion restaurada')
    }
    const handleOffline = () => {
      setEstaConectado(false)
      toast.error('Sin conexion a internet')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setEstaConectado(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const iniciarSincronizacion = async () => {
    if (!estaConectado) {
      toast.error('Sin conexion', {
        description: 'No se puede sincronizar sin conexion a internet',
      })
      return
    }

    setSincronizando(true)
    setProgreso(0)

    // Simular sincronizacion
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(resolve => setTimeout(resolve, 500))
      setProgreso(i)
    }

    // Limpiar operaciones exitosas
    setOperaciones(prev => prev.filter(op => op.error))
    setUltimaSincronizacion(new Date())
    setSincronizando(false)

    toast.success('Sincronizacion completada', {
      description: `${OPERACIONES_PENDIENTES_DEMO.length - operaciones.filter(op => op.error).length} operaciones sincronizadas`,
    })
  }

  const reintentarOperacion = async (id: string) => {
    const op = operaciones.find(o => o.id === id)
    if (!op) return

    toast.info('Reintentando operacion...')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Simular exito o fallo aleatorio
    if (Math.random() > 0.3) {
      setOperaciones(prev => prev.filter(o => o.id !== id))
      toast.success('Operacion completada')
    } else {
      setOperaciones(prev => prev.map(o => 
        o.id === id 
          ? { ...o, intentos: o.intentos + 1, ultimo_intento: new Date(), error: 'Error de conexion' }
          : o
      ))
      toast.error('Error al reintentar')
    }
  }

  const eliminarOperacion = (id: string) => {
    setOperaciones(prev => prev.filter(o => o.id !== id))
    toast.info('Operacion eliminada de la cola')
  }

  const formatearTiempo = (fecha: Date) => {
    const diff = Date.now() - fecha.getTime()
    const minutos = Math.floor(diff / (1000 * 60))
    
    if (minutos < 1) return 'Hace un momento'
    if (minutos < 60) return `Hace ${minutos} minutos`
    const horas = Math.floor(minutos / 60)
    if (horas < 24) return `Hace ${horas} horas`
    return `Hace ${Math.floor(horas / 24)} dias`
  }

  return (
    <div className="min-h-screen bg-background">
      <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CloudCog className="h-6 w-6 text-primary" />
            Sincronizacion Offline
          </h1>
          <p className="text-muted-foreground">Estado de conexion y cola de operaciones pendientes</p>
        </div>

        {/* Estado de conexion */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className={`${estaConectado ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Estado de Conexion</p>
                  <p className={`text-xl font-bold ${estaConectado ? 'text-green-500' : 'text-red-500'}`}>
                    {estaConectado ? 'Conectado' : 'Sin Conexion'}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${estaConectado ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {estaConectado ? (
                    <Wifi className="h-6 w-6 text-green-500" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Operaciones Pendientes</p>
                  <p className="text-xl font-bold">{operaciones.length}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ultima Sincronizacion</p>
                  <p className="text-xl font-bold">
                    {ultimaSincronizacion ? formatearTiempo(ultimaSincronizacion) : 'Nunca'}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Boton de sincronizacion */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                {sincronizando ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Sincronizando...</span>
                      <span>{progreso}%</span>
                    </div>
                    <Progress value={progreso} className="h-2" />
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {operaciones.length > 0 
                      ? `Hay ${operaciones.length} operaciones pendientes de sincronizar`
                      : 'Todas las operaciones estan sincronizadas'
                    }
                  </p>
                )}
              </div>
              <Button 
                onClick={iniciarSincronizacion} 
                disabled={sincronizando || !estaConectado || operaciones.length === 0}
                className="gap-2"
              >
                {sincronizando ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Sincronizar Ahora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cola de operaciones */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Cola de Operaciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {operaciones.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium">Todo sincronizado</p>
                <p className="text-muted-foreground">No hay operaciones pendientes</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Intentos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operaciones.map((op) => (
                    <TableRow key={op.id} className="border-border/30">
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {ICONOS_OPERACION[op.tipo]}
                          {ETIQUETAS_OPERACION[op.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {JSON.stringify(op.datos)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatearTiempo(op.fecha_creacion)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={op.intentos > 1 ? 'destructive' : 'secondary'}>
                          {op.intentos}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {op.error ? (
                          <div className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">{op.error}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-500">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Pendiente</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reintentarOperacion(op.id)}
                            disabled={!estaConectado}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => eliminarOperacion(op.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
