"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Ban,
  RotateCcw,
  AlertTriangle,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { type SectorParqueBackend } from "@/tipos";

interface Props {
  /** Avisa al módulo para que refresque el selector del formulario. */
  onCambio?: () => void;
}

export function CatalogoSectores({ onCambio }: Props) {
  const { puedeAccion } = useAutenticacion();
  const puedeCrear = puedeAccion("ActividadesParque", "Crear");
  const puedeEditar = puedeAccion("ActividadesParque", "Editar");
  const puedeAnular = puedeAccion("ActividadesParque", "Anular");

  const [sectores, setSectores] = useState<SectorParqueBackend[]>([]);
  const [cargando, setCargando] = useState(true);
  const [incluirAnulados, setIncluirAnulados] = useState(true);

  const [dialogo, setDialogo] = useState(false);
  const [editando, setEditando] = useState<SectorParqueBackend | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [aAnular, setAAnular] = useState<SectorParqueBackend | null>(null);
  const [accionEnCursoId, setAccionEnCursoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.sectores.listar(incluirAnulados);
      setSectores(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudieron cargar los sectores";
      toast.error("Error al cargar sectores", { description: mensaje });
      setSectores([]);
    } finally {
      setCargando(false);
    }
  }, [incluirAnulados]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = () => {
    setEditando(null);
    setNombre("");
    setDialogo(true);
  };

  const abrirEditar = (s: SectorParqueBackend) => {
    setEditando(s);
    setNombre(s.nombre);
    setDialogo(true);
  };

  const guardar = async () => {
    if (guardando) return;
    const limpio = nombre.trim();
    if (limpio.length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return;
    }

    setGuardando(true);
    try {
      if (editando) {
        await api.sectores.actualizar(editando.id, limpio);
        toast.success("Sector renombrado", {
          description: "El cambio se refleja en las actividades que lo usan.",
        });
      } else {
        await api.sectores.crear(limpio);
        toast.success("Sector creado");
      }
      setDialogo(false);
      await cargar();
      onCambio?.();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo guardar el sector";
      // 409 si el nombre ya existe, incluso si ese sector está anulado
      toast.error("Error al guardar", { description: mensaje });
    } finally {
      setGuardando(false);
    }
  };

  const anular = useCallback(async () => {
    if (!aAnular || accionEnCursoId !== null) return;
    setAccionEnCursoId(aAnular.id);
    try {
      await api.sectores.anular(aAnular.id);
      toast.success("Sector dado de baja", {
        description: "Sale del selector; las actividades ya publicadas lo conservan.",
      });
      setAAnular(null);
      await cargar();
      onCambio?.();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular el sector";
      toast.error("Error al anular", { description: mensaje });
    } finally {
      setAccionEnCursoId(null);
    }
  }, [aAnular, accionEnCursoId, cargar, onCambio]);

  const activar = async (s: SectorParqueBackend) => {
    if (accionEnCursoId !== null) return;
    setAccionEnCursoId(s.id);
    try {
      await api.sectores.activar(s.id);
      toast.success("Sector reactivado");
      await cargar();
      onCambio?.();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo reactivar el sector";
      toast.error("Error al reactivar", { description: mensaje });
    } finally {
      setAccionEnCursoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Sectores del parque
            </CardTitle>
            <CardDescription>
              Alimentan el campo Sector al publicar una actividad.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="ver-anulados-sectores"
                checked={incluirAnulados}
                onCheckedChange={setIncluirAnulados}
              />
              <Label
                htmlFor="ver-anulados-sectores"
                className="text-xs cursor-pointer whitespace-nowrap"
              >
                Ver dados de baja
              </Label>
            </div>
            {puedeCrear && (
              <Button onClick={abrirCrear} size="sm" className="h-9 gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                Nuevo sector
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando sectores...</p>
            </div>
          ) : sectores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">Aún no hay sectores registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sectores.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3",
                    s.anulado
                      ? "border-border/40 bg-muted/30 opacity-70"
                      : "border-border/60 bg-card/60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground flex items-center gap-2 flex-wrap">
                      <span className="truncate">{s.nombre}</span>
                      {s.anulado && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive/40 text-destructive"
                        >
                          De baja
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeof s._count?.actividades === "number"
                        ? `${s._count.actividades} actividad${
                            s._count.actividades === 1 ? "" : "es"
                          }`
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {puedeEditar && !s.anulado && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEditar(s)}
                        className="h-8 w-8 cursor-pointer"
                        aria-label={`Renombrar ${s.nombre}`}
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                    )}
                    {puedeAnular && !s.anulado && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setAAnular(s)}
                        disabled={accionEnCursoId === s.id}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                        aria-label={`Dar de baja ${s.nombre}`}
                      >
                        {accionEnCursoId === s.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {puedeEditar && s.anulado && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => activar(s)}
                        disabled={accionEnCursoId === s.id}
                        className="h-8 gap-1.5 text-xs cursor-pointer"
                      >
                        {accionEnCursoId === s.id ? (
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
        </CardContent>
      </Card>

      <Dialog open={dialogo} onOpenChange={(v) => !guardando && setDialogo(v)}>
        <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editando ? "Renombrar sector" : "Nuevo sector"}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? "El cambio se refleja de inmediato en todas las actividades que lo usan."
                : "El nombre debe ser único, de 3 a 255 caracteres."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <Label htmlFor="sector-nombre">Nombre</Label>
            <Input
              id="sector-nombre"
              placeholder="Ej. Sector Norte"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={255}
              className="h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardar();
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Si el nombre ya existe en un sector dado de baja, reactívelo en lugar de crear otro.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogo(false)}
              disabled={guardando}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="gap-2 cursor-pointer"
            >
              {guardando ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={aAnular !== null}
        onOpenChange={(v) => {
          if (!v && accionEnCursoId === null) setAAnular(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Dar de baja este sector?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{aAnular?.nombre}</strong> saldrá del selector y no podrá asignarse a
              actividades nuevas.
              {typeof aAnular?._count?.actividades === "number" &&
                aAnular._count.actividades > 0 && (
                  <>
                    {" "}
                    Las <strong>{aAnular._count.actividades}</strong> actividades que ya lo usan lo
                    conservan: no se reescribe el historial.
                  </>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accionEnCursoId !== null} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                anular();
              }}
              disabled={accionEnCursoId !== null}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer gap-2"
            >
              {accionEnCursoId !== null && <Spinner className="h-4 w-4" />}
              Sí, dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
