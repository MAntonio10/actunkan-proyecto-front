'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Calculator,
  DollarSign,
  Banknote,
  Lock,
  LockOpen,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  EyeOff,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { HistorialCierresCaja } from '@/componentes/historial_cierres_caja'
import { cn } from '@/lib/utils'
import {
  type AperturaCajaBackend,
  type ArqueoCaja,
} from '@/tipos'

// Los montos son Decimal(18,4) en Prisma y viajan como cadena ("500.0000")
// para no perder precisión. Se convierten siempre antes de operar con ellos.
function aNumero(valor: string | number | undefined | null): number {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor
  return typeof n === 'number' && !isNaN(n) ? n : 0
}

function moneda(valor: string | number | undefined): string {
  return `Q${aNumero(valor).toFixed(2)}`
}

function formatearFechaHora(valor?: string): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function CierreDiarioPage() {
  const { puedeAccion, cargandoModulos } = useAutenticacion()

  // Cada acción se habilita con el permiso que exige su endpoint: abrir y
  // cerrar caja son Cajas/Crear, no basta con Cajas/Ver. Se usa puedeAccion
  // (GET /modulos/mis-modulos) porque es la lista de acciones realmente
  // concedidas; usuario.permiso de /auth/me no siempre viene expandido.
  const puedeOperarCaja = puedeAccion('Cajas', 'Crear')
  // Cajas/Editar es supervisión: ver el arqueo previo, anular un cierre y
  // consultar el historial. Quien cuenta el efectivo no debe ver el monto
  // esperado antes de contarlo, o el arqueo deja de ser un control.
  const puedeSupervisar = puedeAccion('Cajas', 'Editar')

  const [cajaActual, setCajaActual] = useState<AperturaCajaBackend | null>(null)
  const [arqueo, setArqueo] = useState<ArqueoCaja | null>(null)
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState('caja')
  // Se incrementa al cerrar una caja, para que el historial de cierres lo vea
  const [refrescarCierres, setRefrescarCierres] = useState(0)

  // Apertura
  const [dialogoApertura, setDialogoApertura] = useState(false)
  const [montoInicial, setMontoInicial] = useState('')
  const [observacionesApertura, setObservacionesApertura] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  // Cierre
  const [dialogoCierre, setDialogoCierre] = useState(false)
  const [montoContado, setMontoContado] = useState('')
  const [observacionesCierre, setObservacionesCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    try {
      const caja = await api.cajas.getActual()
      setCajaActual(caja)

      // El arqueo previo solo lo puede pedir un supervisor (Cajas/Editar)
      setArqueo(
        caja && puedeSupervisar ? await api.cajas.getArqueo(caja.id).catch(() => null) : null,
      )
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo cargar el estado de caja'
      toast.error('Error al cargar la caja', { description: mensaje })
    } finally {
      setCargando(false)
    }
  }, [puedeSupervisar])

  useEffect(() => {
    cargarTodo()
  }, [cargarTodo])

  const handleAbrirCaja = async () => {
    const monto = parseFloat(montoInicial)
    if (isNaN(monto) || monto < 0) {
      toast.error('Monto inicial no válido')
      return
    }
    setAbriendo(true)
    try {
      await api.cajas.abrir({
        montoInicial: monto,
        observaciones: observacionesApertura || undefined,
      })
      toast.success('Caja abierta', { description: `Fondo inicial ${moneda(monto)}` })
      setDialogoApertura(false)
      setMontoInicial('')
      setObservacionesApertura('')
      await cargarTodo()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo abrir la caja'
      toast.error('Error al abrir la caja', { description: mensaje })
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrarCaja = async () => {
    if (!cajaActual) return
    const monto = parseFloat(montoContado)
    if (isNaN(monto) || monto < 0) {
      toast.error('Monto contado no válido')
      return
    }
    setCerrando(true)
    try {
      const res = await api.cajas.cerrar(cajaActual.id, {
        montoContado: monto,
        observaciones: observacionesCierre || undefined,
      })
      const diferencia = aNumero(res.cierre?.diferencia)
      const detalleDif =
        diferencia === 0
          ? 'Arqueo exacto sin diferencia'
          : `Diferencia: ${moneda(diferencia)} (${diferencia > 0 ? 'sobrante' : 'faltante'})`
      toast.success('Caja cerrada exitosamente', { description: detalleDif })
      setDialogoCierre(false)
      setMontoContado('')
      setObservacionesCierre('')
      setRefrescarCierres((n) => n + 1)
      await cargarTodo()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo cerrar la caja'
      toast.error('Error al cerrar la caja', { description: mensaje })
    } finally {
      setCerrando(false)
    }
  }

  const diferenciaPreview =
    arqueo && montoContado !== ''
      ? parseFloat(montoContado) - aNumero(arqueo.montoEsperado)
      : null

  return (
    <RutaProtegida moduloRequerido="Cajas">
      <div className="min-h-screen bg-background">
        <BarraNavegacionSuperior />

        <main className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="h-6 w-6 text-primary" />
                Caja y Cierre Contable
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Apertura, arqueo y cierre de la caja del turno
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cargarTodo}
                disabled={cargando}
                className="gap-2 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>

              {!cargando && puedeOperarCaja && !cajaActual && (
                <Button
                  onClick={() => setDialogoApertura(true)}
                  className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer"
                >
                  <LockOpen className="h-4 w-4" />
                  Abrir Caja
                </Button>
              )}

              {!cargando && puedeOperarCaja && cajaActual && (
                <Button
                  onClick={() => setDialogoCierre(true)}
                  className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  Cerrar Caja
                </Button>
              )}
            </div>
          </div>

          {cargando || cargandoModulos ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando estado de caja...</p>
            </div>
          ) : (
            <>
              {puedeSupervisar && (
                <div className="mb-4">
                  <Tabs value={pestana} onValueChange={setPestana}>
                    <TabsList className="grid w-full bg-muted/60 p-1 gap-1 grid-cols-2 sm:w-[320px]">
                      <TabsTrigger value="caja" className="gap-2 font-semibold cursor-pointer">
                        <Calculator className="h-4 w-4 text-primary" />
                        Arqueo
                      </TabsTrigger>
                      <TabsTrigger value="cierres" className="gap-2 font-semibold cursor-pointer">
                        <ClipboardCheck className="h-4 w-4 text-primary" />
                        Cierres
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {pestana === 'caja' && !cajaActual && (
                <Card className="bg-card/80 backdrop-blur-sm border-amber-500/40">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h2 className="text-xl font-bold text-foreground">No hay caja abierta</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {puedeOperarCaja
                          ? 'Debe abrir la caja antes de poder emitir tickets. Solo puede existir una caja abierta a la vez en todo el sistema.'
                          : 'Sin una caja abierta no se pueden emitir tickets. Su cuenta solo tiene permiso de consulta: solicite a un encargado que abra la caja.'}
                      </p>
                    </div>
                    {puedeOperarCaja && (
                      <Button
                        onClick={() => setDialogoApertura(true)}
                        className="gap-2 cursor-pointer"
                      >
                        <LockOpen className="h-4 w-4" />
                        Abrir Caja
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {pestana === 'caja' && cajaActual && (
                <div className="space-y-6">
                  {/* Estado de la caja abierta */}
                  <Card className="bg-primary/5 border-primary/30">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                          <LockOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            Caja abierta por {cajaActual.usuario?.nombre || 'Usuario'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Desde {formatearFechaHora(cajaActual.fechaCreacion)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 font-semibold"
                      >
                        {cajaActual.estado?.nombre || 'Abierta'}
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* El arqueo previo es supervisión: quien cuenta el efectivo
                      no debe ver el monto esperado antes de contarlo. */}
                  {!puedeSupervisar && (
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="p-4 flex items-start gap-3">
                        <EyeOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-foreground">
                            Arqueo reservado a supervisión
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            El monto esperado no se muestra a quien cuenta el efectivo. Al cerrar,
                            ingrese lo contado físicamente; el sistema registrará la diferencia.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div
                    className={cn(
                      'grid gap-4',
                      puedeSupervisar ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1',
                    )}
                  >
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Fondo Inicial</p>
                            <p className="text-2xl font-bold">
                              {moneda(arqueo?.montoInicial ?? cajaActual.montoInicial)}
                            </p>
                          </div>
                          <DollarSign className="h-7 w-7 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    {puedeSupervisar && (
                      <>
                        <Card className="bg-emerald-500/10 border-emerald-500/30">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Ventas en Efectivo</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                  {moneda(arqueo?.ventasEfectivo)}
                                </p>
                              </div>
                              <TrendingUp className="h-7 w-7 text-emerald-500/60" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-primary/10 border-primary/30">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Monto Esperado</p>
                                <p className="text-2xl font-bold text-primary">
                                  {moneda(arqueo?.montoEsperado)}
                                </p>
                              </div>
                              <Banknote className="h-7 w-7 text-primary/60" />
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>

                  {puedeSupervisar && (
                    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Cómo se calcula el arqueo</CardTitle>
                        <CardDescription>
                          El servidor calcula el monto esperado sumando el fondo inicial y las ventas en efectivo; al cerrar se compara contra lo contado físicamente.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground font-mono bg-muted/40 rounded-lg p-3">
                          {moneda(arqueo?.montoInicial)} (fondo) + {moneda(arqueo?.ventasEfectivo)}{' '}
                          (ventas efectivo) ={' '}
                          <span className="text-foreground font-bold">
                            {moneda(arqueo?.montoEsperado)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Las ventas con tarjeta no entran al arqueo de efectivo de caja.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {pestana === 'cierres' && puedeSupervisar && (
                <HistorialCierresCaja
                  refrescarToken={refrescarCierres}
                  onCambio={cargarTodo}
                />
              )}
            </>
          )}
        </main>

        {/* Diálogo: Abrir caja */}
        <Dialog open={dialogoApertura} onOpenChange={setDialogoApertura}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir Caja</DialogTitle>
              <DialogDescription>
                Registre el fondo inicial con el que arranca el turno. La apertura no se puede
                editar después, solo anular.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="monto-inicial">Monto Inicial (Q)</Label>
                <Input
                  id="monto-inicial"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs-apertura">Observaciones (opcional)</Label>
                <Textarea
                  id="obs-apertura"
                  placeholder="Ej. Fondo del turno matutino"
                  value={observacionesApertura}
                  onChange={(e) => setObservacionesApertura(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogoApertura(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button onClick={handleAbrirCaja} disabled={abriendo} className="gap-2 cursor-pointer">
                {abriendo ? <Spinner className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                Abrir Caja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: Cerrar caja */}
        <Dialog open={dialogoCierre} onOpenChange={setDialogoCierre}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Cierre de Caja</DialogTitle>
              <DialogDescription>
                Ingrese el efectivo contado físicamente. El cierre no se puede editar después, solo
                anular.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* El monto esperado solo se muestra a supervisión: verlo antes
                  de contar invalida el arqueo como control. */}
              {puedeSupervisar ? (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto esperado</span>
                    <span className="font-bold text-foreground">
                      {moneda(arqueo?.montoEsperado)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <EyeOff className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Cuente el efectivo e ingrese el total. El sistema comparará contra lo esperado
                    y dejará registrada la diferencia.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="monto-contado">Monto Contado (Q)</Label>
                <Input
                  id="monto-contado"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={montoContado}
                  onChange={(e) => setMontoContado(e.target.value)}
                  className="h-11"
                />
                {puedeSupervisar && diferenciaPreview !== null && !isNaN(diferenciaPreview) && (
                  <p
                    className={`text-sm font-medium ${
                      diferenciaPreview === 0
                        ? 'text-emerald-600'
                        : diferenciaPreview > 0
                          ? 'text-blue-600'
                          : 'text-destructive'
                    }`}
                  >
                    {diferenciaPreview === 0
                      ? 'El arqueo cuadra exactamente.'
                      : `Diferencia: ${moneda(diferenciaPreview)} (${
                          diferenciaPreview > 0 ? 'sobrante' : 'faltante'
                        })`}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-cierre">Observaciones (opcional)</Label>
                <Textarea
                  id="obs-cierre"
                  placeholder="Ej. Faltante detectado, se revisará con el cajero"
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogoCierre(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button onClick={handleCerrarCaja} disabled={cerrando} className="gap-2 cursor-pointer">
                {cerrando ? <Spinner className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                Confirmar Cierre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RutaProtegida>
  )
}
