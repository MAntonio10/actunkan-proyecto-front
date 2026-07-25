"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  BarChart3,
  ScanLine,
  Calculator,
  CloudCog,
  ClipboardList,
  Users,
  X,
  LayoutGrid,
  HandHeart,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
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
  {
    id: "donaciones",
    nombre: "Donaciones",
    descripcion: "Gestión de donativos y recibos",
    icono: <HandHeart className="h-7 w-7" />,
    ruta: "/donaciones",
  },
  {
    id: "bitacora",
    nombre: "Bitácora",
    descripcion: "Bitácora y registro de actividades",
    icono: <History className="h-7 w-7" />,
    ruta: "/bitacora",
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
    nombre: "Sincronización",
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
      className="h-full"
    >
      <Link
        href={modulo.ruta}
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-between gap-2 px-2.5 py-3.5 sm:px-3.5 sm:py-4 rounded-xl border-2 h-full min-h-[165px] w-full transition-all",
          "hover:border-primary hover:bg-primary/5",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          esActivo
            ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
            : "border-border/50 bg-card/50 text-muted-foreground hover:text-foreground",
        )}
      >
        <div
          className={cn(
            "p-2.5 sm:p-3 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            esActivo ? "text-primary bg-primary/15" : "text-muted-foreground bg-muted/40",
          )}
        >
          {modulo.icono}
        </div>
        <div className="text-center w-full flex flex-col items-center justify-center flex-1 gap-1 min-w-0">
          <span className="text-[13px] sm:text-sm font-semibold leading-snug tracking-tight px-1 min-h-[2.5rem] flex items-center justify-center text-center break-words max-w-full">
            {modulo.nombre}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:flex items-center justify-center text-center min-h-[2.25rem] leading-snug px-1 max-w-full">
            {modulo.descripcion}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function MenuModulos() {
  const [abierto, setAbierto] = useState(false);
  const [modulosAnulados, setModulosAnulados] = useState<string[]>([]);
  const pathname = usePathname();
  const { tieneAccesoModulo, tienePermiso } = useAutenticacion();

  useEffect(() => {
    if (abierto) {
      api.modulos
        .getModulos(true)
        .then((res) => {
          if (Array.isArray(res)) {
            const anulados = res.filter((m) => m.anulado).map((m) => m.nombre.toLowerCase().trim());
            setModulosAnulados(anulados);
          }
        })
        .catch(() => {});
    }
  }, [abierto]);

  const esModuloAnuladoBD = (nombres: string[]) => {
    return nombres.some((n) => modulosAnulados.includes(n.toLowerCase().trim()));
  };

  const modulosPermitidos = MODULOS.filter((modulo) => {
    if (modulo.id === "usuarios") {
      if (esModuloAnuladoBD(["Usuarios"])) return false;
      return (
        tieneAccesoModulo("Usuarios") ||
        tienePermiso("Usuarios", "Ver") ||
        tieneAccesoModulo("Puestos") ||
        tieneAccesoModulo("Modulos")
      );
    }
    if (modulo.id === "registro-visitantes") {
      if (esModuloAnuladoBD(["Registro Visitantes", "Visitantes", "RegistroVisitantes", "Taquilla"])) return false;
      return (
        tieneAccesoModulo("Registro Visitantes") ||
        tieneAccesoModulo("Visitantes") ||
        tieneAccesoModulo("RegistroVisitantes") ||
        tieneAccesoModulo("Taquilla") ||
        tienePermiso("Registro Visitantes", "Ver") ||
        tienePermiso("Visitantes", "Ver")
      );
    }
    if (modulo.id === "donaciones") {
      if (esModuloAnuladoBD(["Donaciones"])) return false;
      return tieneAccesoModulo("Donaciones") || tienePermiso("Donaciones", "Ver");
    }
    if (modulo.id === "bitacora" || modulo.id === "auditoria") {
      if (esModuloAnuladoBD(["Auditoria", "Auditoría", "Bitacora", "Bitácora"])) return false;
      return (
        tieneAccesoModulo("Auditoria") ||
        tieneAccesoModulo("Auditoría") ||
        tieneAccesoModulo("Bitacora") ||
        tieneAccesoModulo("Bitácora") ||
        tienePermiso("Auditoria", "Ver") ||
        tienePermiso("Bitacora", "Ver")
      );
    }
    if (modulo.id === "cierre-diario") {
      if (esModuloAnuladoBD(["Cierre Diario", "CierreDiario"])) return false;
      return (
        tieneAccesoModulo("Cierre Diario") ||
        tieneAccesoModulo("CierreDiario") ||
        tienePermiso("Cierre Diario", "Ver")
      );
    }
    if (modulo.id === "reportes") {
      if (esModuloAnuladoBD(["Reportes"])) return false;
      return tieneAccesoModulo("Reportes") || tienePermiso("Reportes", "Ver");
    }
    if (modulo.id === "sincronizacion") {
      if (esModuloAnuladoBD(["Sincronizacion", "Sincronización"])) return false;
      return (
        tieneAccesoModulo("Sincronizacion") ||
        tieneAccesoModulo("Sincronización") ||
        tienePermiso("Sincronizacion", "Ver")
      );
    }
    if (modulo.id === "actividades") {
      if (esModuloAnuladoBD(["Actividades"])) return false;
      return tieneAccesoModulo("Actividades") || tienePermiso("Actividades", "Ver");
    }

    if (esModuloAnuladoBD([modulo.nombre])) return false;
    return tieneAccesoModulo(modulo.nombre) || tienePermiso(modulo.nombre, "Ver");
  });

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
      {modulosPermitidos.length === 0 ? (
        <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
          No cuenta con acceso a ningún módulo. Contacte a su administrador.
        </div>
      ) : (
        modulosPermitidos.map((modulo) => (
          <ModuloCard
            key={modulo.id}
            modulo={modulo}
            esActivo={pathname.startsWith(modulo.ruta)}
            onClick={() => setAbierto(false)}
          />
        ))
      )}
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
