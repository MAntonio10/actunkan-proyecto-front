"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  ChevronDown,
  Compass,
  Pencil,
  Ban,
  RotateCcw,
  Settings2,
  Search,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { type GuiaBackend } from "@/tipos";

interface Props {
  idSeleccionado: number | null;
  onSeleccionar: (guia: GuiaBackend) => void;
}

export function SelectorGuia({ idSeleccionado, onSeleccionar }: Props) {
  const { puedeAccion } = useAutenticacion();
  const puedeEditar = puedeAccion("EmisionTickets", "Editar");
  const puedeAnular = puedeAccion("EmisionTickets", "Anular");
  const puedeGestionar = puedeEditar || puedeAnular;

  const [guias, setGuias] = useState<GuiaBackend[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  // Gestión (editar / anular / reactivar)
  const [dialogoGestion, setDialogoGestion] = useState(false);
  const [incluirAnulados, setIncluirAnulados] = useState(false);
  const [guiaEditando, setGuiaEditando] = useState<GuiaBackend | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [tieneCarnetEdit, setTieneCarnetEdit] = useState(true);
  const [numeroCarnetEdit, setNumeroCarnetEdit] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [accionEnCursoId, setAccionEnCursoId] = useState<number | null>(null);

  // La búsqueda va al servidor: se aplica con retardo para no pedir por tecla
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarGuias = useCallback(
    async (conAnulados: boolean) => {
      setCargando(true);
      try {
        const res = await api.guias.listar({
          buscar: busquedaAplicada || undefined,
          incluirAnulados: conAnulados || undefined,
        });
        setGuias(Array.isArray(res) ? res : []);
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : "No se pudieron cargar los guías";
        toast.error("Error al cargar guías", { description: mensaje });
        setGuias([]);
      } finally {
        setCargando(false);
      }
    },
    [busquedaAplicada],
  );

  // El selector solo muestra activos; la gestión puede incluir anulados
  useEffect(() => {
    if (abierto || dialogoGestion) {
      cargarGuias(dialogoGestion && incluirAnulados);
    }
  }, [abierto, dialogoGestion, incluirAnulados, cargarGuias]);

  const guiaSeleccionado = useMemo(
    () => guias.find((g) => g.id === idSeleccionado),
    [guias, idSeleccionado],
  );

  const abrirEdicion = (g: GuiaBackend) => {
    setGuiaEditando(g);
    setNombreEdit(g.nombre);
    setTieneCarnetEdit(g.tieneCarnet);
    setNumeroCarnetEdit(g.numeroCarnet || "");
  };

  const handleGuardarEdicion = async () => {
    if (!guiaEditando || guardando) return;

    if (!nombreEdit.trim()) {
      toast.error("El nombre del guía es obligatorio");
      return;
    }
    // El backend responde 400 si falta el carnet estando marcado como acreditado
    if (tieneCarnetEdit && !numeroCarnetEdit.trim()) {
      toast.error("Falta el número de carnet", {
        description: "Es obligatorio cuando el guía está acreditado.",
      });
      return;
    }

    setGuardando(true);
    try {
      await api.guias.actualizar(guiaEditando.id, {
        nombre: nombreEdit.trim(),
        tieneCarnet: tieneCarnetEdit,
        // Al desmarcar el carnet el backend limpia el número por su cuenta
        ...(tieneCarnetEdit ? { numeroCarnet: numeroCarnetEdit.trim() } : {}),
      });
      toast.success("Guía actualizado");
      setGuiaEditando(null);
      await cargarGuias(incluirAnulados);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo actualizar el guía";
      toast.error("Error al guardar", { description: mensaje });
    } finally {
      setGuardando(false);
    }
  };

  const handleAnular = async (g: GuiaBackend) => {
    if (accionEnCursoId !== null) return;
    setAccionEnCursoId(g.id);
    try {
      await api.guias.anular(g.id);
      toast.success("Guía dado de baja", {
        description: "Desaparece del selector; los tickets emitidos lo conservan.",
      });
      await cargarGuias(incluirAnulados);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular el guía";
      toast.error("Error al anular", { description: mensaje });
    } finally {
      setAccionEnCursoId(null);
    }
  };

  const handleActivar = async (g: GuiaBackend) => {
    if (accionEnCursoId !== null) return;
    setAccionEnCursoId(g.id);
    try {
      await api.guias.activar(g.id);
      toast.success("Guía reactivado");
      await cargarGuias(incluirAnulados);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo reactivar el guía";
      toast.error("Error al reactivar", { description: mensaje });
    } finally {
      setAccionEnCursoId(null);
    }
  };

  const activos = guias.filter((g) => !g.anulado);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Seleccionar Guía Registrado</Label>
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setDialogoGestion(true)}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Gestionar
          </button>
        )}
      </div>

      <Popover
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v);
          if (!v) setBusqueda("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            className={cn(
              "w-full h-10 justify-between bg-background border-border/60 font-normal",
              !guiaSeleccionado && "text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {guiaSeleccionado && <Compass className="h-4 w-4 text-primary shrink-0" />}
              {guiaSeleccionado
                ? `${guiaSeleccionado.nombre} ${
                    guiaSeleccionado.tieneCarnet ? "(Acreditado)" : "(Sin Carnet)"
                  }`
                : "Seleccione un guía..."}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="p-2 border-b border-border/50 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar guía por nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-9 pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-56">
            <div className="p-1">
              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Cargando...
                </div>
              ) : activos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-3">
                  {busquedaAplicada
                    ? "Ningún guía coincide con la búsqueda."
                    : "No hay guías registrados. Use “+ Crear Guía” para registrar uno al emitir."}
                </p>
              ) : (
                activos.map((g) => {
                  const seleccionado = g.id === idSeleccionado;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onSeleccionar(g);
                        setAbierto(false);
                        setBusqueda("");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm text-left cursor-pointer hover:bg-muted transition-colors",
                        seleccionado && "bg-primary/10 text-primary font-semibold",
                      )}
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="truncate">{g.nombre}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {g.tieneCarnet ? "Acreditado" : "Sin carnet · genera ticket aparte"}
                        </span>
                      </span>
                      {seleccionado && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Gestión: corregir, dar de baja y reactivar. No hay alta aquí: un guía
          nuevo se registra al emitir el ticket (guia.modo: "nuevo"). */}
      <Dialog open={dialogoGestion} onOpenChange={setDialogoGestion}>
        {/* En móvil se deja margen a los lados: el ancho por defecto del
            diálogo (100%-2rem) hacía que ocupara la pantalla de borde a borde. */}
        <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Compass className="h-4 w-4 text-primary" />
              Gestionar guías
            </DialogTitle>
            <DialogDescription>
              Los guías nuevos se registran al emitir un ticket. Aquí puede corregirlos, darlos de
              baja o reactivarlos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-2.5">
            <Label htmlFor="incluir-anulados" className="text-xs cursor-pointer">
              Mostrar guías dados de baja
            </Label>
            <Switch
              id="incluir-anulados"
              checked={incluirAnulados}
              onCheckedChange={setIncluirAnulados}
            />
          </div>

          {cargando ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Spinner className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando guías...</p>
            </div>
          ) : guias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No hay guías registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {guias.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3",
                    g.anulado ? "border-border/40 bg-muted/30 opacity-70" : "border-border/60",
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-sm text-foreground flex items-center gap-2 flex-wrap">
                      <span className="truncate">{g.nombre}</span>
                      {g.anulado && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive/40 text-destructive"
                        >
                          De baja
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {g.tieneCarnet ? (
                        <>
                          <IdCard className="h-3 w-3" />
                          {g.numeroCarnet || "Acreditado"}
                        </>
                      ) : (
                        "Sin carnet"
                      )}
                      {typeof g._count?.tickets === "number" && (
                        <span className="ml-1">· {g._count.tickets} tickets</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {puedeEditar && !g.anulado && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEdicion(g)}
                        className="h-8 w-8 cursor-pointer"
                        aria-label={`Editar ${g.nombre}`}
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                    {puedeAnular && !g.anulado && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAnular(g)}
                        disabled={accionEnCursoId === g.id}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                        aria-label={`Dar de baja ${g.nombre}`}
                      >
                        {accionEnCursoId === g.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {puedeEditar && g.anulado && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivar(g)}
                        disabled={accionEnCursoId === g.id}
                        className="h-8 gap-1.5 text-xs cursor-pointer"
                      >
                        {accionEnCursoId === g.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Reactivar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edición de un guía */}
      <Dialog
        open={guiaEditando !== null}
        onOpenChange={(v) => {
          if (!v && !guardando) setGuiaEditando(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Editar guía</DialogTitle>
            <DialogDescription>
              El número de carnet solo se guarda en el sistema; no se imprime en el pase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="guia-nombre">Nombre completo</Label>
              <Input
                id="guia-nombre"
                value={nombreEdit}
                onChange={(e) => setNombreEdit(e.target.value)}
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                No puede repetir el nombre de otro guía activo.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <IdCard className="h-4 w-4 text-primary" />
                  <span>¿Cuenta con carnet?</span>
                </div>
                <p className="text-xs text-muted-foreground">Acreditación oficial de guía</p>
              </div>
              <Switch checked={tieneCarnetEdit} onCheckedChange={setTieneCarnetEdit} />
            </div>

            {tieneCarnetEdit ? (
              <div className="space-y-1.5">
                <Label htmlFor="guia-carnet">Número de carnet</Label>
                <Input
                  id="guia-carnet"
                  placeholder="Ej. GTK-1002"
                  value={numeroCarnetEdit}
                  onChange={(e) => setNumeroCarnetEdit(e.target.value)}
                  className="h-10 font-mono text-sm"
                />
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                Sin carnet, cada recorrido de este guía genera un ticket independiente con costo.
                El número de carnet guardado se borrará.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuiaEditando(null)}
              disabled={guardando}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGuardarEdicion}
              disabled={guardando}
              className="gap-2 cursor-pointer"
            >
              {guardando ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
