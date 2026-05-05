"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  ScanLine,
  Calculator,
  CloudCog,
  ClipboardList,
  Users,
  X,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ModuloMenu {
  id: string;
  nombre: string;
  descripcion: string;
  icono: React.ReactNode;
  ruta: string;
}

const MODULOS: ModuloMenu[] = [
  {
    id: "registro-visitantes",
    nombre: "Registro Visitantes",
    descripcion: "Registrar y emitir ticket",
    icono: <ScanLine className="h-7 w-7" />,
    ruta: "/registro-visitantes",
  },
  // {
  //   id: 'control-acceso',
  //   nombre: 'Control Acceso',
  //   descripcion: 'Entradas y salidas',
  //   icono: <ScanLine className="h-7 w-7" />,
  //   ruta: '/control-acceso',
  // },
  {
    id: "cierre-diario",
    nombre: "Cierre Diario",
    descripcion: "Resumen financiero",
    icono: <Calculator className="h-7 w-7" />,
    ruta: "/cierre-diario",
  },
  {
    id: "reportes",
    nombre: "Reportes",
    descripcion: "Estadisticas y graficos",
    icono: <BarChart3 className="h-7 w-7" />,
    ruta: "/reportes",
  },
  {
    id: "sincronizacion",
    nombre: "Sincronizacion",
    descripcion: "Estado offline",
    icono: <CloudCog className="h-7 w-7" />,
    ruta: "/sincronizacion",
  },
  {
    id: "actividades",
    nombre: "Actividades",
    descripcion: "Registro de actividades",
    icono: <ClipboardList className="h-7 w-7" />,
    ruta: "/actividades",
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    descripcion: "Staff y permisos",
    icono: <Users className="h-7 w-7" />,
    ruta: "/usuarios",
  },
];

const VARIANTES_ITEM = {
  oculto: { opacity: 0, y: 12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

function ModuloCard({
  modulo,
  esActivo,
  onClick,
}: {
  modulo: ModuloMenu;
  esActivo: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.div
      variants={VARIANTES_ITEM}
      whileHover={{ y: -3, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      <Link
        href={modulo.ruta}
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2",
          "hover:border-primary hover:bg-primary/5",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          esActivo
            ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
            : "border-border/50 bg-card/50 text-muted-foreground hover:text-foreground",
        )}
      >
        <div
          className={cn(
            "p-2 rounded-lg",
            esActivo ? "text-primary bg-primary/10" : "text-muted-foreground",
          )}
        >
          {modulo.icono}
        </div>
        <div className="text-center">
          <span className="text-sm font-medium block">{modulo.nombre}</span>
          <span className="text-xs text-muted-foreground hidden sm:block">
            {modulo.descripcion}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function MenuModulos() {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const contenidoMenu = (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-2"
      initial="oculto"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.04, delayChildren: 0.05 },
        },
        oculto: {},
      }}
    >
      {MODULOS.map((modulo) => (
        <ModuloCard
          key={modulo.id}
          modulo={modulo}
          esActivo={pathname.startsWith(modulo.ruta)}
          onClick={() => setAbierto(false)}
        />
      ))}
    </motion.div>
  );

  // Solo se muestra en desktop. En mobile se usa la BarraNavegacionInferior.
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="hidden md:inline-flex border-primary/30 hover:bg-primary/10 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            {abierto ? (
              <motion.span
                key="cerrar"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                <X className="h-5 w-5" />
              </motion.span>
            ) : (
              <motion.span
                key="abrir"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                <LayoutGrid className="h-5 w-5" />
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sr-only">Modulos del sistema</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-md border-border">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider text-muted-foreground">
            Modulos del Sistema
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              Seleccione un modulo para navegar a esa seccion del sistema
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        {contenidoMenu}
      </DialogContent>
    </Dialog>
  );
}
