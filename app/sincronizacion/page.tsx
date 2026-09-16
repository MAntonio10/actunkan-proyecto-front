'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle,
  CloudCog,
  CloudOff,
  Clock,
  Compass,
  KeyRound,
  ListChecks,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Ticket,
  Trash2,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import {
  almacenamientoEsPersistente,
  db,
  obtenerIdDispositivo,
  usoDeAlmacenamiento,
} from '@/lib/db_tickets'
import { hayCriptoDisponible } from '@/lib/cripto_offline'
import { diagnosticarOffline, type DiagnosticoOffline } from '@/lib/diagnostico_offline'
import { anularVentaLocal, aplicarSeleccionDeSubida } from '@/lib/emision_offline'
import {
  asegurarFolios,
  conciliarLoteActual,
  estadoFolios,
  ErrorVentasPendientes,
  TAMANO_LOTE,
  UMBRAL_AVISO,
  type EstadoFolios,
} from '@/lib/folios_offline'
import {
  descartarVentaRechazada,
  estadoActual,
  fijarModoAutomatico,
  sincronizar,
  suscribirSincronizacion,
  type EstadoSincronizacion,
} from '@/lib/sincronizador_tickets'
import { type VentaPendienteLocal } from '@/tipos'

/**
 * Panel de la operación sin conexión.
 *
 * Es el único lugar donde se pueden resolver las ventas que quedaron a medias:
 * las rechazadas por el servidor, las anuladas cuya baja no llegó a aplicarse y
 * las que el operador decidió retener. El indicador de la barra superior avisa
 * de que existen; acá se hacen.
 *
 * No consulta la API para dibujarse: todo sale de IndexedDB. Por eso está entre
 * las rutas que el Service Worker precachea y sigue disponible sin señal.
 */

function moneda(valor: string | number): string {
  const numero = typeof valor === 'number' ? valor : parseFloat(valor)
  return `Q${(Number.isFinite(numero) ? numero : 0).toFixed(2)}`
}

function hora(valor?: string | null): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

interface ConfigEstado {
  etiqueta: string
  clase: string
  icono: typeof Clock
}

function configDe(venta: VentaPendienteLocal): ConfigEstado {
  switch (venta.estado) {
    case 'anulada':
      return {
        etiqueta: 'Anulada',
        clase: 'border-destructive/50 text-destructive bg-destructive/10',
        icono: Ban,
      }
    case 'rechazada':
      return {
        etiqueta: 'Rechazada',
        clase: 'border-destructive/50 text-destructive bg-destructive/10',
        icono: TriangleAlert,
      }
    case 'retenida':
      return {
        etiqueta: 'Retenida',
        clase: 'border-slate-500/50 text-slate-600 dark:text-slate-300 bg-slate-500/10',
        icono: PauseCircle,
      }
    case 'enviando':
      return {
        etiqueta: 'Subiendo',
        clase: 'border-sky-500/50 text-sky-600 dark:text-sky-400 bg-sky-500/10',
        icono: RefreshCw,
      }
    default:
      return {
        etiqueta: 'Pendiente',
        clase: 'border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15',
        icono: Clock,
      }
  }
}

export default function SincronizacionPage() {
  const { enLinea, soloSincronizacion, avisoSesion, usuario } = useAutenticacion()

  const [estado, setEstado] = useState<EstadoSincronizacion | null>(null)
  const [folios, setFolios] = useState<EstadoFolios | null>(null)
  const [ventas, setVentas] = useState<VentaPendienteLocal[]>([])
  const [trabajando, setTrabajando] = useState(false)
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [uso, setUso] = useState<{ usado: number; total: number } | null>(null)
  const [offline, setOffline] = useState<DiagnosticoOffline | null>(null)

  const [aAnular, setAAnular] = useState<VentaPendienteLocal | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [aDescartar, setADescartar] = useState<VentaPendienteLocal | null>(null)

  /** Selección de qué ventas entran en la próxima subida. Mientras está activa
   *  nada se guarda: los cambios se aplican al confirmar y se tiran al cancelar. */
  const [personalizando, setPersonalizando] = useState(false)
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({})

  const releer = useCallback(async () => {
    const [cola, inventario, protegido, espacio] = await Promise.all([
      db.ventasPendientes.orderBy('fechaCreacion').reverse().toArray(),
      estadoFolios(),
      almacenamientoEsPersistente(),
      usoDeAlmacenamiento(),
    ])
    setPersistente(protegido)
    setUso(espacio)
    // Las ya subidas salen de la lista: no piden nada. Las anuladas se quedan
    // como registro de lo ocurrido en el turno.
    setVentas(cola.filter((v) => v.estado !== 'sincronizada'))
    setFolios(inventario)
  }, [])

  useEffect(() => {
    void releer()
    return suscribirSincronizacion((nuevo) => {
      setEstado(nuevo)
      void releer()
    })
  }, [releer])

  useEffect(() => {
    void estadoActual().then(setEstado)
  }, [])

  // El worker puede tardar en activarse tras la primera carga, así que se
  // consulta al montar y no dentro de `releer`, que corre en cada cambio.
  useEffect(() => {
    let vigente = true
    void diagnosticarOffline().then((d) => {
      if (vigente) setOffline(d)
    })
    return () => {
      vigente = false
    }
  }, [])

  const totales = useMemo(() => {
    const suma = (filtro: (v: VentaPendienteLocal) => boolean) =>
      ventas
        .filter(filtro)
        .reduce((acc, v) => acc + (parseFloat(v.resumen.montoTotal) || 0), 0)

    return {
      porSubir: suma((v) => v.estado === 'pendiente' || v.estado === 'enviando'),
      retenido: suma((v) => v.estado === 'retenida'),
      enRiesgo: suma((v) => v.estado === 'rechazada'),
      anulado: suma((v) => v.estado === 'anulada'),
    }
  }, [ventas])

  const conProteccion = useCallback(
    async (accion: () => Promise<void>) => {
      if (trabajando) return
      setTrabajando(true)
      try {
        await accion()
      } finally {
        setTrabajando(false)
        await releer()
      }
    },
    [trabajando, releer],
  )

  const subirAhora = () =>
    conProteccion(async () => {
      const resultado = await sincronizar({ forzar: true })
      if (resultado.pendientes === 0 && resultado.rechazadas === 0) {
        toast.success('Todo sincronizado')
      } else if (resultado.ultimoError) {
        toast.error('No se pudo completar', { description: resultado.ultimoError })
      }
    })

  /** Ventas sobre las que se puede decidir. Las rechazadas y anuladas no
   *  entran: no hay nada que elegir, el servidor ya dijo que no o alguien las
   *  dio de baja. */
  const seleccionables = useMemo(
    () => ventas.filter((v) => v.estado === 'pendiente' || v.estado === 'retenida'),
    [ventas],
  )

  const abrirPersonalizacion = () => {
    // Arranca reflejando lo que hay hoy: pendientes marcadas, retenidas no.
    const inicial: Record<string, boolean> = {}
    seleccionables.forEach((v) => {
      inicial[v.idLocal] = v.estado === 'pendiente'
    })
    setSeleccion(inicial)
    setPersonalizando(true)
  }

  const cancelarPersonalizacion = () => {
    setPersonalizando(false)
    setSeleccion({})
  }

  const marcadas = seleccionables.filter((v) => seleccion[v.idLocal])
  const montoMarcado = marcadas.reduce(
    (acc, v) => acc + (parseFloat(v.resumen.montoTotal) || 0),
    0,
  )

  /**
   * Guarda la selección y sale del modo. **No sube nada.**
   *
   * Elegir qué se sube y subirlo son dos decisiones distintas: dejar la
   * selección fija permite revisarla antes de mandar, y el botón "Subir ahora"
   * de arriba sigue siendo el único que mueve dinero al servidor.
   */
  const aceptarSeleccion = () =>
    conProteccion(async () => {
      await aplicarSeleccionDeSubida(new Set(marcadas.map((v) => v.idLocal)))
      setPersonalizando(false)
      setSeleccion({})

      const excluidas = seleccionables.length - marcadas.length
      toast.success('Selección guardada', {
        description:
          excluidas === 0
            ? `Las ${marcadas.length} ventas se subirán en la próxima sincronización.`
            : `${marcadas.length} se subirán y ${excluidas} quedan retenidas. Pulse Subir ahora cuando quiera enviarlas.`,
      })
    })

  const reponerFolios = () =>
    conProteccion(async () => {
      try {
        const nuevo = await asegurarFolios(TAMANO_LOTE)
        toast.success(`Inventario actualizado: ${nuevo.disponibles} folios disponibles`)
      } catch (error) {
        toast.error('No se pudieron reservar folios', {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    })

  const conciliar = () =>
    conProteccion(async () => {
      try {
        await conciliarLoteActual()
        toast.success('Lote conciliado', {
          description: 'Los folios sin usar quedaron cerrados. Ya se puede cerrar la caja.',
        })
      } catch (error) {
        if (error instanceof ErrorVentasPendientes) {
          toast.error('Quedan ventas sin resolver', { description: error.message })
          return
        }
        toast.error('No se pudo conciliar', {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    })

  const confirmarAnulacion = () =>
    conProteccion(async () => {
      if (!aAnular) return
      try {
        await anularVentaLocal(aAnular.idLocal, {
          motivo: motivoAnulacion.trim() || undefined,
          usuario: usuario?.nombre,
        })
        toast.success('Venta anulada', {
          description: 'No se subirá al servidor. El folio se cerrará al conciliar el lote.',
        })
      } catch (error) {
        toast.error('No se pudo anular', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setAAnular(null)
        setMotivoAnulacion('')
      }
    })

  const confirmarDescarte = () =>
    conProteccion(async () => {
      if (!aDescartar) return
      await descartarVentaRechazada(aDescartar.idLocal)
      toast.info('Venta descartada del dispositivo', {
        description: 'Registre el faltante al cerrar la caja.',
      })
      setADescartar(null)
    })

  const idDispositivo = typeof window !== 'undefined' ? obtenerIdDispositivo() : ''

  return (
    <RutaProtegida moduloRequerido="EmisionTickets">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <CloudCog className="h-6 w-6 text-primary" />
                Sincronización
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ventas sin subir, folios reservados y estado del modo sin conexión
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void releer()}
                disabled={trabajando}
                className="gap-2 cursor-pointer"
              >
                <RefreshCw className={cn('h-4 w-4', trabajando && 'animate-spin')} />
                Actualizar
              </Button>
              <Button
                onClick={subirAhora}
                disabled={trabajando || !enLinea || (estado?.pendientes ?? 0) === 0}
                className="gap-2 cursor-pointer"
              >
                {trabajando ? <Spinner className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                Subir ahora
              </Button>
            </div>
          </div>

          {soloSincronizacion && (
            <Card className="border-destructive/40 bg-destructive/10">
              <CardContent className="py-4 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <p className="font-bold">Sesión limitada a sincronización</p>
                  <p className="mt-0.5">
                    {avisoSesion ??
                      'Su usuario fue deshabilitado. Esta sesión solo permite subir y conciliar las ventas offline pendientes.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={enLinea ? 'border-primary/30 bg-primary/5' : 'border-amber-500/40 bg-amber-500/10'}>
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={cn(
                    'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
                    enLinea ? 'bg-primary/15 text-primary' : 'bg-amber-500/20 text-amber-600',
                  )}
                >
                  {enLinea ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Conexión
                  </p>
                  <p className="text-lg font-bold">{enLinea ? 'En línea' : 'Sin conexión'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Por subir
                </p>
                <p className="text-2xl font-bold">{estado?.pendientes ?? 0}</p>
                <p className="text-xs text-muted-foreground">{moneda(totales.porSubir)}</p>
              </CardContent>
            </Card>

            <Card className={(estado?.retenidas ?? 0) > 0 ? 'border-slate-500/40' : undefined}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Retenidas
                </p>
                <p className="text-2xl font-bold">{estado?.retenidas ?? 0}</p>
                <p className="text-xs text-muted-foreground">{moneda(totales.retenido)}</p>
              </CardContent>
            </Card>

            <Card
              className={
                (estado?.rechazadas ?? 0) > 0 ? 'border-destructive/40 bg-destructive/5' : undefined
              }
            >
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Rechazadas
                </p>
                <p className="text-2xl font-bold">{estado?.rechazadas ?? 0}</p>
                <p className="text-xs text-muted-foreground">{moneda(totales.enRiesgo)}</p>
              </CardContent>
            </Card>
          </div>

          {totales.retenido > 0 && (
            <div className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-2 text-xs flex items-start gap-2">
              <PauseCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Hay {moneda(totales.retenido)} en ventas retenidas. El dinero está cobrado pero
                fuera del sistema, y el cierre de caja seguirá bloqueado hasta que las libere o las
                anule.
              </span>
            </div>
          )}

          {/* Folios */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-primary" />
                  Folios para venta sin conexión
                </CardTitle>
                <CardDescription>
                  Números de ticket pre-firmados por el servidor. Solo se gastan vendiendo sin red.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reponerFolios}
                  disabled={trabajando || !enLinea}
                  className="gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reponer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={conciliar}
                  disabled={trabajando || !enLinea || folios?.idLote == null}
                  className="gap-2 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  Conciliar lote
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {folios?.idLote == null ? (
                <p className="text-sm text-muted-foreground">
                  No hay folios reservados en este dispositivo.{' '}
                  {enLinea
                    ? 'Pulse Reponer, o abra la pantalla de emisión con una caja abierta.'
                    : 'Se necesita conexión y una caja abierta para reservarlos.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Disponibles</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        folios.disponibles === 0
                          ? 'text-destructive'
                          : folios.bajoUmbral
                            ? 'text-amber-600'
                            : 'text-foreground',
                      )}
                    >
                      {folios.disponibles}
                    </p>
                    <p className="text-[11px] text-muted-foreground">aviso bajo {UMBRAL_AVISO}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Consumidos</p>
                    <p className="text-xl font-bold">{folios.consumidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lote</p>
                    <p className="text-xl font-bold font-mono">#{folios.idLote}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vence</p>
                    <p className="text-sm font-semibold">{hora(folios.expiraEn)}</p>
                    {folios.vencido && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                      >
                        Vencido
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {folios?.bloqueado && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Los folios están bloqueados. La llave que los descifra se arma al iniciar
                    sesión y se descarta al cerrar la aplicación: vuelva a iniciar sesión para
                    poder vender sin conexión.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cola */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Cola de ventas</CardTitle>
                <CardDescription>
                  {personalizando
                    ? 'Marque en verde las que quiere subir y en rojo las que no. Nada se aplica hasta confirmar.'
                    : 'Por defecto se suben todas. Use Personalizar subida para elegir cuáles.'}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {personalizando ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelarPersonalizacion}
                      disabled={trabajando}
                      className="gap-2 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={aceptarSeleccion}
                      disabled={trabajando}
                      className="gap-2 cursor-pointer"
                    >
                      {trabajando ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      Aceptar ({marcadas.length} de {seleccionables.length})
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={abrirPersonalizacion}
                      disabled={trabajando || seleccionables.length === 0}
                      className="gap-2 cursor-pointer"
                    >
                      <ListChecks className="h-4 w-4" />
                      Personalizar subida
                    </Button>
                    <div className="flex items-center gap-2 pl-1">
                      <Label htmlFor="auto" className="text-xs font-medium cursor-pointer">
                        Automática
                      </Label>
                      <Switch
                        id="auto"
                        checked={estado?.automatico ?? true}
                        onCheckedChange={fijarModoAutomatico}
                        className="cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {personalizando && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    Quedarán marcadas para subir <strong>{marcadas.length}</strong> ventas por{' '}
                    <strong>{moneda(montoMarcado)}</strong>. Las{' '}
                    {seleccionables.length - marcadas.length} restantes quedan retenidas. Nada se
                    envía hasta pulsar <strong>Subir ahora</strong>.
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSeleccion(
                          Object.fromEntries(seleccionables.map((v) => [v.idLocal, true])),
                        )
                      }
                      className="underline font-medium cursor-pointer"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSeleccion(
                          Object.fromEntries(seleccionables.map((v) => [v.idLocal, false])),
                        )
                      }
                      className="underline font-medium cursor-pointer"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
              )}

              {ventas.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="font-medium">No hay nada pendiente</p>
                  <p className="text-sm text-muted-foreground">
                    Todas las ventas de este dispositivo están en el servidor.
                  </p>
                </div>
              ) : (
                ventas.map((v) => {
                  const config = configDe(v)
                  const Icono = config.icono
                  const anulada = v.estado === 'anulada'

                  return (
                    <div
                      key={v.idLocal}
                      className={cn(
                        'rounded-xl border p-3 space-y-2',
                        v.estado === 'rechazada'
                          ? 'border-destructive/40 bg-destructive/5'
                          : anulada
                            ? 'border-border/50 bg-muted/30 opacity-80'
                            : 'border-border/60 bg-card',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        {/* Verde = se sube, rojo = se queda. El color hace la
                            lectura de un vistazo sobre una lista larga. */}
                        {personalizando &&
                          (v.estado === 'pendiente' || v.estado === 'retenida') && (
                            <Switch
                              checked={seleccion[v.idLocal] ?? false}
                              onCheckedChange={(valor) =>
                                setSeleccion((prev) => ({ ...prev, [v.idLocal]: valor }))
                              }
                              aria-label={`Subir la venta ${v.venta.numeroTicket}`}
                              className={cn(
                                'mt-1 shrink-0 cursor-pointer',
                                seleccion[v.idLocal]
                                  ? 'data-[state=checked]:bg-emerald-600'
                                  : 'data-[state=unchecked]:bg-destructive',
                              )}
                            />
                          )}

                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs font-bold text-primary flex items-center gap-1.5 flex-wrap">
                            {v.venta.numeroTicket}
                            {v.venta.numeroTicketGuia && (
                              <span className="text-muted-foreground inline-flex items-center gap-1">
                                <Compass className="h-3 w-3" />
                                {v.venta.numeroTicketGuia}
                              </span>
                            )}
                            <Badge variant="outline" className={cn('text-[10px] gap-1', config.clase)}>
                              <Icono className="h-2.5 w-2.5" />
                              {config.etiqueta}
                            </Badge>
                          </p>
                          <p className="text-sm font-semibold mt-0.5">{v.resumen.nombreGrupo}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.resumen.atraccion} · {v.resumen.totalPersonas} Pax ·{' '}
                            {hora(v.fechaCreacion)}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'text-lg font-bold tabular-nums shrink-0',
                            anulada && 'line-through text-muted-foreground',
                          )}
                        >
                          {moneda(v.resumen.montoTotal)}
                        </p>
                      </div>

                      {v.intentos > 0 && !anulada && v.estado !== 'rechazada' && (
                        <p className="text-[11px] text-muted-foreground">
                          {v.intentos} {v.intentos === 1 ? 'intento' : 'intentos'}
                        </p>
                      )}

                      {v.estado === 'rechazada' && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-2.5 py-2 text-xs text-destructive flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>
                            {v.ultimoError}
                            {v.codigoRechazo === 'FOLIO_YA_EMITIDO' &&
                              ' Este folio se gastó dos veces: el cobro no va a poder registrarse.'}
                          </span>
                        </div>
                      )}

                      {anulada && (
                        <div className="rounded-lg bg-muted border border-border/50 px-2.5 py-2 text-xs text-muted-foreground flex items-start gap-2">
                          <Ban className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>
                            Anulada en taquilla el {hora(v.fechaAnulacion)}
                            {v.usuarioAnulacion ? ` por ${v.usuarioAnulacion}` : ''}
                            {v.motivoAnulacion ? ` · ${v.motivoAnulacion}` : ''}. No se sube al
                            servidor; el folio se cierra al conciliar el lote y el pase deja de
                            servir para ingresar.
                          </span>
                        </div>
                      )}

                      {v.discrepancia && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Cobrado {moneda(v.discrepancia.montoCobrado)}, tarifa vigente{' '}
                          {moneda(v.discrepancia.montoRecalculado)}.
                        </p>
                      )}

                      {/* Durante la selección se ocultan: mezclar decidir qué
                          se sube con anular o descartar invita al error. */}
                      {!personalizando && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/40">
                        {(v.estado === 'pendiente' || v.estado === 'retenida') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAAnular(v)
                              setMotivoAnulacion('')
                            }}
                            disabled={trabajando}
                            className="h-8 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Anular
                          </Button>
                        )}

                        {v.estado === 'rechazada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setADescartar(v)}
                            disabled={trabajando}
                            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive cursor-pointer ml-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Descartar
                          </Button>
                        )}
                      </div>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Diagnóstico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Diagnóstico del dispositivo</CardTitle>
              <CardDescription>
                Datos para revisar cuando algo no funciona como se espera.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                  <dt className="text-muted-foreground">Última sincronización</dt>
                  <dd className="font-medium">{hora(estado?.ultimaSincronizacion)}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                  <dt className="text-muted-foreground">Almacenamiento seguro</dt>
                  <dd className="font-medium">
                    {hayCriptoDisponible() ? (
                      'Disponible'
                    ) : (
                      <span className="text-destructive">No disponible — se requiere HTTPS</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                  <dt className="text-muted-foreground">Folios desbloqueados</dt>
                  <dd className="font-medium">
                    {folios?.bloqueado ? (
                      <span className="text-amber-600">No — inicie sesión otra vez</span>
                    ) : (
                      'Sí'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                  <dt className="text-muted-foreground">Modo sin conexión</dt>
                  <dd className="font-medium text-right">
                    {offline === null ? (
                      '—'
                    ) : !offline.soportado ? (
                      <span className="text-destructive">
                        No disponible — se requiere HTTPS
                      </span>
                    ) : !offline.registrado ? (
                      <span className="text-destructive">
                        Sin instalar — recargue la pantalla con conexión
                      </span>
                    ) : !offline.controlando ? (
                      <span className="text-amber-600">
                        Instalado, pendiente de recargar
                      </span>
                    ) : (
                      <>
                        Activo
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {offline.rutasGuardadas.length} pantalla
                          {offline.rutasGuardadas.length === 1 ? '' : 's'} guardada
                          {offline.rutasGuardadas.length === 1 ? '' : 's'}
                          {offline.rutasGuardadas.includes('/sincronizacion')
                            ? ''
                            : ' — esta no'}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                  <dt className="text-muted-foreground">Almacenamiento protegido</dt>
                  <dd className="font-medium">
                    {persistente === null ? (
                      '—'
                    ) : persistente ? (
                      'Sí'
                    ) : (
                      <span className="text-amber-600">
                        No — el navegador podría borrar los datos
                      </span>
                    )}
                  </dd>
                </div>
                {uso && (
                  <div className="flex justify-between gap-4 py-1 border-b border-border/40">
                    <dt className="text-muted-foreground">Espacio usado</dt>
                    <dd className="font-medium">
                      {(uso.usado / 1_048_576).toFixed(1)} MB
                      {uso.total > 0 && ` de ${(uso.total / 1_048_576).toFixed(0)} MB`}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 py-1 sm:col-span-2">
                  <dt className="text-muted-foreground shrink-0">Identificador del dispositivo</dt>
                  <dd className="font-mono text-[11px] truncate">{idDispositivo || '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {!enLinea && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CloudOff className="h-3.5 w-3.5" />
              Sin conexión: puede revisar, retener y anular. La subida se hará al recuperar la red.
            </p>
          )}
        </main>
      </div>

      {/* Anular una venta que todavía no subió */}
      <AlertDialog
        open={aAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !trabajando) setAAnular(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta venta?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{aAnular?.venta.numeroTicket}</strong> ·{' '}
                  {moneda(aAnular?.resumen.montoTotal ?? '0')}
                </p>
                <p>
                  La venta <strong>no se subirá al servidor</strong>. Su folio se declarará como no
                  utilizado al conciliar el lote, con lo que el pase impreso deja de servir para
                  ingresar. En la caja no entra ni sale dinero.
                </p>
                <p>
                  Queda registrada en este dispositivo con la fecha, el usuario y el motivo, y se
                  puede consultar desde esta misma pantalla.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-xs">
              Motivo (opcional)
            </Label>
            <Input
              id="motivo"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ej. el visitante desistió"
              className="h-9"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmarAnulacion()
              }}
              disabled={trabajando}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer gap-2"
            >
              {trabajando && <Spinner className="h-4 w-4" />}
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Descartar una rechazada: se pierde el registro del cobro */}
      <AlertDialog
        open={aDescartar !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !trabajando) setADescartar(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar esta venta del dispositivo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{aDescartar?.venta.numeroTicket}</strong> ·{' '}
                  {moneda(aDescartar?.resumen.montoTotal ?? '0')}
                </p>
                <p>
                  El servidor rechazó esta venta y no la va a aceptar. Descartarla la borra de este
                  dispositivo: el cobro deja de tener respaldo en el sistema y aparecerá como
                  faltante en el arqueo.
                </p>
                <p>Anótelo en las observaciones del cierre antes de continuar.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmarDescarte()
              }}
              disabled={trabajando}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer gap-2"
            >
              {trabajando && <Spinner className="h-4 w-4" />}
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RutaProtegida>
  )
}
