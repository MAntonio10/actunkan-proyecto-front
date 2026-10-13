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
  CloudOff,
  Ban,
  CreditCard,
  Camera,
  CameraOff,
  RotateCcw,
} from 'lucide-react'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { BotonRegresar } from '@/componentes/boton_regresar'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { EscanerQR } from '@/componentes/escaner_qr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api, ApiError, esErrorDeRed } from '@/lib/api'
import { validarSinConexion } from '@/lib/validacion_offline'
import { type TicketBackend } from '@/tipos'
import { formatearFechaApi } from '@/lib/fecha_guatemala'

type EstadoResultado =
  | 'autorizado'
  | 'firma_invalida'
  | 'no_existe'
  | 'rechazado'
  | 'pendiente_de_subir'
  | 'ya_utilizado'
  | 'anulado'
  | 'pago_pendiente'
  | 'error'

interface Resultado {
  estado: EstadoResultado
  mensaje: string
  ticket?: TicketBackend
  /** Solo en el reuso: cuándo se usó la vez anterior, en ISO. */
  fechaUso?: string
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
  ya_utilizado: {
    icono: AlertTriangle,
    titulo: 'Este pase ya se utilizó',
    clases: 'border-amber-500/50 bg-amber-500/10',
    colorIcono: 'text-amber-500',
  },
  anulado: {
    icono: Ban,
    titulo: 'Ticket anulado',
    clases: 'border-destructive/50 bg-destructive/10',
    colorIcono: 'text-destructive',
  },
  /* No entra, pero tampoco es un pase falso: se emitió con enlace de pago y la
     pasarela nunca confirmó. Se manda a cobrar, no a la salida. */
  pago_pendiente: {
    icono: CreditCard,
    titulo: 'Pago sin confirmar · cobre antes de dejar pasar',
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
  /*
   * El pase está bien firmado por una taquilla, pero su venta todavía no subió.
   * No es fraude ni un pase vencido: el visitante pagó. Va en azul y con otro
   * ícono a propósito, porque en rojo el portero lo trata como intento de
   * colarse y manda de vuelta a alguien que ya tiene su entrada.
   */
  pendiente_de_subir: {
    icono: CloudOff,
    titulo: 'Venta sin subir · avise en taquilla',
    clases: 'border-sky-500/50 bg-sky-500/10',
    colorIcono: 'text-sky-500',
  },
  error: {
    icono: XCircle,
    titulo: 'Error al validar',
    clases: 'border-destructive/50 bg-destructive/10',
    colorIcono: 'text-destructive',
  },
}

/**
 * Los cuatro rechazos que el backend distingue con un `codigo` propio en el
 * cuerpo del 409.
 *
 * Se mira el código y no el mensaje a propósito: los cuatro comparten el mismo
 * estado HTTP, y reconocerlos por la frase se rompía en silencio con cualquier
 * reescritura del texto — un fallo que aparecería recién en la puerta, con un
 * visitante enfrente.
 *
 * Los 401 (firma inválida, dispositivo desconocido) vienen sin código y con el
 * mismo mensaje genérico, también a propósito: separarlos le diría a quien está
 * probando folios si acertó el dispositivo o solo falló la firma.
 */
const ESTADO_POR_CODIGO: Record<string, EstadoResultado> = {
  PENDIENTE_SINCRONIZACION: 'pendiente_de_subir',
  TICKET_ANULADO: 'anulado',
  TICKET_YA_UTILIZADO: 'ya_utilizado',
  PAGO_PENDIENTE: 'pago_pendiente',
}

function cuerpoDelError(err: unknown): { codigo?: unknown; fechaUso?: unknown } | null {
  if (!(err instanceof ApiError) || !err.cuerpo || typeof err.cuerpo !== 'object') return null
  return err.cuerpo as { codigo?: unknown; fechaUso?: unknown }
}

function estadoDelError(err: unknown): EstadoResultado {
  const codigo = cuerpoDelError(err)?.codigo
  if (typeof codigo === 'string' && ESTADO_POR_CODIGO[codigo]) return ESTADO_POR_CODIGO[codigo]

  // Sin código conocido se cae al estado HTTP. Un 409 con un código que esta
  // versión no conoce —porque el backend agregó uno— sigue mostrándose como
  // rechazo, que es lo correcto: no deja pasar y no inventa una explicación.
  const status = err instanceof ApiError ? err.status : undefined
  if (status === 401) return 'firma_invalida'
  if (status === 404) return 'no_existe'
  if (status === 409) return 'rechazado'
  return 'error'
}

function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return '—'
  return formatearFechaApi(valor)
}

export default function ValidarTicketPage() {
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [validando, setValidando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [folioManual, setFolioManual] = useState('')
  // Evita revalidar en bucle: la cámara emite el mismo QR muchas veces por segundo
  const ultimoEscaneado = useRef<string | null>(null)

  const validar = useCallback(async (numeroTicket: string, firma?: string, dispositivo?: string) => {
    setValidando(true)
    try {
      const res = await api.tickets.validar({ numeroTicket, firma, dispositivo })
      setResultado({
        estado: res.valido ? 'autorizado' : 'rechazado',
        mensaje: res.mensaje,
        ticket: res.ticket,
      })
    } catch (err: unknown) {
      // Sin red se resuelve contra lo vendido por este dispositivo. Un pase
      // emitido offline todavía figura como folio reservado en el servidor, así
      // que preguntarle daría 404 y dejaría afuera a un visitante que ya pagó.
      if (esErrorDeRed(err)) {
        const local = await validarSinConexion(numeroTicket)
        if (local.estado === 'desconocido') {
          setResultado({
            estado: 'error',
            mensaje:
              'Sin conexión y este pase no se vendió desde este dispositivo. No se puede verificar hasta recuperar internet.',
          })
        } else {
          setResultado({
            estado: local.estado === 'autorizado' ? 'autorizado' : 'rechazado',
            mensaje: local.mensaje,
            ticket: local.ticket,
          })
        }
        return
      }

      /*
       * Folio tecleado sin firma. El servidor exige `firma` (`@IsNotEmpty` en
       * `ValidarTicketDto`) porque es lo único que prueba que el pase no está
       * falsificado: aceptar un número suelto dejaría entrar a cualquiera que
       * acierte un folio. Pero el mensaje que devuelve habla de la firma del QR,
       * que el portero no tecleó ni puede teclear —son 88 caracteres—, así que
       * tal cual deja a alguien mirando un error que no sabe cómo resolver.
       *
       * Esto solo traduce el mensaje a algo accionable. El hueco de fondo sigue
       * abierto: con conexión el campo manual no puede validar, y sin conexión sí
       * (ahí responde Dexie, que no necesita firma). Resolverlo pide una decisión
       * —una consulta por folio que informe sin sellar el ingreso, o quitar el
       * campo— y no se toma desde acá.
       */
      if (!firma && err instanceof ApiError && err.status === 400) {
        setResultado({
          estado: 'error',
          mensaje:
            'Con el número solo no se puede autorizar el ingreso: hace falta la firma que va dentro del QR. Escanee el código del pase.',
        })
        return
      }

      const mensaje = err instanceof Error ? err.message : 'No se pudo validar el ticket'
      const fechaUso = cuerpoDelError(err)?.fechaUso
      setResultado({
        estado: estadoDelError(err),
        mensaje,
        fechaUso: typeof fechaUso === 'string' ? fechaUso : undefined,
      })
    } finally {
      setValidando(false)
    }
  }, [])

  const handleDetectado = useCallback(
    (texto: string) => {
      if (validando || texto === ultimoEscaneado.current) return
      ultimoEscaneado.current = texto

      // El QR lleva el JSON { numeroTicket, firma } y, si lo firmó una taquilla
      // con su propia llave, además { dispositivo }. El del servidor sigue
      // viniendo sin ese campo, así que los pases ya impresos no cambian.
      // Si viniera texto plano, se asume que es el folio.
      let numeroTicket = texto
      let firma: string | undefined
      let dispositivo: string | undefined
      try {
        const datos = JSON.parse(texto)
        if (datos?.numeroTicket) {
          numeroTicket = datos.numeroTicket
          firma = datos.firma
          dispositivo = typeof datos.dispositivo === 'string' ? datos.dispositivo : undefined
        }
      } catch {
        // No es JSON: se envía el contenido tal cual como folio
      }

      setCamaraActiva(false)
      validar(numeroTicket, firma, dispositivo)
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

        <main className="flex-1 container mx-auto px-4 py-4 max-w-xl md:max-w-2xl lg:max-w-5xl">
          <div className="titulo-seccion">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Validación de Tickets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escanee el código QR del pase o ingrese el número de ticket
            </p>
          </div>

          {/* Debajo del título y del ancho de su propio texto, también en móvil:
              a todo el ancho parecía la acción principal de la pantalla, y la
              acción principal acá es escanear. */}
          <BotonRegresar className="mt-2 mb-4" />

          <div className="space-y-4">
            {/* En escritorio, el ingreso manual va al lado del escáner: el
                escáner no necesita más de 280 px y el resto de la fila
                quedaba vacío. En móvil se apilan, que es como se usa en la
                entrada. */}
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              {/* Escáner */}
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    Escáner de Código QR
                  </CardTitle>
                  <CardDescription>
                    Requiere permiso de cámara y conexión segura (HTTPS).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* El botón comparte el tope de ancho del escáner para que
                      queden alineados: a todo el ancho de la tarjeta —unos
                      490 px en escritorio— quedaba un botón largo debajo de un
                      cuadro de 280 px. */}
                  <div className="mx-auto w-full max-w-[240px] space-y-3 sm:max-w-[280px] lg:w-[min(280px,32vh)] lg:max-w-none">
                    <EscanerQR activo={camaraActiva && !validando} onDetectado={handleDetectado} />

                    <Button
                      variant={camaraActiva ? 'outline' : 'default'}
                      onClick={() => {
                        ultimoEscaneado.current = null
                        setCamaraActiva((v) => !v)
                      }}
                      disabled={validando}
                      className="h-11 w-full gap-2 cursor-pointer"
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
                  </div>
                </CardContent>
              </Card>

              {/* Entrada manual: respaldo cuando el QR está dañado o no hay cámara */}
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
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
                      {/* Conviven dos formatos de folio: el que numera el servidor
                          y, desde que cada taquilla firma sus propios pases, uno con
                          la serie del equipo en medio. El ejemplo muestra el largo,
                          que es el que sorprende al teclearlo. */}
                      <Input
                        id="folio"
                        placeholder="Ej. TCK-D03-2026-000045"
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
            </div>

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
                      {/* En el reuso, cuándo entró la vez anterior: distingue un
                          doble ingreso de hoy de un pase de otro día. */}
                      {resultado.fechaUso && (
                        <p className="text-sm font-semibold text-foreground mt-1">
                          Ingresó el {formatearFechaHora(resultado.fechaUso)}
                        </p>
                      )}
                    </div>
                  </div>

                  {resultado.ticket && (
                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-8 rounded-lg bg-background border border-border/50 p-3 text-sm">
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
                        <div className="flex justify-between gap-3 border-t border-border/40 pt-2 sm:col-span-2">
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
                    className="h-11 w-full gap-2 cursor-pointer sm:h-10 sm:w-auto"
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
