"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MenuModulos } from "./menu_modulos";
import { IndicadorConectividad } from "./indicador_conectividad";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import Image from "next/image";
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
              whileHover={{ rotate: -8, scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="relative"
            >
              {/* Resplandor sutil detras del medallon */}
              <span
                aria-hidden
                className="absolute inset-0 -m-1 rounded-full blur-lg"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklch, var(--primary) 30%, transparent), transparent 70%)",
                }}
              />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-card p-1.5 ring-2 ring-primary/30 shadow-md shadow-primary/15">
                <Image
                  src="/actun.png"
                  alt="Actun Kan"
                  width={56}
                  height={56}
                  className="h-12 w-12 object-contain"
                  priority
                />
              </span>
            </motion.div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline">
                Parque Nacional ACTUN KAN
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
                    {usuario?.rol === "taquillero"
                      ? "Taquillero"
                      : usuario?.rol}
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
        </motion.div>
      </div>
    </motion.header>
  );
}
