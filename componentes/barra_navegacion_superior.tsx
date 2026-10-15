"use client";

import { useRouter } from "next/navigation";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MenuModulos } from "./menu_modulos";
import { IndicadorConectividad } from "./indicador_conectividad";
import { IndicadorSincronizacion } from "./indicador_sincronizacion";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { LogosInstitucionales } from "./logos_institucionales";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BarraNavegacionSuperior() {
  const router = useRouter();
  const { usuario, cerrarSesion } = useAutenticacion();

  const handleCerrarSesion = () => {
    cerrarSesion();
    router.push("/login");
  };

  const iniciales =
    usuario?.nombre
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 w-full bg-card">
      {/* Capa de fondo con gradiente sutil */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-card"
        style={{
          backgroundImage:
            "linear-gradient(180deg, color-mix(in oklch, var(--primary) 6%, var(--card)) 0%, var(--card) 100%)",
        }}
      />
      {/* Linea de acento inferior */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--primary) 55%, transparent) 25%, color-mix(in oklch, var(--accent) 55%, transparent) 75%, transparent 100%)",
        }}
      />
      <div className="flex h-[72px] items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        {/* Izquierda: Menu hamburguesa (mobile) o Menu de modulos (desktop) + Logo */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MenuModulos />

          {/* Logo y nombre */}
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="relative shrink-0"
            >
              {/* Resplandor sutil detras del medallon */}
              <span
                aria-hidden
                className="absolute inset-0 -m-1 rounded-2xl blur-lg"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklch, var(--primary) 30%, transparent), transparent 70%)",
                }}
              />
              <span className="relative flex items-center justify-center rounded-2xl bg-card px-2 py-1.5 sm:px-3 ring-2 ring-primary/30 shadow-md shadow-primary/15">
                <LogosInstitucionales tamano="sm" prioridad />
              </span>
            </motion.div>
            <div className="flex items-center gap-1.5 leading-none">
              {/* Crece solo desde lg, y la interletra se cierra a medida que
                  crece: 0.2em sostiene unas versalitas de 10 px, pero a 15 px
                  separa tanto las letras que el nombre deja de leerse como una
                  unidad.
                  
                  Deliberadamente NO crece en md: a 768 px el nombre ya mide
                  unos 290 px y la barra tiene que repartir el ancho con el
                  medallón, el menú de módulos y los tres indicadores de la
                  derecha. Agrandarlo ahí lo empujaría todo. */}
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:inline lg:whitespace-nowrap lg:text-sm lg:tracking-[0.1em] xl:text-[15px]">
                Parque Regional Municipal ACTÚN KAN
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: Indicador conectividad + Usuario */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <IndicadorSincronizacion />
          <IndicadorConectividad />

          {/* Info del usuario. En móvil el avatar abre el menú con sesiones y
              salir: no caben como botones sueltos junto a los indicadores. */}
          <div className="flex items-center gap-2 sm:px-2">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{usuario?.nombre || 'Usuario'}</span>
              <span className="text-xs text-primary font-medium">
                {usuario?.puesto?.nombre || 'Personal'}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Menú de usuario"
              >
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {iniciales}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-medium">{usuario?.nombre || 'Usuario'}</span>
                  <span className="text-xs font-medium text-primary">
                    {usuario?.puesto?.nombre || 'Personal'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/sesiones")} className="cursor-pointer">
                  <MonitorSmartphone className="mr-2 h-4 w-4" />
                  Mis sesiones activas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleCerrarSesion}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Sesiones activas */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/sesiones")}
                className="hidden sm:inline-flex text-muted-foreground hover:text-primary"
              >
                <MonitorSmartphone className="h-5 w-5" />
                <span className="sr-only">Mis sesiones activas</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mis sesiones activas</TooltipContent>
          </Tooltip>

          {/* Boton de salir rapido */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCerrarSesion}
                className="hidden sm:inline-flex text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Cerrar sesion</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cerrar sesión</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
