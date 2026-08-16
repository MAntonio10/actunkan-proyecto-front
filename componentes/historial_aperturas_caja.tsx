"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LockOpen,
  Lock,
  Ban,
  AlertTriangle,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { type AperturaCajaBackend } from "@/tipos";

const TODOS = "todos";

interface Props {
  /** Cambia al abrir, cerrar o reabrir una caja, para recargar. */
  refrescarToken?: number;
  onCambio?: () => void;
}

function aNumero(valor: string | number | undefined | null): number {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return typeof n === "number" && !isNaN(n) ? n : 0;
}

function moneda(valor: string | number | undefined): string {
  return `Q${aNumero(valor).toFixed(2)}`;
}

function formatearFechaHora(valor?: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
}

function estaAbierta(a: AperturaCajaBackend): boolean {
  return (a.estado?.nombre || "").toLowerCase().trim() === "abierta";
}

export function HistorialAperturasCaja({ refrescarToken, onCambio }: Props) {
  const { puedeAccion } = useAutenticacion();
  const puedeAnular = puedeAccion("Cajas", "Anular");

  const [aperturas, setAperturas] = useState<AperturaCajaBackend[]>([]);
  const [cargando, setCargando] = useState(true);

  const [estado, setEstado] = useState<string>(TODOS);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [incluirAnulados, setIncluirAnulados] = useState(true);

  const [aAnular, setAAnular] = useState<AperturaCajaBackend | null>(null);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.cajas.listar({
        estado: estado !== TODOS ? estado : undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        incluirAnulados: incluirAnulados || undefined,
      });
      setAperturas(Array.isArray(res) ? res : []);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cargar el historial";
      toast.error("Error al cargar aperturas", { description: mensaje });
      setAperturas([]);
    } finally {
      setCargando(false);
    }
  }, [estado, fechaInicio, fechaFin, incluirAnulados]);

  useEffect(() => {
    cargar();
  }, [cargar, refrescarToken]);

  const anular = useCallback(async () => {
    if (!aAnular || anulandoId !== null) return;
    setAnulandoId(aAnular.id);
    try {
      await api.cajas.anular(aAnular.id);
      toast.success("Apertura anulada", {
        description: "La caja queda sin efecto; puede abrir una nueva.",
      });
      setAAnular(null);
      await cargar();
      onCambio?.();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular la apertura";
      // 400 si la caja ya está cerrada: primero hay que anular el cierre
      toast.error("No se pudo anular", { description: mensaje });
    } finally {
      setAnulandoId(null);
    }
  }, [aAnular, anulandoId, cargar, onCambio]);

  return (
    <div className="space-y-6">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <LockOpen className="h-5 w-5 text-primary" />
              Historial de aperturas
            </CardTitle>
            <CardDescription>
              Una apertura solo puede anularse mientras la caja siga abierta.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-9 w-[130px] text-xs bg-muted/40 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  <SelectItem value="Abierta">Abierta</SelectItem>
                  <SelectItem value="Cerrada">Cerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="h-9 text-xs bg-muted/40 border-border/60"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="h-9 text-xs bg-muted/40 border-border/60"
              />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch
                id="incluir-anuladas"
                checked={incluirAnulados}
                onCheckedChange={setIncluirAnulados}
              />
              <Label htmlFor="incluir-anuladas" className="text-xs cursor-pointer whitespace-nowrap">
                Ver anuladas
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={cargar}
              disabled={cargando}
              className="h-9 gap-2 cursor-pointer"
            >
              <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando aperturas...</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Fondo inicial</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Observaciones</TableHead>
                      {puedeAnular && <TableHead className="w-[110px] text-right" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aperturas.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={puedeAnular ? 6 : 5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No hay aperturas que coincidan con el filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      aperturas.map((a) => {
                        const abierta = estaAbierta(a);
                        return (
                          <TableRow
                            key={a.id}
                            className={cn(
                              a.anulado
                                ? "bg-destructive/[0.06] border-l-4 border-l-destructive opacity-75"
                                : abierta
                                  ? "bg-emerald-500/[0.07] border-l-4 border-l-emerald-500"
                                  : "hover:bg-muted/20 border-l-4 border-l-transparent",
                            )}
                          >
                            <TableCell className="text-xs whitespace-nowrap">
                              <span className="text-foreground font-medium">
                                {formatearFechaHora(a.fechaCreacion)}
                              </span>
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                #{a.id}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{a.usuario?.nombre || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {moneda(a.montoInicial)}
                            </TableCell>
                            <TableCell>
                              {a.anulado ? (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] border-destructive/40 text-destructive bg-destructive/10"
                                >
                                  Anulada
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px] gap-1 font-semibold",
                                    abierta
                                      ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                      : "border-border/60 text-muted-foreground bg-muted/40",
                                  )}
                                >
                                  {abierta ? (
                                    <LockOpen className="h-3 w-3" />
                                  ) : (
                                    <Lock className="h-3 w-3" />
                                  )}
                                  {a.estado?.nombre || "—"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                              {a.observaciones || "—"}
                            </TableCell>
                            {puedeAnular && (
                              <TableCell className="text-right">
                                {/* Solo se anula mientras siga abierta: si ya
                                    cerró, primero hay que anular el cierre. */}
                                {!a.anulado && abierta && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAAnular(a)}
                                    disabled={anulandoId === a.id}
                                    className="h-8 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                  >
                                    {anulandoId === a.id ? (
                                      <Spinner className="h-3.5 w-3.5" />
                                    ) : (
                                      <Ban className="h-3.5 w-3.5" />
                                    )}
                                    Anular
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Vista móvil */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {aperturas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                    No hay aperturas que coincidan con el filtro.
                  </div>
                ) : (
                  aperturas.map((a) => {
                    const abierta = estaAbierta(a);
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "p-4 rounded-xl border space-y-3 shadow-sm",
                          a.anulado
                            ? "border-destructive/40 bg-destructive/[0.06] border-l-4 border-l-destructive"
                            : abierta
                              ? "border-emerald-500/40 bg-emerald-500/[0.07] border-l-4 border-l-emerald-500"
                              : "border-border/60 bg-card/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {formatearFechaHora(a.fechaCreacion)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.usuario?.nombre || "—"} · #{a.id}
                            </p>
                          </div>
                          {a.anulado ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-destructive/40 text-destructive shrink-0"
                            >
                              Anulada
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] shrink-0",
                                abierta
                                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                  : "border-border/60 text-muted-foreground",
                              )}
                            >
                              {a.estado?.nombre || "—"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Fondo inicial:</span>
                          <span className="font-mono font-semibold">{moneda(a.montoInicial)}</span>
                        </div>

                        {a.observaciones && (
                          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
                            {a.observaciones}
                          </p>
                        )}

                        {puedeAnular && !a.anulado && abierta && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAAnular(a)}
                            disabled={anulandoId === a.id}
                            className="w-full h-9 gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            {anulandoId === a.id ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                            Anular apertura
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={aAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto && anulandoId === null) setAAnular(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Anular esta apertura?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Se anulará la apertura del{" "}
                  <strong>{formatearFechaHora(aAnular?.fechaCreacion)}</strong> con fondo inicial de{" "}
                  <strong>{moneda(aAnular?.montoInicial)}</strong>.
                </p>
                <p>
                  Es para corregir una apertura hecha por error. Solo funciona mientras la caja
                  siga abierta: si ya se cerró, primero hay que anular el cierre.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulandoId !== null} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                anular();
              }}
              disabled={anulandoId !== null}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer gap-2"
            >
              {anulandoId !== null && <Spinner className="h-4 w-4" />}
              Sí, anular apertura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
