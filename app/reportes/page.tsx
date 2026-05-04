'use client'

import { useState } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  Download,
  Calendar,
  Users,
  DollarSign,
  Ticket,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ESTADISTICAS_SEMANA } from '@/tipos'

// Datos para graficos
const datosVisitantesSemana = ESTADISTICAS_SEMANA.map(d => ({
  fecha: new Intl.DateTimeFormat('es-GT', { weekday: 'short', day: 'numeric' }).format(d.fecha),
  visitantes: d.visitantes,
  ingresos: d.ingresos,
}))

const datosIngresosPorTipo = [
  { nombre: 'General', valor: 1335, color: 'hsl(var(--primary))' },
  { nombre: 'Estudiante', valor: 450, color: 'hsl(160 60% 45%)' },
  { nombre: 'Tercera Edad', valor: 96, color: 'hsl(200 60% 50%)' },
  { nombre: 'Ninos', valor: 50, color: 'hsl(280 60% 50%)' },
  { nombre: 'Tour Guiado', valor: 409, color: 'hsl(40 70% 50%)' },
]

const datosNacionalidades = [
  { nacionalidad: 'Guatemalteco', cantidad: 245 },
  { nacionalidad: 'Estadounidense', cantidad: 89 },
  { nacionalidad: 'Mexicano', cantidad: 67 },
  { nacionalidad: 'Europeo', cantidad: 45 },
  { nacionalidad: 'Otros', cantidad: 34 },
]

const COLORES_PIE = ['hsl(var(--primary))', 'hsl(160 60% 45%)', 'hsl(200 60% 50%)', 'hsl(280 60% 50%)', 'hsl(40 70% 50%)']

export default function ReportesPage() {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('7dias')

  // Calcular totales
  const totalVisitantes = ESTADISTICAS_SEMANA.reduce((acc, d) => acc + d.visitantes, 0)
  const totalIngresos = ESTADISTICAS_SEMANA.reduce((acc, d) => acc + d.ingresos, 0)
  const totalTickets = ESTADISTICAS_SEMANA.reduce((acc, d) => acc + d.tickets_emitidos, 0)
  const promedioVisitantesDia = Math.round(totalVisitantes / ESTADISTICAS_SEMANA.length)

  return (
    <div className="min-h-screen bg-background">
      <BarraNavegacionSuperior />
      
      <main className="container mx-auto px-4 py-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Reportes y Estadisticas
            </h1>
            <p className="text-muted-foreground">Analisis de datos y tendencias del parque</p>
          </div>
          
          <div className="flex gap-2">
            <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7dias">Ultimos 7 dias</SelectItem>
                <SelectItem value="30dias">Ultimos 30 dias</SelectItem>
                <SelectItem value="90dias">Ultimos 90 dias</SelectItem>
                <SelectItem value="anio">Este ano</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Visitantes</p>
                  <p className="text-2xl font-bold">{totalVisitantes.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                  <p className="text-2xl font-bold">${totalIngresos.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Emitidos</p>
                  <p className="text-2xl font-bold">{totalTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Promedio/Dia</p>
                  <p className="text-2xl font-bold">{promedioVisitantesDia}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Grafico de tendencia de visitantes */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Tendencia de Visitantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosVisitantesSemana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="fecha" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="visitantes" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      name="Visitantes"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Grafico de ingresos por tipo */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Ingresos por Tipo de Entrada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosIngresosPorTipo}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="valor"
                      nameKey="nombre"
                      label={({ nombre, percent }) => `${nombre} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {datosIngresosPorTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`$${value}`, 'Ingresos']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grafico de ingresos diarios */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Ingresos Diarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosVisitantesSemana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="fecha" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value}`, 'Ingresos']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar 
                      dataKey="ingresos" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Ingresos"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top nacionalidades */}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Visitantes por Nacionalidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosNacionalidades} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      type="category" 
                      dataKey="nacionalidad" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar 
                      dataKey="cantidad" 
                      fill="hsl(160 60% 45%)" 
                      radius={[0, 4, 4, 0]}
                      name="Visitantes"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
