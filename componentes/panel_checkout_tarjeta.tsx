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
import { toast } from 'sonner'

interface PanelCheckoutTarjetaProps {
  checkoutUrl: string
  numeroTicket?: string
  montoTotal?: string | number
  nombreVisitante?: string
  atraccion?: string
  className?: string
}

export function PanelCheckoutTarjeta({
  checkoutUrl,
  numeroTicket,
  montoTotal,
  nombreVisitante,
  atraccion,
  className = '',
}: PanelCheckoutTarjetaProps) {
  const [copiado, setCopiado] = useState(false)

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
  const urlMailto = `mailto:?subject=${encodeURIComponent(
    `Enlace de Pago - Entradas Parque Actún Kan ${numeroTicket ? `(${numeroTicket})` : ''}`
  )}&body=${encodeURIComponent(mensajeCompartir)}`

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
              className="font-mono text-xs h-9 bg-background/80 border-border/80 text-foreground selection:bg-primary/20"
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
            asChild
            className="h-9 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/40 cursor-pointer"
          >
            <a href={urlMailto} title="Enviar por Correo Electrónico">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span>Correo</span>
            </a>
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
    </Card>
  )
}
