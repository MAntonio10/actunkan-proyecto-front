'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { Spinner } from '@/components/ui/spinner'
import { ShieldAlert, LogOut, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RutaProtegidaProps {
  children: React.ReactNode
  moduloRequerido?: string
  accionRequerida?: string
}

export function RutaProtegida({
  children,
  moduloRequerido,
  accionRequerida,
}: RutaProtegidaProps) {
  const { estaAutenticado, cargando, tienePermiso, tieneAccesoModulo, tieneAlgunPermiso, cerrarSesion, usuario } = useAutenticacion()
  const router = useRouter()

  useEffect(() => {
    if (!cargando && !estaAutenticado) {
      router.replace('/login')
    }
  }, [cargando, estaAutenticado, router])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 p-6">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verificando sesión y permisos...</p>
        </div>
      </div>
    )
  }

  if (!estaAutenticado) {
    return null
  }

  // 1. Si el usuario no tiene NINGÚN permiso asignado en todo el sistema
  if (!tieneAlgunPermiso()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Fondo decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 60% 50% at 15% 10%, color-mix(in oklch, var(--destructive) 15%, transparent), transparent 65%),
              radial-gradient(ellipse 55% 50% at 90% 95%, color-mix(in oklch, var(--primary) 15%, transparent), transparent 65%)
            `,
          }}
        />
        <div className="max-w-md w-full bg-card/90 backdrop-blur-md p-8 rounded-xl border border-destructive/30 shadow-xl text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto ring-8 ring-destructive/5">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Sin Módulos Asignados</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estimado/a <span className="font-semibold text-foreground">{usuario?.nombre || 'usuario'}</span>, su cuenta se encuentra activa pero no tiene asignado ningún módulo ni permiso en el sistema.
            </p>
            <div className="p-3 bg-muted/60 rounded-lg text-xs text-muted-foreground border border-border/50 mt-3 text-left">
              <span className="font-medium text-foreground">¿Qué debe hacer?</span>
              <br />
              Por favor contacte al administrador del parque para que le asigne los módulos y permisos requeridos para su puesto de trabajo.
            </div>
          </div>
          <Button onClick={cerrarSesion} variant="destructive" className="w-full h-11 font-medium gap-2 cursor-pointer">
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    )
  }

  // Encontrar la primera ruta permitida para el usuario
  const obtenerRutaPermitida = () => {
    if (tieneAccesoModulo('Registro Visitantes') || tieneAccesoModulo('Visitantes') || tieneAccesoModulo('Taquilla')) return '/registro-visitantes'
    if (tieneAccesoModulo('Usuarios') || tieneAccesoModulo('Puestos') || tieneAccesoModulo('Modulos')) return '/usuarios'
    if (tieneAccesoModulo('Donaciones')) return '/donaciones'
    if (tieneAccesoModulo('Cierre Diario')) return '/cierre-diario'
    if (tieneAccesoModulo('Reportes')) return '/reportes'
    if (tieneAccesoModulo('Actividades')) return '/actividades'
    if (tieneAccesoModulo('Auditoria') || tieneAccesoModulo('Auditoría') || tieneAccesoModulo('Bitacora') || tieneAccesoModulo('Bitácora')) return '/bitacora'
    if (tieneAccesoModulo('Sincronizacion')) return '/sincronizacion'
    return '/login'
  }

  // 2. Verificación de permiso específico si fue solicitado
  if (moduloRequerido && accionRequerida) {
    if (!tienePermiso(moduloRequerido, accionRequerida)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card p-8 rounded-xl border border-border/80 shadow-lg text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Acceso Denegado</h2>
              <p className="text-sm text-muted-foreground">
                No cuenta con permisos suficientes (
                <span className="font-semibold text-foreground">
                  {moduloRequerido} - {accionRequerida}
                </span>
                ) para ver este contenido.
              </p>
            </div>
            <Button onClick={() => router.push(obtenerRutaPermitida())} variant="outline" className="w-full">
              Ir a Módulo Disponible
            </Button>
          </div>
        </div>
      )
    }
  } else if (moduloRequerido) {
    if (!tieneAccesoModulo(moduloRequerido)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card p-8 rounded-xl border border-border/80 shadow-lg text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Acceso Denegado</h2>
              <p className="text-sm text-muted-foreground">
                No cuenta con permisos para acceder al módulo <span className="font-semibold text-foreground">{moduloRequerido}</span>.
              </p>
            </div>
            <Button onClick={() => router.push(obtenerRutaPermitida())} variant="outline" className="w-full">
              Ir a Módulo Disponible
            </Button>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
