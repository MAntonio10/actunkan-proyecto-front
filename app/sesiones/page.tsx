'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MonitorSmartphone,
  LogOut,
  ShieldCheck,
  Globe,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { type SesionBackend } from '@/tipos'

function formatearFecha(valor?: string): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function SesionesPage() {
  const { cerrarTodasLasSesiones } = useAutenticacion()
  const [sesiones, setSesiones] = useState<SesionBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [cerrandoId, setCerrandoId] = useState<number | null>(null)
  const [cerrandoTodas, setCerrandoTodas] = useState(false)

  const cargarSesiones = useCallback(async () => {
    setCargando(true)
    try {
      const res = await api.auth.getSesiones()
      setSesiones(Array.isArray(res) ? res : [])
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudieron cargar las sesiones'
      toast.error('Error al cargar sesiones', { description: mensaje })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarSesiones()
  }, [cargarSesiones])

  const handleCerrarSesion = async (sesion: SesionBackend) => {
    setCerrandoId(sesion.id)
    try {
      await api.auth.eliminarSesion(sesion.id)
      toast.success('Sesión cerrada', {
        description: 'El dispositivo deberá iniciar sesión nuevamente.',
      })
      await cargarSesiones()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo cerrar la sesión'
      toast.error('Error al cerrar la sesión', { description: mensaje })
    } finally {
      setCerrandoId(null)
    }
  }

  const handleCerrarTodas = async () => {
    setCerrandoTodas(true)
    try {
      await cerrarTodasLasSesiones()
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudieron cerrar las sesiones'
      toast.error('Error al cerrar las sesiones', { description: mensaje })
      setCerrandoTodas(false)
    }
  }

  return (
    <RutaProtegida>
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-3xl">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div className="titulo-seccion">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Mis Sesiones Activas
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dispositivos donde su cuenta tiene la sesión iniciada
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={cargarSesiones}
              disabled={cargando}
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Sesiones registradas ({sesiones.length})
              </CardTitle>
              <CardDescription>
                Si no reconoce alguno de estos dispositivos, ciérrelo y cambie su contraseña.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {cargando ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Spinner className="h-7 w-7 text-primary" />
                  <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
                </div>
              ) : sesiones.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No hay otras sesiones registradas.
                </div>
              ) : (
                <div className="space-y-3">
                  {sesiones.map((s) => (
                    <div
                      key={s.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border-2 p-3 transition-colors ${
                        s.esActual
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-border/50 bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                            s.esActual
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <MonitorSmartphone className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-foreground truncate">
                              {s.dispositivo || 'Dispositivo desconocido'}
                            </p>
                            {s.esActual && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold border-primary/40 text-primary bg-primary/10"
                              >
                                Esta sesión
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Globe className="h-3.5 w-3.5" />
                              {s.ip || 'IP no registrada'}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" />
                              Inicio: {formatearFecha(s.fechaCreacion)}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground">
                            Expira: {formatearFecha(s.fechaExpira)}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCerrarSesion(s)}
                        disabled={cerrandoId === s.id}
                        className="gap-2 shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        {cerrandoId === s.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                        Cerrar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Cerrar todas las sesiones incluye <strong>la sesión actual</strong>: deberá
                    volver a iniciar sesión en este dispositivo.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full gap-2 cursor-pointer"
                      disabled={cerrandoTodas}
                    >
                      {cerrandoTodas ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      Cerrar todas las sesiones
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar todas las sesiones?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se cerrarán todos los dispositivos con su cuenta iniciada, incluido este.
                        Tendrá que iniciar sesión nuevamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCerrarTodas}
                        className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
                      >
                        Sí, cerrar todas
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </RutaProtegida>
  )
}
