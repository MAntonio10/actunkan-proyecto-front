"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ScanLine,
  ClipboardList,
  BarChart3,
  ChevronUp,
  Calculator,
  CloudCog,
  Users,
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
  // {
  //   id: 'control',
  //   nombre: 'Control',
  //   icono: <ScanLine className="h-5 w-5" />,
  //   ruta: '/control-acceso',
  // },
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
    id: "sincronizacion",
    nombre: "Sync",
    icono: <CloudCog className="h-5 w-5" />,
    ruta: "/sincronizacion",
    col: 2,
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    icono: <Users className="h-5 w-5" />,
    ruta: "/usuarios",
    col: 4,
  },
];

// iOS-like spring ease curve
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

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

  // Estilos compartidos para TODOS los items (principales y secundarios)
  // de modo que tengan el mismo tamano y apariencia
  const itemBaseClass =
    "flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 px-1 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const itemColorClass = (activo: boolean) =>
    activo
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:text-foreground";

  return (
    <>
      {/* Spacer para que el contenido no quede oculto detras de la barra */}
      <div aria-hidden className="h-24 md:hidden" />

      {/* Backdrop transparente - solo captura clicks para cerrar, sin blur ni oscurecer */}
      <button
        type="button"
        aria-label="Cerrar menu expandido"
        onClick={() => setExpandido(false)}
        tabIndex={expandido ? 0 : -1}
        className={cn(
          "fixed inset-0 z-30 md:hidden",
          expandido ? "pointer-events-auto" : "pointer-events-none",
        )}
      />

      <nav
        aria-label="Navegacion principal"
        className="fixed bottom-3 left-3 right-3 z-40 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className={cn(
            "mx-auto max-w-md overflow-hidden border border-border/60",
            "bg-background/85 backdrop-blur-xl",
            "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]",
            // La barra va de redondeada pill a redondeada panel
            expandido ? "rounded-[28px]" : "rounded-[32px]",
          )}
          style={{
            transitionProperty: "border-radius",
            transitionDuration: "400ms",
            transitionTimingFunction: EASE,
          }}
        >
          {/* Panel expandible de modulos secundarios */}
          <div
            aria-hidden={!expandido}
            className={cn(
              "grid",
              expandido ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
            style={{
              transitionProperty: "grid-template-rows",
              transitionDuration: "400ms",
              transitionTimingFunction: EASE,
            }}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  "pt-3 px-1.5 pb-0",
                  // Transicion de entrada del contenido: fade + slide sutil
                  expandido
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-2",
                )}
                style={{
                  transitionProperty: "opacity, transform",
                  transitionDuration: "350ms",
                  transitionTimingFunction: EASE,
                  transitionDelay: expandido ? "80ms" : "0ms",
                }}
              >
                {/* Misma grid de 5 columnas que la barra principal para que
                    los items tengan exactamente el mismo ancho */}
                <div className="grid grid-cols-5 gap-1">
                  {ITEMS_SECUNDARIOS.map((item) => {
                    const activo = estaActivo(item.ruta);
                    return (
                      <Link
                        key={item.id}
                        href={item.ruta}
                        aria-current={activo ? "page" : undefined}
                        style={{ gridColumn: item.col }}
                        className={cn(
                          itemBaseClass,
                          itemColorClass(activo),
                          "transition-colors duration-200",
                        )}
                      >
                        {item.icono}
                        <span className="text-[10px] font-medium leading-tight">
                          {item.nombre}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {/* Separador tenue entre ambas filas */}
                <div className="mx-3 mt-2 h-px bg-border/50" />
              </div>
            </div>
          </div>

          {/* Barra principal - siempre visible */}
          <div className="grid grid-cols-5 gap-1 p-1.5">
            {ITEMS_PRINCIPALES.map((item) => {
              const activo = estaActivo(item.ruta);
              return (
                <Link
                  key={item.id}
                  href={item.ruta}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    itemBaseClass,
                    itemColorClass(activo),
                    "transition-colors duration-200",
                  )}
                >
                  {item.icono}
                  <span className="text-[10px] font-medium leading-tight">
                    {item.nombre}
                  </span>
                </Link>
              );
            })}

            {/* Boton Mas / Menos - 5ta columna, mismo tamano */}
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              aria-expanded={expandido}
              aria-label={expandido ? "Ocultar mas modulos" : "Ver mas modulos"}
              className={cn(
                itemBaseClass,
                itemColorClass(expandido || algunSecundarioActivo),
                "transition-colors duration-200",
              )}
            >
              <ChevronUp
                className={cn("h-5 w-5")}
                style={{
                  transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
                  transitionProperty: "transform",
                  transitionDuration: "350ms",
                  transitionTimingFunction: EASE,
                }}
              />
              <span className="text-[10px] font-medium leading-tight">
                {expandido ? "Menos" : "Mas"}
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
