'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  /** Se llama con el texto decodificado del QR. */
  onDetectado: (texto: string) => void
  /** Mientras sea false la cámara permanece apagada. */
  activo: boolean
}

type EstadoCamara = 'iniciando' | 'activa' | 'sin_permiso' | 'sin_camara' | 'contexto_inseguro'

export function EscanerQR({ onDetectado, activo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  // El callback se guarda en ref para que cambiarlo no reinicie la cámara.
  const onDetectadoRef = useRef(onDetectado)
  const [estado, setEstado] = useState<EstadoCamara>('iniciando')

  useEffect(() => {
    onDetectadoRef.current = onDetectado
  }, [onDetectado])

  useEffect(() => {
    if (!activo) return

    // getUserMedia solo existe en contexto seguro (HTTPS o localhost). Sin esto
    // la taquilla vería un fallo genérico en vez de saber que falta HTTPS.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setEstado('contexto_inseguro')
      return
    }

    let cancelado = false
    const lector = new BrowserQRCodeReader()

    lector
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (resultado) => {
          if (resultado) onDetectadoRef.current(resultado.getText())
        },
      )
      .then((controls) => {
        if (cancelado) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setEstado('activa')
      })
      .catch((err: unknown) => {
        if (cancelado) return
        const nombre = err instanceof Error ? err.name : ''
        if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
          setEstado('sin_permiso')
        } else {
          setEstado('sin_camara')
        }
      })

    return () => {
      cancelado = true
      // Liberar el stream: si no, la cámara del dispositivo queda encendida.
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [activo])

  if (!activo) {
    return (
      <div className="aspect-square w-full rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <CameraOff className="h-10 w-10 opacity-40" />
        <p className="text-sm">Cámara apagada</p>
      </div>
    )
  }

  if (estado === 'contexto_inseguro' || estado === 'sin_permiso' || estado === 'sin_camara') {
    const mensajes: Record<string, { titulo: string; detalle: string }> = {
      contexto_inseguro: {
        titulo: 'Cámara no disponible (conexión no segura)',
        detalle:
          'El navegador solo permite usar la cámara en HTTPS o localhost. Use la entrada manual de folio.',
      },
      sin_permiso: {
        titulo: 'Permiso de cámara denegado',
        detalle:
          'Autorice el acceso a la cámara en el navegador, o use la entrada manual de folio.',
      },
      sin_camara: {
        titulo: 'No se encontró una cámara',
        detalle: 'Este dispositivo no tiene cámara disponible. Use la entrada manual de folio.',
      },
    }
    const { titulo, detalle } = mensajes[estado]

    return (
      <div className="aspect-square w-full rounded-xl border-2 border-amber-500/40 bg-amber-500/10 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{titulo}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{detalle}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-primary/40 bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

      {estado === 'iniciando' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
          <Spinner className="h-7 w-7" />
          <p className="text-sm">Iniciando cámara...</p>
        </div>
      )}

      {/* Marco guía para encuadrar el QR */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-2/3 w-2/3 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
        <Camera className="h-3.5 w-3.5" />
        Enfoque el código QR del pase
      </div>
    </div>
  )
}
