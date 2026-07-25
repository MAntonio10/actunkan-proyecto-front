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
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { api } from "@/lib/api";

interface ItemNav {
  id: string;
  nombre: string;
  icono: React.ReactNode;
  ruta: string;
}

const TODOS_LOS_MODULOS: ItemNav[] = [
  {
    id: "inicio",
    nombre: "Inicio",
    icono: <Home className="h-5 w-5" />,
    ruta: "/registro-visitantes",
  },
  {
    id: "usuarios",
    nombre: "Usuarios",
    icono: <Users className="h-5 w-5" />,
    ruta: "/usuarios",
  },
  {
    id: "cierre-diario",
    nombre: "Cierre",
    icono: <Calculator className="h-5 w-5" />,
    ruta: "/cierre-diario",
  },
  {
    id: "reportes",
    nombre: "Reportes",
    icono: <BarChart3 className="h-5 w-5" />,
    ruta: "/reportes",
  },
  {
    id: "actividades",
    nombre: "Actividades",
    icono: <ClipboardList className="h-5 w-5" />,
    ruta: "/actividades",
  },
  {
    id: "donaciones",
    nombre: "Donativos",
    icono: <Heart className="h-5 w-5" />,
    ruta: "/donaciones",
  },
  {
    id: "bitacora",
    nombre: "Bitácora",
    icono: <History className="h-5 w-5" />,
    ruta: "/bitacora",
  },
  {
    id: "sincronizacion",
    nombre: "Sync",
    icono: <CloudCog className="h-5 w-5" />,
    ruta: "/sincronizacion",
  },
];

const SPRING_SUAVE = { type: "spring" as const, stiffness: 380, damping: 32 };

export function BarraNavegacionInferior() {
  const pathname = usePathname();
  const [expandido, setExpandido] = useState(false);
  const [modulosAnulados, setModulosAnulados] = useState<string[]>([]);
  const { tieneAccesoModulo, tienePermiso, tieneAlgunPermiso, usuario } = useAutenticacion();

  useEffect(() => {
    if (usuario) {
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
  }, [usuario]);

  // Colapsar automáticamente al cambiar de ruta
  useEffect(() => {
    setExpandido(false);
  }, [pathname]);

  if (!tieneAlgunPermiso()) {
    return null;
  }

  const esModuloAnuladoBD = (nombres: string[]) => {
    return nombres.some((n) => modulosAnulados.includes(n.toLowerCase().trim()));
  };

  const esModuloPermitido = (id: string) => {
    if (id === "inicio") {
      if (esModuloAnuladoBD(["Registro Visitantes", "Visitantes", "RegistroVisitantes", "Taquilla"])) return false;
      return (
        tieneAccesoModulo("Registro Visitantes") ||
        tieneAccesoModulo("Visitantes") ||
        tieneAccesoModulo("RegistroVisitantes") ||
        tieneAccesoModulo("Taquilla") ||
        tienePermiso("Registro Visitantes", "Ver")
      );
    }
    if (id === "usuarios") {
      if (esModuloAnuladoBD(["Usuarios"])) return false;
      return (
        tieneAccesoModulo("Usuarios") ||
        tienePermiso("Usuarios", "Ver") ||
        tieneAccesoModulo("Puestos") ||
        tieneAccesoModulo("Modulos")
      );
    }
    if (id === "donaciones") {
      if (esModuloAnuladoBD(["Donaciones"])) return false;
      return tieneAccesoModulo("Donaciones") || tienePermiso("Donaciones", "Ver");
    }
    if (id === "bitacora" || id === "auditoria") {
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
    if (id === "cierre-diario") {
      if (esModuloAnuladoBD(["Cierre Diario", "CierreDiario"])) return false;
      return (
        tieneAccesoModulo("Cierre Diario") ||
        tieneAccesoModulo("CierreDiario") ||
        tienePermiso("Cierre Diario", "Ver")
      );
    }
    if (id === "reportes") {
      if (esModuloAnuladoBD(["Reportes"])) return false;
      return tieneAccesoModulo("Reportes") || tienePermiso("Reportes", "Ver");
    }
    if (id === "sincronizacion") {
      if (esModuloAnuladoBD(["Sincronizacion", "Sincronización"])) return false;
      return (
        tieneAccesoModulo("Sincronizacion") ||
        tieneAccesoModulo("Sincronización") ||
        tienePermiso("Sincronizacion", "Ver")
      );
    }
    if (id === "actividades") {
      if (esModuloAnuladoBD(["Actividades"])) return false;
      return tieneAccesoModulo("Actividades") || tienePermiso("Actividades", "Ver");
    }
    return false;
  };

  const modulosPermitidos = TODOS_LOS_MODULOS.filter((m) => esModuloPermitido(m.id));

  // Determinar la lista principal y secundaria de forma inteligente
  const tieneMasDeCuatro = modulosPermitidos.length > 4;
  const modulosPrincipales = tieneMasDeCuatro
    ? modulosPermitidos.slice(0, 4)
    : modulosPermitidos;
  const modulosSecundarios = tieneMasDeCuatro
    ? modulosPermitidos.slice(4)
    : [];

  // No mostrar en login o si no hay ningún módulo permitido
  if (pathname === "/login" || modulosPermitidos.length === 0) return null;

  const estaActivo = (ruta: string) =>
    pathname === ruta || pathname.startsWith(ruta + "/");
  const algunSecundarioActivo = modulosSecundarios.some((i) =>
    estaActivo(i.ruta),
  );

  const itemBaseClass =
    "relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 px-3 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const renderItem = (item: ItemNav) => {
    const activo = estaActivo(item.ruta);
    return (
      <motion.div
        key={item.id}
        whileTap={{ scale: 0.9 }}
        transition={SPRING_SUAVE}
        className="w-full flex justify-center"
      >
        <Link
          href={item.ruta}
          aria-current={activo ? "page" : undefined}
          className={cn(
            itemBaseClass,
            "w-full",
            activo ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {activo && (
            <motion.span
              layoutId="nav-pill-activa"
              className="absolute inset-0 -z-0 rounded-2xl bg-primary/15 border border-primary/30"
              transition={SPRING_SUAVE}
            />
          )}
          <span className="relative z-10">{item.icono}</span>
          <span className="relative z-10 text-[10px] leading-tight">
            {item.nombre}
          </span>
        </Link>
      </motion.div>
    );
  };

  return (
    <LayoutGroup id="navbar-inferior">
      {/* Spacer para que el contenido no quede oculto detrás de la barra */}
      <div aria-hidden className="h-24 md:hidden" />

      {/* Backdrop transparente para cerrar el panel expandido */}
      <AnimatePresence>
        {expandido && (
          <motion.button
            type="button"
            aria-label="Cerrar menú expandido"
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
        aria-label="Navegación principal"
        className="fixed bottom-3 left-3 right-3 z-40 md:hidden flex justify-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <motion.div
          layout
          transition={SPRING_SUAVE}
          className={cn(
            "overflow-hidden border border-border/60",
            "bg-background/90 backdrop-blur-xl",
            "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]",
            expandido ? "rounded-[28px]" : "rounded-[32px]",
            modulosPermitidos.length === 1 ? "w-auto px-6 py-1" : "w-full max-w-md"
          )}
        >
          {/* Panel expandible de módulos secundarios si existen más de 4 */}
          <AnimatePresence initial={false}>
            {expandido && modulosSecundarios.length > 0 && (
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
                  <motion.div
                    className="grid grid-cols-4 gap-1 justify-items-center"
                    initial="oculto"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: { staggerChildren: 0.05, delayChildren: 0.05 },
                      },
                      oculto: {},
                    }}
                  >
                    {modulosSecundarios.map((item) => (
                      <motion.div
                        key={item.id}
                        variants={{
                          oculto: { opacity: 0, y: 8 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        transition={SPRING_SUAVE}
                        className="w-full"
                      >
                        {renderItem(item)}
                      </motion.div>
                    ))}
                  </motion.div>
                  <div className="mx-3 mt-2 h-px bg-border/50" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Barra principal inteligente */}
          <div
            className={cn(
              "p-1.5 items-center justify-center",
              modulosPermitidos.length === 1
                ? "flex w-full"
                : `grid gap-1 ${
                    tieneMasDeCuatro
                      ? "grid-cols-5"
                      : `grid-cols-${modulosPrincipales.length}`
                  }`
            )}
            style={
              !tieneMasDeCuatro && modulosPermitidos.length > 1
                ? { gridTemplateColumns: `repeat(${modulosPrincipales.length}, minmax(0, 1fr))` }
                : undefined
            }
          >
            {modulosPrincipales.map((item) => renderItem(item))}

            {/* Botón Más / Menos sólo cuando hay más de 4 módulos */}
            {tieneMasDeCuatro && (
              <motion.button
                type="button"
                onClick={() => setExpandido((v) => !v)}
                aria-expanded={expandido}
                aria-label={expandido ? "Ocultar más módulos" : "Ver más módulos"}
                whileTap={{ scale: 0.9 }}
                transition={SPRING_SUAVE}
                className={cn(
                  itemBaseClass,
                  "w-full",
                  expandido || algunSecundarioActivo
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {(expandido || algunSecundarioActivo) && !expandido && (
                  <span className="absolute inset-0 -z-0 rounded-2xl bg-primary/15 border border-primary/30" />
                )}
                <motion.span
                  className="relative z-10"
                  animate={{ rotate: expandido ? 180 : 0 }}
                  transition={SPRING_SUAVE}
                >
                  <ChevronUp className="h-5 w-5" />
                </motion.span>
                <span className="relative z-10 text-[10px] leading-tight">
                  {expandido ? "Menos" : "Más"}
                </span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </nav>
    </LayoutGroup>
  );
}
