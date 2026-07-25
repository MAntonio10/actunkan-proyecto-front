'use client'

import { useState } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  Calculator, 
  DollarSign, 
  Users, 
  Ticket,
  TreePine,
  CreditCard,
  Banknote,
  Lock,
  Calendar,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { TIPOS_ACCESO } from '@/tipos'

// Datos de ejemplo para el cierre del dia
const DATOS_CIERRE = {
  fecha: new Date(),
  total_tickets: 47,
  total_visitantes: 156,
  total_recaudado: 2340,
  total_aportes: 94,
  total_efectivo: 1560,
  total_tarjeta: 780,
  desglose: [
    { tipo: 'Entrada General', tickets: 28, personas: 89, monto: 1335 },
    { tipo: 'Entrada Estudiante', tickets: 12, personas: 45, monto: 450 },
    { tipo: 'Entrada Tercera Edad', tickets: 4, personas: 12, monto: 96 },
    { tipo: 'Entrada Ninos', tickets: 3, personas: 10, monto: 50 },
    { tipo: 'Tour Guiado', tickets: 0, personas: 0, monto: 0 },
  ],
}

const CIERRES_ANTERIORES = [
  { fecha: '2026-03-06', tickets: 52, visitantes: 178, total: 2670, estado: 'cerrado' },
  { fecha: '2026-03-05', tickets: 38, visitantes: 124, total: 1860, estado: 'cerrado' },
  { fecha: '2026-03-04', tickets: 45, visitantes: 152, total: 2280, estado: 'cerrado' },
  { fecha: '2026-03-03', tickets: 61, visitantes: 203, total: 3045, estado: 'cerrado' },
]

export default function CierreDiarioPage() {
  const [cerrando, setCerrando] = useState(false)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [notas, setNotas] = useState('')

  const formatearFecha = (fecha: Date | string) => {
    const d = typeof fecha === 'string' ? new Date(fecha) : fecha
    return new Intl.DateTimeFormat('es-GT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  }

  const formatearFechaCorta = (fecha: string) => {
    return new Intl.DateTimeFormat('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(fecha))
  }

  const realizarCierre = async () => {
    setCerrando(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setCerrando(false)
    setDialogoAbierto(false)
    
    toast.success('Cierre completado', {
      description: 'El cierre contable del dia ha sido registrado exitosamente.',
    })
  }

  return (
    <RutaProtegida moduloRequerido="Cierre Diario">
      <div className="min-h-screen bg-background">
        <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Cierre Contable Diario
            </h1>
            <p className="text-muted-foreground">{formatearFecha(DATOS_CIERRE.fecha)}</p>
          </div>
          
          <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Lock className="h-4 w-4" />
                Cerrar Caja del Dia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar Cierre de Caja</DialogTitle>
                <DialogDescription>
                  Esta accion registrara el cierre contable del dia. Una vez cerrado, no se podran agregar mas transacciones a esta fecha.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Recaudado</p>
                    <p className="text-xl font-bold">${DATOS_CIERRE.total_recaudado.toFixed(2)}</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Visitantes</p>
                    <p className="text-xl font-bold">{DATOS_CIERRE.total_visitantes}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Notas del cierre (opcional)</label>
                  <Textarea
                    placeholder="Agregar observaciones..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
                  Cancelar
                </Button>
                <Button onClick={realizarCierre} disabled={cerrando}>
                  {cerrando ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Confirmar Cierre
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Resumen principal */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recaudado</p>
                  <p className="text-3xl font-bold text-primary">${DATOS_CIERRE.total_recaudado.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visitantes</p>
                  <p className="text-3xl font-bold">{DATOS_CIERRE.total_visitantes}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Emitidos</p>
                  <p className="text-3xl font-bold">{DATOS_CIERRE.total_tickets}</p>
                </div>
                <Ticket className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aportes Reforestacion</p>
                  <p className="text-3xl font-bold text-green-600">${DATOS_CIERRE.total_aportes.toFixed(2)}</p>
                </div>
                <TreePine className="h-8 w-8 text-green-500/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Desglose por tipo de acceso */}
          <div className="lg:col-span-2">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Desglose por Tipo de Acceso</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Tipo de Acceso</TableHead>
                      <TableHead className="text-center">Tickets</TableHead>
                      <TableHead className="text-center">Personas</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DATOS_CIERRE.desglose.map((item) => (
                      <TableRow key={item.tipo} className="border-border/30">
                        <TableCell className="font-medium">{item.tipo}</TableCell>
                        <TableCell className="text-center">{item.tickets}</TableCell>
                        <TableCell className="text-center">{item.personas}</TableCell>
                        <TableCell className="text-right font-mono">${item.monto.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-border bg-muted/30">
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-center font-bold">{DATOS_CIERRE.total_tickets}</TableCell>
                      <TableCell className="text-center font-bold">{DATOS_CIERRE.total_visitantes}</TableCell>
                      <TableCell className="text-right font-bold font-mono">${DATOS_CIERRE.total_recaudado.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Panel derecho */}
          <div className="space-y-4">
            {/* Desglose por metodo de pago */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Metodos de Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-500" />
                    <span>Efectivo</span>
                  </div>
                  <span className="font-mono font-medium">${DATOS_CIERRE.total_efectivo.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <span>Tarjeta</span>
                  </div>
                  <span className="font-mono font-medium">${DATOS_CIERRE.total_tarjeta.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cierres anteriores */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cierres Anteriores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {CIERRES_ANTERIORES.map((cierre) => (
                  <div key={cierre.fecha} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium">{formatearFechaCorta(cierre.fecha)}</p>
                      <p className="text-xs text-muted-foreground">{cierre.visitantes} visitantes</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">${cierre.total.toFixed(2)}</p>
                      <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                        Cerrado
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      </div>
    </RutaProtegida>
  )
}
