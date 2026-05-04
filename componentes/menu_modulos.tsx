"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  UserPlus,
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
    icono: <UserPlus className="h-7 w-7" />,
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
    <Link
      href={modulo.ruta}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
        "hover:border-primary hover:bg-primary/5 hover:scale-[1.02]",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
        esActivo
          ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
          : "border-border/50 bg-card/50 text-muted-foreground hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "transition-colors p-2 rounded-lg",
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
  );
}

export function MenuModulos() {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const contenidoMenu = (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
      {MODULOS.map((modulo) => (
        <ModuloCard
          key={modulo.id}
          modulo={modulo}
          esActivo={pathname.startsWith(modulo.ruta)}
          onClick={() => setAbierto(false)}
        />
      ))}
    </div>
  );

  // Solo se muestra en desktop. En mobile se usa la BarraNavegacionInferior.
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="hidden md:inline-flex border-primary/30 hover:bg-primary/10"
        >
          {abierto ? (
            <X className="h-5 w-5" />
          ) : (
            <LayoutGrid className="h-5 w-5" />
          )}
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
