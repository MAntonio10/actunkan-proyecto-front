import Image from 'next/image'
import { cn } from '@/lib/utils'

type Tamano = 'sm' | 'md' | 'lg'

const ALTURA: Record<Tamano, string> = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16',
}

const SEPARACION: Record<Tamano, string> = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
}

interface Props {
  tamano?: Tamano
  /** Prioriza la carga; úselo solo en el logo visible al entrar (login). */
  prioridad?: boolean
  className?: string
}

/**
 * Los dos logos institucionales como una sola unidad: ProPetén (organización
 * que administra) y Actún Kan (el parque). Van siempre juntos, por eso viven en
 * un componente compartido en vez de repetirse suelto en cada pantalla.
 */
export function LogosInstitucionales({ tamano = 'md', prioridad = false, className }: Props) {
  const altura = ALTURA[tamano]

  return (
    <div className={cn('flex items-center justify-center', SEPARACION[tamano], className)}>
      <Image
        src="/Propeten.png"
        alt="ProPetén"
        width={120}
        height={120}
        priority={prioridad}
        className={cn(altura, 'w-auto object-contain')}
      />
      <span aria-hidden className={cn('w-px shrink-0 bg-border/70', altura)} />
      <Image
        src="/actun.png"
        alt="Parque Regional Municipal Actún Kan"
        width={120}
        height={120}
        priority={prioridad}
        className={cn(altura, 'w-auto object-contain')}
      />
    </div>
  )
}
