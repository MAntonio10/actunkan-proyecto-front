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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calculator,
  DollarSign,
  Banknote,
  Lock,
  LockOpen,
  CheckCircle,
  Receipt,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import {
  type AperturaCajaBackend,
  type ArqueoCaja,
  type GastoBackend,
  type TipoGastoBackend,
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
  const puedeVerGastos = puedeAccion('Gastos', 'Ver')
  const puedeCrearGastos = puedeAccion('Gastos', 'Crear')
  const puedeAnularGastos = puedeAccion('Gastos', 'Anular')

  const [cajaActual, setCajaActual] = useState<AperturaCajaBackend | null>(null)
  const [arqueo, setArqueo] = useState<ArqueoCaja | null>(null)
  const [gastos, setGastos] = useState<GastoBackend[]>([])
  const [tiposGasto, setTiposGasto] = useState<TipoGastoBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState('caja')

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

  // Gasto nuevo
  const [idTipoGasto, setIdTipoGasto] = useState('')
  const [descripcionGasto, setDescripcionGasto] = useState('')
  const [montoGasto, setMontoGasto] = useState('')
  const [guardandoGasto, setGuardandoGasto] = useState(false)

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    try {
      const caja = await api.cajas.getActual()
      setCajaActual(caja)

      setArqueo(caja ? await api.cajas.getArqueo(caja.id).catch(() => null) : null)

      // Gastos y su catálogo exigen permiso propio (sub-módulo Gastos): sin él
      // ni se piden, para no provocar un 403 inútil. Sí se consultan aunque no
      // haya caja abierta — registrar exige caja, consultar el histórico no.
      if (puedeVerGastos) {
        const resGastos = await api.gastos
          .listar(caja ? { idAperturaCaja: caja.id } : undefined)
          .catch(() => [])
        setGastos(Array.isArray(resGastos) ? resGastos : [])
      } else {
        setGastos([])
      }

      if (puedeCrearGastos) {
        const tipos = await api.tiposGasto.listar().catch(() => [])
        setTiposGasto(Array.isArray(tipos) ? tipos : [])
      }
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo cargar el estado de caja'
      toast.error('Error al cargar la caja', { description: mensaje })
    } finally {
      setCargando(false)
    }
  }, [puedeVerGastos, puedeCrearGastos])

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
      const diferencia = aNumero(res.cierre.diferencia)
      toast.success('Caja cerrada', {
        description:
          diferencia === 0
            ? 'El arqueo cuadró exactamente.'
            : `Diferencia de ${moneda(diferencia)} (${diferencia > 0 ? 'sobrante' : 'faltante'}).`,
      })
      setDialogoCierre(false)
      setMontoContado('')
      setObservacionesCierre('')
      await cargarTodo()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo cerrar la caja'
      toast.error('Error al cerrar la caja', { description: mensaje })
    } finally {
      setCerrando(false)
    }
  }

  const handleAgregarGasto = async () => {
    const monto = parseFloat(montoGasto)
    if (!idTipoGasto) {
      toast.error('Seleccione el tipo de gasto')
      return
    }
    if (!descripcionGasto.trim()) {
      toast.error('Ingrese la descripción del gasto')
      return
    }
    if (isNaN(monto) || monto <= 0) {
      toast.error('El monto del gasto debe ser mayor a Q0.00')
      return
    }

    setGuardandoGasto(true)
    try {
      await api.gastos.crear({
        idTipoGasto: Number(idTipoGasto),
        descripcion: descripcionGasto.trim(),
        monto,
      })
      toast.success('Gasto registrado', { description: `${descripcionGasto} · ${moneda(monto)}` })
      setIdTipoGasto('')
      setDescripcionGasto('')
      setMontoGasto('')
      await cargarTodo()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo registrar el gasto'
      toast.error('Error al registrar el gasto', { description: mensaje })
    } finally {
      setGuardandoGasto(false)
    }
  }

  const handleAnularGasto = async (gasto: GastoBackend) => {
    try {
      await api.gastos.anular(gasto.id)
      toast.success('Gasto anulado')
      await cargarTodo()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo anular el gasto'
      toast.error('Error al anular el gasto', { description: mensaje })
    }
  }

  const gastosVigentes = gastos.filter((g) => !g.anulado)
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
                Apertura, gastos y arqueo de la caja del turno
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
              {/* Gastos es un sub-módulo con permiso propio: sin él no se
                  muestra la pestaña y queda solo el arqueo. Las pestañas
                  existen haya o no caja abierta: registrar un gasto exige caja,
                  pero consultar el histórico no. */}
              {puedeVerGastos && (
                <div className="mb-4">
                  <Tabs value={pestana} onValueChange={setPestana}>
                    <TabsList className="grid grid-cols-2 w-full sm:w-[320px] bg-muted/60 p-1">
                      <TabsTrigger value="caja" className="gap-2 font-semibold cursor-pointer">
                        <Calculator className="h-4 w-4 text-primary" />
                        Arqueo
                      </TabsTrigger>
                      <TabsTrigger value="gastos" className="gap-2 font-semibold cursor-pointer">
                        <Receipt className="h-4 w-4 text-primary" />
                        Gastos ({gastosVigentes.length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {(pestana === 'caja' || !puedeVerGastos) && !cajaActual && (
                <Card className="bg-card/80 backdrop-blur-sm border-amber-500/40">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h2 className="text-xl font-bold text-foreground">No hay caja abierta</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {puedeOperarCaja
                          ? 'Debe abrir la caja antes de poder emitir tickets o registrar gastos. Solo puede existir una caja abierta a la vez en todo el sistema.'
                          : 'Sin una caja abierta no se pueden emitir tickets ni registrar gastos. Su cuenta solo tiene permiso de consulta: solicite a un encargado que abra la caja.'}
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

              {(pestana === 'caja' || !puedeVerGastos) && cajaActual && (
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

                  {/* Arqueo calculado por el servidor */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

                    <Card className="bg-destructive/10 border-destructive/30">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Gastos</p>
                            <p className="text-2xl font-bold text-destructive">
                              −{moneda(arqueo?.totalGastos)}
                            </p>
                          </div>
                          <TrendingDown className="h-7 w-7 text-destructive/60" />
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
                  </div>

                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Cómo se calcula el arqueo</CardTitle>
                      <CardDescription>
                        El servidor calcula el monto esperado; al cerrar se compara contra lo
                        contado físicamente.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground font-mono bg-muted/40 rounded-lg p-3">
                        {moneda(arqueo?.montoInicial)} (fondo) + {moneda(arqueo?.ventasEfectivo)}{' '}
                        (ventas efectivo) − {moneda(arqueo?.totalGastos)} (gastos) ={' '}
                        <span className="text-foreground font-bold">
                          {moneda(arqueo?.montoEsperado)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Las ventas con tarjeta no entran al arqueo de efectivo.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {pestana === 'gastos' && puedeVerGastos && (
                <div className="space-y-6">
                  {/* Un gasto solo puede crearse contra una caja abierta: sin
                      ella el backend responde 400, así que se avisa en vez de
                      mostrar un formulario que fallaría al enviarse. */}
                  {puedeCrearGastos && !cajaActual && (
                    <Card className="bg-card/80 backdrop-blur-sm border-amber-500/40">
                      <CardContent className="p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-foreground">
                            No se pueden registrar gastos ahora
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            Los gastos se cargan contra la caja abierta. Abra una caja para poder
                            registrarlos; abajo puede consultar los ya registrados.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Registrar gasto contra la caja abierta */}
                  {puedeCrearGastos && cajaActual && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Plus className="h-4 w-4 text-primary" />
                        Registrar Gasto
                      </CardTitle>
                      <CardDescription>
                        Se descuenta del arqueo. Solo se puede registrar con la caja abierta.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Tipo de Gasto</Label>
                          <Select value={idTipoGasto} onValueChange={setIdTipoGasto}>
                            <SelectTrigger className="h-10 bg-muted/50 border-border/50">
                              <SelectValue placeholder="Seleccione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tiposGasto
                                .filter((t) => !t.anulado)
                                .map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.nombre}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5 sm:col-span-1">
                          <Label className="text-xs text-muted-foreground">Descripción</Label>
                          <Input
                            placeholder="Ej. Compra de insumos"
                            value={descripcionGasto}
                            onChange={(e) => setDescripcionGasto(e.target.value)}
                            className="h-10 bg-muted/50 border-border/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Monto (Q)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            value={montoGasto}
                            onChange={(e) => setMontoGasto(e.target.value)}
                            className="h-10 bg-muted/50 border-border/50"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleAgregarGasto}
                        disabled={guardandoGasto}
                        className="w-full sm:w-auto gap-2 cursor-pointer"
                      >
                        {guardandoGasto ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Registrar Gasto
                      </Button>
                    </CardContent>
                  </Card>
                  )}

                  {/* Gastos de la caja actual */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" />
                        {cajaActual ? 'Gastos de esta caja' : 'Gastos registrados'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50">
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gastos.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-8 text-muted-foreground text-sm"
                              >
                                No hay gastos registrados en esta caja.
                              </TableCell>
                            </TableRow>
                          ) : (
                            gastos.map((g) => (
                              <TableRow
                                key={g.id}
                                className={`border-border/30 ${g.anulado ? 'opacity-50' : ''}`}
                              >
                                <TableCell className="font-medium">
                                  {g.tipoGasto?.nombre || '—'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {g.descripcion}
                                  {g.anulado && (
                                    <Badge
                                      variant="outline"
                                      className="ml-2 text-[10px] border-destructive/40 text-destructive"
                                    >
                                      Anulado
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  {moneda(g.monto)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatearFechaHora(g.fechaCreacion)}
                                </TableCell>
                                <TableCell>
                                  {/* Anular exige que la caja del gasto siga
                                      abierta; en una cerrada el backend da 400 */}
                                  {!g.anulado &&
                                    puedeAnularGastos &&
                                    g.idAperturaCaja === cajaActual?.id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAnularGasto(g)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                                      aria-label="Anular gasto"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
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
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto esperado</span>
                  <span className="font-bold text-foreground">{moneda(arqueo?.montoEsperado)}</span>
                </div>
              </div>

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
                {diferenciaPreview !== null && !isNaN(diferenciaPreview) && (
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
