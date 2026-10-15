'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Terminal POS animada para las páginas de retorno de la pasarela.
 *
 * El resultado NO lo elige nadie en pantalla: llega del estado real del cobro
 * (`resultado`), que confirma el webhook. La animación de lectura se reproduce
 * siempre al entrar y se queda en «Verificando…» hasta que hay desenlace.
 *
 * Sin audio y sin montos, a propósito. Colores del sistema: éxito en
 * `--primary`, fallo en `--destructive`.
 */

export type ResultadoPago = 'pendiente' | 'aprobado' | 'rechazado'

type Fase = 'fuera' | 'reposo' | 'leyendo' | 'verificando' | 'final'

interface Texto {
  titulo: string
  subtitulo: string
}

interface Props {
  resultado: ResultadoPago
  exito?: Texto
  fallo?: Texto
  /** Subtítulo mientras se espera la confirmación. */
  subtituloEspera?: string
  textoBoton?: string
  onTerminar: () => void
  /** Va bajo el título una vez que hay resultado (folio, ayuda). */
  children?: ReactNode
}

/** Dónde está la tarjeta en cada fase, en unidades del viewBox. */
const POSICION_TARJETA: Record<Fase, string> = {
  fuera: 'translate(400px, 195px) rotate(14deg)',
  reposo: 'translate(190px, 195px) rotate(14deg)',
  leyendo: 'translate(105px, 11px) rotate(0deg)',
  verificando: 'translate(105px, 11px) rotate(0deg)',
  final: 'translate(105px, 460px) rotate(0deg)',
}

const ESTILOS = `
.pos-tarjeta { transition: transform .6s cubic-bezier(.2,.8,.2,1), opacity .5s; transform-box: fill-box; transform-origin: center; }
.pos-onda { transform-box: fill-box; transform-origin: center; opacity: 0; animation: pos-onda 1.2s ease-out forwards; }
.pos-giro { transform-box: fill-box; transform-origin: center; animation: pos-giro .9s linear infinite; }
.pos-trazo { stroke-dasharray: 1; stroke-dashoffset: 1; animation: pos-trazo .45s ease-out forwards; }
.pos-temblor { animation: pos-temblor .6s ease-in-out; }
.pos-tinte { transition: opacity .4s; }
@keyframes pos-onda { from { transform: scale(.4); opacity: .7 } to { transform: scale(2.6); opacity: 0 } }
@keyframes pos-giro { to { transform: rotate(360deg) } }
@keyframes pos-trazo { to { stroke-dashoffset: 0 } }
@keyframes pos-temblor {
  0%, 100% { transform: translateX(0) } 15% { transform: translateX(-8px) } 30% { transform: translateX(8px) }
  45% { transform: translateX(-6px) } 60% { transform: translateX(6px) } 75% { transform: translateX(-3px) } 90% { transform: translateX(3px) }
}
@media (prefers-reduced-motion: reduce) {
  .pos-tarjeta, .pos-tinte { transition-duration: .01s; }
  .pos-onda, .pos-trazo { animation-duration: .01s; }
  .pos-giro, .pos-temblor { animation: none; }
}
`

/** Arco de las ondas contactless: radio r alrededor de (cx, cy), de -45° a 45°. */
function arco(cx: number, cy: number, r: number) {
  const d = r * Math.SQRT1_2
  return `M ${cx + d} ${cy - d} A ${r} ${r} 0 0 1 ${cx + d} ${cy + d}`
}

export function TerminalPago({
  resultado,
  exito = { titulo: 'Pago completado exitosamente', subtitulo: 'El cobro fue aprobado.' },
  fallo = { titulo: 'Pago no completado', subtitulo: 'La tarjeta fue rechazada. Prueba con otra tarjeta.' },
  subtituloEspera = 'Estamos esperando la confirmación del banco. Normalmente tarda unos segundos.',
  textoBoton = 'Terminar',
  onTerminar,
  children,
}: Props) {
  const [fase, setFase] = useState<Fase>('fuera')
  const [verificoMinimo, setVerificoMinimo] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)

  // Entra la tarjeta, se posa en el lector y verifica al menos ~1.5 s, aunque el
  // resultado ya se conozca: sin esa pausa la escena saltaría directo al final.
  useEffect(() => {
    const k = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.05 : 1
    const tiempos = [
      setTimeout(() => setFase('reposo'), 30),
      setTimeout(() => setFase('leyendo'), 900 * k),
      setTimeout(() => setFase('verificando'), 1700 * k),
      setTimeout(() => setVerificoMinimo(true), 3200 * k),
    ]
    return () => tiempos.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (verificoMinimo && resultado !== 'pendiente') setFase('final')
  }, [verificoMinimo, resultado])

  useEffect(() => {
    if (fase === 'final') boton.current?.focus()
  }, [fase])

  const ok = fase === 'final' && resultado === 'aprobado'
  const error = fase === 'final' && resultado === 'rechazado'
  const colorEstado = ok ? 'var(--primary)' : error ? 'var(--destructive)' : null

  const titulo = ok
    ? exito.titulo
    : error
      ? fallo.titulo
      : fase === 'verificando'
        ? 'Verificando tu pago'
        : 'Leyendo tarjeta…'
  const subtitulo = ok ? exito.subtitulo : error ? fallo.subtitulo : fase === 'verificando' ? subtituloEspera : ''

  return (
    <div className="flex h-full w-full flex-col items-center gap-3 sm:gap-4">
      <style>{ESTILOS}</style>

      {/* La escena toma solo el alto que sobra: así la página entera cabe en la
          pantalla sin scroll, en cualquier teléfono. */}
      <div className="relative w-full min-h-0 flex-1">
      <svg
        viewBox="0 0 360 390"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={ok ? 'Terminal: pago aprobado' : error ? 'Terminal: pago rechazado' : 'Terminal: verificando el pago'}
      >
        <defs>
          <linearGradient id="pos-cuerpo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a5056" />
            <stop offset="1" stopColor="#202427" />
          </linearGradient>
          <linearGradient id="pos-oro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7d276" />
            <stop offset=".55" stopColor="#e6a52a" />
            <stop offset="1" stopColor="#b9790c" />
          </linearGradient>
          <filter id="pos-sombra" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity=".28" />
          </filter>
          <clipPath id="pos-tarjeta-borde">
            <rect width="150" height="94" rx="10" />
          </clipPath>
          <clipPath id="pos-pantalla">
            <rect x="96" y="82" width="168" height="120" rx="10" />
          </clipPath>
        </defs>

        {/* Terminal */}
        <g className={cn(error && 'pos-temblor')}>
          <rect
            x="75"
            y="30"
            width="210"
            height="330"
            rx="24"
            fill="url(#pos-cuerpo)"
            stroke={colorEstado ?? 'rgba(255,255,255,.14)'}
            strokeWidth={colorEstado ? 3 : 1.5}
            filter="url(#pos-sombra)"
          />

          {/* Lector contactless */}
          <g stroke="rgba(255,255,255,.55)" strokeWidth="3.5" strokeLinecap="round" fill="none">
            {[8, 15, 22].map((r) => (
              <path key={r} d={arco(170, 58, r)} />
            ))}
          </g>

          {/* Pantalla */}
          <rect x="96" y="82" width="168" height="120" rx="10" fill="#0d1214" stroke="rgba(255,255,255,.08)" />
          <g clipPath="url(#pos-pantalla)">
            <rect
              className="pos-tinte"
              x="96"
              y="82"
              width="168"
              height="120"
              fill={colorEstado ?? 'transparent'}
              opacity={colorEstado ? 0.22 : 0}
            />

            {(fase === 'fuera' || fase === 'reposo' || fase === 'leyendo') && (
              <g stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none">
                {[10, 21, 32, 43].map((r, i) => (
                  <path key={r} d={arco(160, 142, r)} opacity={1 - i * 0.25} />
                ))}
              </g>
            )}

            {fase === 'verificando' && (
              <g>
                <circle cx="180" cy="130" r="18" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
                <circle
                  className="pos-giro"
                  cx="180"
                  cy="130"
                  r="18"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="30 84"
                />
                <text x="180" y="180" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600">
                  Verificando…
                </text>
              </g>
            )}

            {(ok || error) && (
              <g stroke={colorEstado!} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <circle className="pos-trazo" cx="180" cy="128" r="26" pathLength={1} />
                {ok ? (
                  <path className="pos-trazo" d="M 168 129 L 177 138 L 194 120" pathLength={1} style={{ animationDelay: '.35s' }} />
                ) : (
                  <>
                    <path className="pos-trazo" d="M 170 118 L 190 138" pathLength={1} style={{ animationDelay: '.35s' }} />
                    <path className="pos-trazo" d="M 190 118 L 170 138" pathLength={1} style={{ animationDelay: '.5s' }} />
                  </>
                )}
                <text
                  x="180"
                  y="182"
                  textAnchor="middle"
                  fill={colorEstado!}
                  stroke="none"
                  fontSize="16"
                  fontWeight="700"
                >
                  {ok ? 'Aprobado' : 'Rechazado'}
                </text>
              </g>
            )}
          </g>

          {/* Teclado 3x4: abajo a la izquierda cancelar (rojo), a la derecha aceptar (verde) */}
          {Array.from({ length: 12 }, (_, i) => {
            const fila = Math.floor(i / 3)
            const col = i % 3
            const color = i === 9 ? '#6e2626' : i === 11 ? '#1f5236' : '#30363a'
            return (
              <rect
                key={i}
                x={92 + col * 62}
                y={216 + fila * 34}
                width="52"
                height="26"
                rx="7"
                fill={color}
                stroke="rgba(255,255,255,.07)"
              />
            )
          })}
        </g>

        {/* Ondas al tocar el lector */}
        {fase === 'leyendo' &&
          [0, 0.25, 0.5].map((retraso) => (
            <circle
              key={retraso}
              className="pos-onda"
              cx="180"
              cy="58"
              r="40"
              fill="none"
              stroke="#e6a52a"
              strokeWidth="2.5"
              style={{ animationDelay: `${retraso}s` }}
            />
          ))}

        {/* Tarjeta */}
        {/* Se desvanece fuera de escena: el SVG se estira más que su viewBox y en
            ese margen sobrante la tarjeta se vería entrando o saliendo. */}
        <g
          className="pos-tarjeta"
          style={{ transform: POSICION_TARJETA[fase], opacity: fase === 'fuera' || fase === 'final' ? 0 : 1 }}
          filter="url(#pos-sombra)"
        >
          <rect width="150" height="94" rx="10" fill="url(#pos-oro)" />
          <g clipPath="url(#pos-tarjeta-borde)">
            <circle cx="128" cy="14" r="34" fill="#fff" opacity=".14" />
            <circle cx="150" cy="70" r="40" fill="#fff" opacity=".1" />
          </g>
          <rect x="16" y="30" width="26" height="20" rx="4" fill="#f3e2a4" stroke="#a87a1c" strokeWidth="1" />
          <path d="M 16 40 H 42 M 29 30 V 50" stroke="#a87a1c" strokeWidth="1" />
          <g stroke="#5c3d05" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".75">
            {[4, 8, 12].map((r) => (
              <path key={r} d={arco(52, 40, r)} />
            ))}
          </g>
          <text x="16" y="76" fill="#4a3104" fontSize="11.5" fontWeight="600" letterSpacing="1">
            •••• •••• •••• 4821
          </text>
        </g>
      </svg>
      </div>

      <div aria-live="polite" className="min-h-[3rem] shrink-0 text-center">
        <h2
          className={cn(
            'text-lg sm:text-xl font-bold tracking-tight',
            ok ? 'text-primary' : error ? 'text-destructive' : 'text-foreground',
          )}
        >
          {titulo}
        </h2>
        {subtitulo && <p className="mx-auto mt-1 max-w-xs text-xs sm:text-sm text-muted-foreground">{subtitulo}</p>}
      </div>

      {fase === 'final' && children}

      {fase === 'final' ? (
        <Button
          ref={boton}
          onClick={onTerminar}
          className={cn(
            'h-[60px] w-full shrink-0 cursor-pointer text-base font-semibold text-foreground shadow-sm',
            ok
              ? 'border border-primary/40 bg-[color-mix(in_oklch,var(--primary)_22%,var(--card))] hover:bg-[color-mix(in_oklch,var(--primary)_30%,var(--card))]'
              : 'border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_18%,var(--card))] hover:bg-[color-mix(in_oklch,var(--destructive)_26%,var(--card))]',
          )}
        >
          {textoBoton}
        </Button>
      ) : (
        // Reserva el alto del botón para que la página no salte al aparecer.
        <div aria-hidden className="h-[60px] shrink-0" />
      )}
    </div>
  )
}
