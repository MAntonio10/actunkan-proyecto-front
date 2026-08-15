'use client'

import { useState, useCallback, useRef } from 'react'
import {
  QrCode,
  Keyboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldX,
  SearchX,
  Camera,
  CameraOff,
  RotateCcw,
} from 'lucide-react'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { EscanerQR } from '@/componentes/escaner_qr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError } from '@/lib/api'
import { type TicketBackend } from '@/tipos'

type EstadoResultado = 'autorizado' | 'firma_invalida' | 'no_existe' | 'rechazado' | 'error'

interface Resultado {
  estado: EstadoResultado
  mensaje: string
  ticket?: TicketBackend
}

// El backend distingue cada caso por código HTTP; se muestran diferenciados
// porque un 409 por reuso (alguien intenta entrar dos veces con el mismo pase)
// no es lo mismo que un QR alterado o inexistente.
const ESTILO_RESULTADO: Record<
  EstadoResultado,
  { icono: typeof CheckCircle2; titulo: string; clases: string; colorIcono: string }
> = {
  autorizado: {
    icono: CheckCircle2,
    titulo: 'Ingreso autorizado',
    clases: 'border-emerald-500/50 bg-emerald-500/10',
    colorIcono: 'text-emerald-500',
  },
  rechazado: {
    icono: AlertTriangle,
    titulo: 'Ticket no válido para ingresar',
    clases: 'border-amber-500/50 bg-amber-500/10',
    colorIcono: 'text-amber-500',
  },
  firma_invalida: {
    icono: ShieldX,
    titulo: 'Código QR inválido o alterado',
    clases: 'border-destructive/50 bg-destructive/10',
    colorIcono: 'text-destructive',
  },
  no_existe: {
    icono: SearchX,
    titulo: 'El ticket no existe',
    clases: 'border-destructive/50 bg-destructive/10',
    colorIcono: 'text-destructive',
  },
  error: {
    icono: XCircle,
    titulo: 'Error al validar',
    clases: 'border-destructive/50 bg-destructive/10',
    colorIcono: 'text-destructive',
  },
}

function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ValidarTicketPage() {
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [validando, setValidando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [folioManual, setFolioManual] = useState('')
  // Evita revalidar en bucle: la cámara emite el mismo QR muchas veces por segundo
  const ultimoEscaneado = useRef<string | null>(null)

  const validar = useCallback(async (numeroTicket: string, firma?: string) => {
    setValidando(true)
    try {
      const res = await api.tickets.validar({ numeroTicket, firma })
      setResultado({
        estado: res.valido ? 'autorizado' : 'rechazado',
        mensaje: res.mensaje,
        ticket: res.ticket,
      })
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined
      const mensaje = err instanceof Error ? err.message : 'No se pudo validar el ticket'
      const estado: EstadoResultado =
        status === 401
          ? 'firma_invalida'
          : status === 404
            ? 'no_existe'
            : status === 409
              ? 'rechazado'
              : 'error'
      setResultado({ estado, mensaje })
    } finally {
      setValidando(false)
    }
  }, [])

  const handleDetectado = useCallback(
    (texto: string) => {
      if (validando || texto === ultimoEscaneado.current) return
      ultimoEscaneado.current = texto

      // El QR lleva el JSON { numeroTicket, firma } que generó el backend.
      // Si viniera texto plano, se asume que es el folio.
      let numeroTicket = texto
      let firma: string | undefined
      try {
        const datos = JSON.parse(texto)
        if (datos?.numeroTicket) {
          numeroTicket = datos.numeroTicket
          firma = datos.firma
        }
      } catch {
        // No es JSON: se envía el contenido tal cual como folio
      }

      setCamaraActiva(false)
      validar(numeroTicket, firma)
    },
    [validar, validando],
  )

  const handleValidarManual = () => {
    const folio = folioManual.trim()
    if (!folio) return
    ultimoEscaneado.current = null
    validar(folio)
  }

  const reiniciar = () => {
    setResultado(null)
    setFolioManual('')
    ultimoEscaneado.current = null
  }

  const estilo = resultado ? ESTILO_RESULTADO[resultado.estado] : null
  const IconoResultado = estilo?.icono

  return (
    <RutaProtegida moduloRequerido="EmisionTickets" accionRequerida="Editar">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-2xl">
          <div className="mb-6 titulo-seccion">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Validación de Tickets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escanee el código QR del pase o ingrese el número de ticket
            </p>
          </div>

          <div className="space-y-4">
            {/* Escáner */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Escáner de Código QR
                </CardTitle>
                <CardDescription>
                  Requiere permiso de cámara y conexión segura (HTTPS).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <EscanerQR activo={camaraActiva && !validando} onDetectado={handleDetectado} />

                <Button
                  variant={camaraActiva ? 'outline' : 'default'}
                  onClick={() => {
                    ultimoEscaneado.current = null
                    setCamaraActiva((v) => !v)
                  }}
                  disabled={validando}
                  className="w-full gap-2 cursor-pointer"
                >
                  {camaraActiva ? (
                    <>
                      <CameraOff className="h-4 w-4" />
                      Apagar cámara
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Encender cámara y escanear
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Entrada manual: respaldo cuando el QR está dañado o no hay cámara */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-primary" />
                  Ingreso Manual del Folio
                </CardTitle>
                <CardDescription>
                  Úselo si el QR está dañado o la cámara no está disponible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="folio" className="sr-only">
                      Número de ticket
                    </Label>
                    <Input
                      id="folio"
                      placeholder="Ej. TCK-2026-000045"
                      value={folioManual}
                      onChange={(e) => setFolioManual(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleValidarManual()
                        }
                      }}
                      className="bg-muted/50 border-border/50 h-11 font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleValidarManual}
                    disabled={validando || !folioManual.trim()}
                    className="h-11 gap-2 cursor-pointer"
                  >
                    {validando ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    Validar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultado */}
            {validando && (
              <div className="flex items-center justify-center gap-3 py-6">
                <Spinner className="h-6 w-6 text-primary" />
                <span className="text-sm text-muted-foreground">Validando ticket...</span>
              </div>
            )}

            {resultado && !validando && estilo && IconoResultado && (
              <Card className={`border-2 ${estilo.clases}`}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <IconoResultado className={`h-10 w-10 shrink-0 ${estilo.colorIcono}`} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-foreground">{estilo.titulo}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{resultado.mensaje}</p>
                    </div>
                  </div>

                  {resultado.ticket && (
                    <div className="rounded-lg bg-background/60 border border-border/50 p-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">No. Ticket</span>
                        <span className="font-mono font-semibold text-primary">
                          {resultado.ticket.numeroTicket}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Titular</span>
                        <span className="font-medium text-foreground text-right">
                          {resultado.ticket.nombre || resultado.ticket.guia?.nombre || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Personas</span>
                        <span className="font-medium text-foreground">
                          {resultado.ticket.cantidadPersonas} Pax
                        </span>
                      </div>
                      {resultado.ticket.atraccion && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Atracción</span>
                          <span className="font-medium text-foreground text-right">
                            {resultado.ticket.atraccion.nombre}
                          </span>
                        </div>
                      )}
                      {resultado.ticket.fechaUso && (
                        <div className="flex justify-between gap-3 pt-2 border-t border-border/40">
                          <span className="text-muted-foreground">Ya utilizado el</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400 text-right">
                            {formatearFechaHora(resultado.ticket.fechaUso)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      reiniciar()
                      setCamaraActiva(true)
                    }}
                    className="w-full gap-2 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Escanear siguiente ticket
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </RutaProtegida>
  )
}
