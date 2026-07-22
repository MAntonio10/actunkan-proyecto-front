"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Home,
  ClipboardList,
  BarChart3,
  ChevronUp,
  Calculator,
  CloudCog,
  Users,
  Heart,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemNav {
  id: string;
  nombre: string;
  icono: React.ReactNode;
  ruta: string;
  // Posicion en la grid 1..5 (solo usado por secundarios para centrarlos)
  col?: number;
}

// 4 modulos principales siempre visibles
const ITEMS_PRINCIPALES: ItemNav[] = [
  {
    id: "inicio",
    nombre: "Inicio",
    icono: <Home className="h-5 w-5" />,
    ruta: "/registro-visitantes",
  },
  {
    id: "actividades",
    nombre: "Actividades",
    icono: <ClipboardList className="h-5 w-5" />,
    ruta: "/actividades",
  },
  {
    id: "reportes",
    nombre: "Reportes",
    icono: <BarChart3 className="h-5 w-5" />,
    ruta: "/reportes",
  },
  {
    id: "cierre-diario",
    nombre: "Cierre",
    icono: <Calculator className="h-5 w-5" />,
    ruta: "/cierre-diario",
  },
];

// Secundarios: col indica en que columna (de 5) se ubican, centrados
const ITEMS_SECUNDARIOS: ItemNav[] = [
  {
    id: "donaciones",
    nombre: "Donativos",
    icono: <Heart className="h-5 w-5" />,
    ruta: "/donaciones",
    col: 1,
  },
  {
    id: "auditoria",
    nombre: "Auditoría",
    icono: <History className="h-5 w-5" />,
    ruta: "/auditoria",
    col: 2,
  },
  {
    id: "sincronizacion",
    nombre: "Sync",
    icono: <CloudCog className="h-5 w-5" />,
    ruta: "/sincronizacion",
    col: 4,
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    icono: <Users className="h-5 w-5" />,
    ruta: "/usuarios",
    col: 5,
  },
];

const SPRING_SUAVE = { type: "spring" as const, stiffness: 380, damping: 32 };

export function BarraNavegacionInferior() {
  const pathname = usePathname();
  const [expandido, setExpandido] = useState(false);

  // Colapsar automaticamente al cambiar de ruta
  useEffect(() => {
    setExpandido(false);
  }, [pathname]);

  // No mostrar en login
  if (pathname === "/login") return null;

  const estaActivo = (ruta: string) =>
    pathname === ruta || pathname.startsWith(ruta + "/");
  const algunSecundarioActivo = ITEMS_SECUNDARIOS.some((i) =>
    estaActivo(i.ruta),
  );

  // Estilos base compartidos por TODOS los items
  const itemBaseClass =
    "relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 px-1 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  // Renderiza un item con pill animada por layoutId
  const renderItem = (item: ItemNav, isSecondary = false) => {
    const activo = estaActivo(item.ruta);
    return (
      <motion.div
        key={item.id}
        whileTap={{ scale: 0.9 }}
        transition={SPRING_SUAVE}
        style={isSecondary && item.col ? { gridColumn: item.col } : undefined}
      >
        <Link
          href={item.ruta}
          aria-current={activo ? "page" : undefined}
          className={cn(
            itemBaseClass,
            "w-full",
            activo ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {activo && (
            <motion.span
              layoutId="nav-pill-activa"
              className="absolute inset-0 -z-0 rounded-2xl bg-primary/15"
              transition={SPRING_SUAVE}
            />
          )}
          <span className="relative z-10">{item.icono}</span>
          <span className="relative z-10 text-[10px] font-medium leading-tight">
            {item.nombre}
          </span>
        </Link>
      </motion.div>
    );
  };

  return (
    <LayoutGroup id="navbar-inferior">
      {/* Spacer para que el contenido no quede oculto detras de la barra */}
      <div aria-hidden className="h-24 md:hidden" />

      {/* Backdrop transparente — captura clicks para cerrar */}
      <AnimatePresence>
        {expandido && (
          <motion.button
            type="button"
            aria-label="Cerrar menu expandido"
            onClick={() => setExpandido(false)}
            className="fixed inset-0 z-30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Navegacion principal"
        className="fixed bottom-3 left-3 right-3 z-40 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <motion.div
          layout
          transition={SPRING_SUAVE}
          className={cn(
            "mx-auto max-w-md overflow-hidden border border-border/60",
            "bg-background/85 backdrop-blur-xl",
            "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]",
            expandido ? "rounded-[28px]" : "rounded-[32px]",
          )}
        >
          {/* Panel expandible de modulos secundarios */}
          <AnimatePresence initial={false}>
            {expandido && (
              <motion.div
                key="panel-secundario"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { type: "spring", stiffness: 400, damping: 38 },
                  opacity: { duration: 0.18 },
                }}
                className="overflow-hidden"
              >
                <div className="pt-3 px-1.5 pb-0">
                  {/* Misma grid de 5 columnas que la principal para alinear anchos */}
                  <motion.div
                    className="grid grid-cols-5 gap-1"
                    initial="oculto"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: { staggerChildren: 0.05, delayChildren: 0.05 },
                      },
                      oculto: {},
                    }}
                  >
                    {ITEMS_SECUNDARIOS.map((item) => (
                      <motion.div
                        key={item.id}
                        variants={{
                          oculto: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        transition={SPRING_SUAVE}
                        style={{ gridColumn: item.col }}
                      >
                        {renderItem(item, false)}
                      </motion.div>
                    ))}
                  </motion.div>
                  {/* Separador tenue entre filas */}
                  <div className="mx-3 mt-2 h-px bg-border/50" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Barra principal — siempre visible */}
          <div className="grid grid-cols-5 gap-1 p-1.5">
            {ITEMS_PRINCIPALES.map((item) => renderItem(item))}

            {/* Boton Mas / Menos */}
            <motion.button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              aria-expanded={expandido}
              aria-label={expandido ? "Ocultar mas modulos" : "Ver mas modulos"}
              whileTap={{ scale: 0.9 }}
              transition={SPRING_SUAVE}
              className={cn(
                itemBaseClass,
                expandido || algunSecundarioActivo
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {(expandido || algunSecundarioActivo) && !expandido && (
                <span className="absolute inset-0 -z-0 rounded-2xl bg-primary/15" />
              )}
              <motion.span
                className="relative z-10"
                animate={{ rotate: expandido ? 180 : 0 }}
                transition={SPRING_SUAVE}
              >
                <ChevronUp className="h-5 w-5" />
              </motion.span>
              <span className="relative z-10 text-[10px] font-medium leading-tight">
                {expandido ? "Menos" : "Mas"}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </nav>
    </LayoutGroup>
  );
}
