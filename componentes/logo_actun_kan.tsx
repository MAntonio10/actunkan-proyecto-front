import { cn } from '@/lib/utils'

interface LogoActunKanProps {
  className?: string
}

export function LogoActunKan({ className }: LogoActunKanProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary', className)}
    >
      {/* Hoja estilizada - simbolo del parque ecologico */}
      <path
        d="M20 4C12 4 6 12 6 20C6 28 12 36 20 36C20 36 20 28 20 20C20 12 20 4 20 4Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M20 4C28 4 34 12 34 20C34 28 28 36 20 36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 4C20 4 20 12 20 20C20 28 20 36 20 36"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Venas de la hoja */}
      <path
        d="M20 12C24 14 28 18 28 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 20C24 22 28 26 28 28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
