'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuModulos } from './menu_modulos'
import { IndicadorConectividad } from './indicador_conectividad'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { LogoActunKan } from './logo_actun_kan'

export function BarraNavegacionSuperior() {
  const router = useRouter()
  const { usuario, cerrarSesion } = useAutenticacion()

  const handleCerrarSesion = () => {
    cerrarSesion()
    router.push('/login')
  }

  const iniciales = usuario?.nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Izquierda: Menu hamburguesa (mobile) o Menu de modulos (desktop) + Logo */}
        <div className="flex items-center gap-3">
          <MenuModulos />

          {/* Logo y nombre */}
          <div className="flex items-center gap-2">
            <LogoActunKan className="h-8 w-8 text-primary" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-foreground tracking-tight hidden sm:inline">
                PARQUE NACIONAL
              </span>
              <span className="font-bold text-primary tracking-tight">
                ACTUN KAN
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: Indicador conectividad + Usuario */}
        <div className="flex items-center gap-3">
          <IndicadorConectividad />

          {/* Menu de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium">{usuario?.nombre}</span>
                  <span className="text-xs text-primary">
                    Taquilla {usuario?.taquilla}
                  </span>
                </div>
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarImage src={usuario?.avatar} alt={usuario?.nombre} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {iniciales}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{usuario?.nombre}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {usuario?.rol === 'taquillero' ? 'Taquillero' : usuario?.rol}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleCerrarSesion}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Boton de salir rapido */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCerrarSesion}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Cerrar sesion</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
