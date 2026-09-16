'use client'

import { useState } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  Mail,
  AlertTriangle,
  CreditCard,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'

/** Suficiente para atajar el dedazo; el servidor valida de verdad con `@IsEmail`. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface PanelCheckoutTarjetaProps {
  checkoutUrl: string
  /**
   * Ticket al que pertenece el enlace. Hace falta para que el correo lo mande el
   * servidor: el enlace sale del pago guardado, no de esta pantalla.
   */
  idTicket?: number
  numeroTicket?: string
  montoTotal?: string | number
  nombreVisitante?: string
  atraccion?: string
  className?: string
}

export function PanelCheckoutTarjeta({
  checkoutUrl,
  idTicket,
  numeroTicket,
  montoTotal,
  nombreVisitante,
  atraccion,
  className = '',
}: PanelCheckoutTarjetaProps) {
  const [copiado, setCopiado] = useState(false)
  const [modalCorreo, setModalCorreo] = useState(false)
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const montoStr = montoTotal
    ? `Q${parseFloat(String(montoTotal)).toFixed(2)}`
    : ''

  const copiarUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(checkoutUrl)
      setCopiado(true)
      toast.success('Enlace de pago copiado al portapapeles')
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  const mensajeCompartir = [
    `Hola${nombreVisitante ? ` ${nombreVisitante}` : ''}, aquí tienes el enlace seguro para realizar el pago de tus entradas al Parque Regional Municipal Actún Kan`,
    atraccion ? `(${atraccion})` : '',
    numeroTicket ? `Folio: ${numeroTicket}` : '',
    montoStr ? `Total a pagar: ${montoStr}` : '',
    `\nEnlace de pago:\n${checkoutUrl}`,
    '\n*Nota:* Tu ticket se activará automáticamente al confirmarse la transacción en la pasarela.',
  ]
    .filter(Boolean)
    .join('\n')

  const urlWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensajeCompartir)}`

  const correoValido = CORREO_VALIDO.test(correo.trim())

  /**
   * Lo manda el servidor, no el cliente de correo del taquillero.
   *
   * Antes esto era un `mailto:`: abría Outlook con el texto puesto y el envío
   * quedaba en manos de quien atiende, que muchas veces no tiene cuenta
   * configurada en la máquina de taquilla. Ahora sale del parque, con su
   * remitente, y queda constancia en bitácora de a qué dirección se envió.
   */
  const enviarCorreo = async () => {
    if (!idTicket || !correoValido || enviando) return
    setEnviando(true)
    try {
      await api.tickets.enviarEnlacePago(idTicket, correo.trim())
      toast.success('Enlace de pago enviado', {
        description: `Se envió a ${correo.trim()}.`,
      })
      setModalCorreo(false)
      setCorreo('')
    } catch (error: unknown) {
      const mensaje =
        error instanceof Error ? error.message : 'Intente de nuevo en un momento.'
      toast.error('No se pudo enviar el correo', { description: mensaje })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className={`border-2 border-amber-500/50 bg-amber-500/[0.04] shadow-lg overflow-hidden ${className}`}>
      {/* Barra de cabecera */}
      <CardHeader className="bg-amber-500/10 border-b border-amber-500/30 p-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <CardTitle className="text-sm font-bold text-amber-900 dark:text-amber-300">
              Cobro con Tarjeta · Enlace de Pago
            </CardTitle>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">
            Pendiente
          </span>
        </div>
        <CardDescription className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-1">
          Comparte este link con el cliente para que procese su tarjeta de crédito o débito.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5">
        {/* Alerta de no validez hasta pago */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-950 dark:text-amber-100">
              Ticket no válido para ingreso
            </p>
            <p className="leading-relaxed text-[11px]">
              El código QR permanecerá inactivo y será <strong>rechazado en la garita</strong> hasta que la pasarela de pagos confirme la transacción.
            </p>
          </div>
        </div>

        {/* Input del link con botón de copia */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Link de Checkout
          </span>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={checkoutUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="font-mono text-xs h-9 bg-background border-border/80 text-foreground selection:bg-primary/20"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copiarUrl}
              className="h-9 px-3 gap-1.5 font-semibold shrink-0 cursor-pointer border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiado ? 'Copiado' : 'Copiar'}</span>
            </Button>
          </div>
        </div>

        {/* Botones de acción rápida: WhatsApp, Correo, Abrir */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* WhatsApp */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="h-9 text-xs font-semibold gap-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 cursor-pointer"
          >
            <a
              href={urlWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartir por WhatsApp"
            >
              <Send className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </a>
          </Button>

          {/* Correo */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setModalCorreo(true)}
            disabled={!idTicket}
            title={
              idTicket
                ? 'Enviar el enlace de pago por correo'
                : 'No se puede enviar: falta el ticket de referencia'
            }
            className="h-9 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/40 cursor-pointer"
          >
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span>Correo</span>
          </Button>

          {/* Abrir en nueva pestaña */}
          <Button
            type="button"
            variant="default"
            size="sm"
            asChild
            className="h-9 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir pasarela de pago"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir link</span>
            </a>
          </Button>
        </div>
      </CardContent>

      {/* Envío por correo */}
      <Dialog
        open={modalCorreo}
        onOpenChange={(abierto) => {
          if (!enviando) setModalCorreo(abierto)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" />
              Enviar enlace de pago por correo
            </DialogTitle>
            <DialogDescription>
              El parque enviará el enlace desde su propio correo, con un saludo y el
              detalle de la compra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="correo-enlace-pago" className="text-xs">
                Correo del cliente
              </Label>
              <Input
                id="correo-enlace-pago"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="cliente@correo.com"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault()
                    void enviarCorreo()
                  }
                }}
                disabled={enviando}
              />
              {correo.trim() !== '' && !correoValido && (
                <p className="text-[11px] text-destructive">
                  Revise la dirección: falta el @ o el dominio.
                </p>
              )}
            </div>

            {/* Qué va a recibir el cliente, para poder confirmarlo antes de enviar. */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">Se enviará:</p>
              <p className="text-muted-foreground">
                Hola{nombreVisitante ? ` ${nombreVisitante}` : ''}, gracias por su visita.
                Para completar la compra de sus entradas, realice el pago con tarjeta en el
                enlace seguro.
              </p>
              <ul className="text-muted-foreground space-y-0.5 pt-1">
                {numeroTicket && <li>· Folio: {numeroTicket}</li>}
                {atraccion && <li>· Atracción: {atraccion}</li>}
                {montoStr && <li>· Total a pagar: {montoStr}</li>}
                <li>· El enlace de pago y el aviso de que el QR se activa al confirmarse</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCorreo(false)}
              disabled={enviando}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={enviarCorreo}
              disabled={!correoValido || enviando}
              className="gap-2 cursor-pointer"
            >
              {enviando ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Enviar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
