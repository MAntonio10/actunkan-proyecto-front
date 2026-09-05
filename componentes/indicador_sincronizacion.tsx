'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CloudCog,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { estadoFolios, type EstadoFolios } from '@/lib/folios_offline'
import {
  fijarModoAutomatico,
  sincronizar,
  suscribirSincronizacion,
  type EstadoSincronizacion,
} from '@/lib/sincronizador_tickets'

/**
 * Estado de la venta sin conexión, para la barra superior.
 *
 * Muestra tres cosas que el taquillero necesita saber sin tener que buscarlas:
 * si hay red, cuántas ventas faltan por subir y cuántos folios quedan. También
 * expone la subida manual, para los casos en que el automático está apagado o
 * la conexión es intermitente.
 */
export function IndicadorSincronizacion() {
  const { enLinea, sesionSinConexion, soloSincronizacion, avisoSesion } = useAutenticacion()
  const [estado, setEstado] = useState<EstadoSincronizacion | null>(null)
  const [folios, setFolios] = useState<EstadoFolios | null>(null)

  useEffect(() => suscribirSincronizacion(setEstado), [])

  useEffect(() => {
    let vigente = true
    const leer = () => {
      void estadoFolios().then((f) => {
        if (vigente) setFolios(f)
      })
    }
    leer()
    const intervalo = setInterval(leer, 30_000)
    return () => {
      vigente = false
      clearInterval(intervalo)
    }
  }, [estado?.ultimaSincronizacion, estado?.pendientes])

  const pendientes = estado?.pendientes ?? 0
  const retenidas = estado?.retenidas ?? 0
  const rechazadas = estado?.rechazadas ?? 0
  const sincronizando = estado?.sincronizando ?? false
  const requierenAtencion = rechazadas

  // Sin nada que reportar no aporta nada: se oculta. El estado de la red por sí
  // solo ya lo cubre IndicadorConectividad, al lado.
  if (
    pendientes === 0 &&
    retenidas === 0 &&
    requierenAtencion === 0 &&
    !sesionSinConexion &&
    !soloSincronizacion
  ) {
    return null
  }

  const subirAhora = async () => {
    const resultado = await sincronizar({ forzar: true })
    if (resultado.pendientes === 0 && resultado.rechazadas === 0) {
      toast.success('Todas las ventas están sincronizadas')
    } else if (resultado.ultimoError) {
      toast.error('No se pudo sincronizar', { description: resultado.ultimoError })
    } else {
      toast.info(`Quedan ${resultado.pendientes} ventas por subir`)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 h-9 cursor-pointer',
            requierenAtencion > 0 && 'border-destructive/50 text-destructive',
            !enLinea &&
              requierenAtencion === 0 &&
              'border-amber-500/50 text-amber-700 dark:text-amber-300',
          )}
        >
          {sincronizando ? (
            <Spinner className="h-4 w-4" />
          ) : !enLinea ? (
            <CloudOff className="h-4 w-4" />
          ) : requierenAtencion > 0 ? (
            <TriangleAlert className="h-4 w-4" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
          <span className="text-xs font-semibold">
            {requierenAtencion > 0
              ? `${requierenAtencion} con error`
              : pendientes > 0
                ? `${pendientes} sin subir`
                : retenidas > 0
                  ? `${retenidas} retenidas`
                  : 'Sesión offline'}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {enLinea ? (
            <Wifi className="h-4 w-4 text-emerald-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-600" />
          )}
          {enLinea ? 'Con conexión' : 'Sin conexión'}
        </div>

        {soloSincronizacion && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive space-y-1">
            <p className="font-bold">Sesión limitada a sincronización</p>
            <p className="leading-relaxed">
              {avisoSesion ??
                'Su usuario fue deshabilitado. Esta sesión solo permite subir y conciliar las ventas offline pendientes.'}
            </p>
          </div>
        )}

        {sesionSinConexion && (
          <p className="text-xs text-muted-foreground">
            Sesión restaurada sin internet. Los datos del usuario y sus permisos son los del último
            inicio de sesión con conexión.
          </p>
        )}

        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ventas por subir</dt>
            <dd className="font-semibold">{pendientes}</dd>
          </div>
          {retenidas > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Retenidas a mano</dt>
              <dd className="font-semibold">{retenidas}</dd>
            </div>
          )}
          {rechazadas > 0 && (
            <div className="flex justify-between text-destructive">
              <dt>Rechazadas por el servidor</dt>
              <dd className="font-semibold">{rechazadas}</dd>
            </div>
          )}
          {(estado?.anuladas ?? 0) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Anuladas en taquilla</dt>
              <dd className="font-semibold">{estado?.anuladas}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Folios disponibles</dt>
            <dd className="font-semibold">{folios?.disponibles ?? '—'}</dd>
          </div>
          {estado?.ultimaSincronizacion && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Última subida</dt>
              <dd>{new Date(estado.ultimaSincronizacion).toLocaleTimeString('es-GT')}</dd>
            </div>
          )}
        </dl>

        {estado?.ultimoError && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{estado.ultimoError}</p>
        )}

        {requierenAtencion > 0 && (
          <p className="text-xs text-destructive">
            Hay ventas cobradas que no quedaron bien registradas. Resuélvalas en Sincronización
            antes de cerrar la caja o el arqueo no va a cuadrar.
          </p>
        )}

        <Button variant="outline" size="sm" asChild className="w-full gap-2 cursor-pointer">
          <Link href="/sincronizacion">
            <CloudCog className="h-4 w-4" />
            Abrir panel de sincronización
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <Label htmlFor="sincronizacion-automatica" className="text-xs font-medium cursor-pointer">
            Subida automática
          </Label>
          <Switch
            id="sincronizacion-automatica"
            checked={estado?.automatico ?? true}
            onCheckedChange={fijarModoAutomatico}
            className="cursor-pointer"
          />
        </div>

        <Button
          size="sm"
          onClick={subirAhora}
          disabled={sincronizando || !enLinea || pendientes === 0}
          className="w-full gap-2 cursor-pointer"
        >
          {sincronizando ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Subir ahora
        </Button>
      </PopoverContent>
    </Popover>
  )
}
