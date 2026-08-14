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
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { LogosInstitucionales } from "./logos_institucionales";
import { motion } from "framer-motion";

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
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="sticky top-0 z-50 w-full backdrop-blur-md"
    >
      {/* Capa de fondo con gradiente sutil */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-card/85"
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
      <div className="flex h-[72px] items-center justify-between px-4 md:px-6">
        {/* Izquierda: Menu hamburguesa (mobile) o Menu de modulos (desktop) + Logo */}
        <div className="flex items-center gap-3">
          <MenuModulos />

          {/* Logo y nombre */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="relative"
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
              <span className="relative flex items-center justify-center rounded-2xl bg-card px-3 py-1.5 ring-2 ring-primary/30 shadow-md shadow-primary/15">
                <LogosInstitucionales tamano="sm" prioridad />
              </span>
            </motion.div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline">
                Parque Regional Municipal ACTÚN KAN
              </span>
            </div>
          </motion.div>
        </div>

        {/* Derecha: Indicador conectividad + Usuario */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <IndicadorConectividad />

          {/* Info del usuario */}
          <div className="flex items-center gap-2 px-2">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{usuario?.nombre || 'Usuario'}</span>
              <span className="text-xs text-primary font-medium">
                {usuario?.puesto?.nombre || 'Personal'}
              </span>
            </div>
            <Avatar className="h-9 w-9 border-2 border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {iniciales}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Sesiones activas */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/sesiones")}
                className="text-muted-foreground hover:text-primary"
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
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Cerrar sesion</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cerrar sesión</TooltipContent>
          </Tooltip>
        </motion.div>
      </div>
    </motion.header>
  );
}
