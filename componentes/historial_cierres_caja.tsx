"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  Scale,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
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
import {
  type CierreCajaHistorial,
  type MetricasCierres,
} from "@/tipos";

const LIMITE = 50;

interface Props {
  /** Cambia cuando se cierra o reabre una caja, para recargar. */
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

/** Diferencia con signo y color: negativa es faltante, positiva sobrante. */
function Diferencia({ valor }: { valor: string | number | undefined }) {
  const n = aNumero(valor);
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        n === 0 ? "text-emerald-600" : n > 0 ? "text-blue-600" : "text-destructive",
      )}
    >
      {n > 0 ? "+" : ""}
      {moneda(n)}
    </span>
  );
}

export function HistorialCierresCaja({ refrescarToken, onCambio }: Props) {
  const { puedeAccion } = useAutenticacion();
  // Anular un cierre es supervisión: Cajas/Editar, no Anular.
  const puedeAnularCierre = puedeAccion("Cajas", "Editar");

  const [cierres, setCierres] = useState<CierreCajaHistorial[]>([]);
  const [metricas, setMetricas] = useState<MetricasCierres | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [soloAnulados, setSoloAnulados] = useState(false);

  const [cierreAAnular, setCierreAAnular] = useState<CierreCajaHistorial | null>(null);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.cajas.getCierres({
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        soloAnulados: soloAnulados || undefined,
        // Los anulados son la señal de que una caja se reabrió: se incluyen
        // siempre, porque ocultarlos borraría justo lo que hay que auditar.
        incluirAnulados: true,
        pagina,
        limite: LIMITE,
      });
      setCierres(Array.isArray(res.datos) ? res.datos : []);
      setTotal(res.total || 0);
      setMetricas(res.metricas || null);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cargar el historial";
      toast.error("Error al cargar cierres", { description: mensaje });
      setCierres([]);
      setTotal(0);
      setMetricas(null);
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin, soloAnulados, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar, refrescarToken]);

  const anularCierre = useCallback(async () => {
    if (!cierreAAnular || anulandoId !== null) return;
    const idApertura = cierreAAnular.idApertura;
    setAnulandoId(cierreAAnular.id);
    try {
      await api.cajas.anularCierre(idApertura);
      toast.success("Cierre anulado", {
        description: "La caja volvió a quedar abierta para corregir el monto.",
      });
      setCierreAAnular(null);
      await cargar();
      onCambio?.();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular el cierre";
      // 409 si ya hay otra caja abierta; 400 si no hay cierre vigente
      toast.error("No se pudo anular el cierre", { description: mensaje });
    } finally {
      setAnulandoId(null);
    }
  }, [cierreAAnular, anulandoId, cargar, onCambio]);

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const diferenciaAcum = aNumero(metricas?.diferenciaAcumulada);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Cierres
              </p>
              <p className="text-2xl font-bold text-primary">{metricas?.totalCierres ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total contado
            </p>
            <p className="text-2xl font-bold text-foreground">
              {metricas ? moneda(metricas.totalContado) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total esperado
            </p>
            <p className="text-2xl font-bold text-foreground">
              {metricas ? moneda(metricas.totalEsperado) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "backdrop-blur-sm",
            diferenciaAcum === 0
              ? "bg-emerald-500/10 border-emerald-500/30"
              : diferenciaAcum > 0
                ? "bg-blue-500/10 border-blue-500/30"
                : "bg-destructive/10 border-destructive/30",
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="shrink-0">
              {diferenciaAcum > 0 ? (
                <TrendingUp className="h-7 w-7 text-blue-500/70" />
              ) : diferenciaAcum < 0 ? (
                <TrendingDown className="h-7 w-7 text-destructive/70" />
              ) : (
                <Scale className="h-7 w-7 text-emerald-500/70" />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Diferencia acumulada
              </p>
              <p className="text-2xl font-bold">
                {metricas ? <Diferencia valor={metricas.diferenciaAcumulada} /> : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {diferenciaAcum < 0 ? "Faltante" : diferenciaAcum > 0 ? "Sobrante" : "Cuadrado"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Historial de cierres
            </CardTitle>
            <CardDescription>
              Un cierre anulado indica que la caja se reabrió para corregir un monto.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPagina(1);
                }}
                className="h-9 text-xs bg-muted/40 border-border/60"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setPagina(1);
                }}
                className="h-9 text-xs bg-muted/40 border-border/60"
              />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch
                id="solo-anulados"
                checked={soloAnulados}
                onCheckedChange={(v) => {
                  setSoloAnulados(v);
                  setPagina(1);
                }}
              />
              <Label htmlFor="solo-anulados" className="text-xs cursor-pointer whitespace-nowrap">
                Solo anulados
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando cierres...</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Fecha de cierre</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead>Observaciones</TableHead>
                      {puedeAnularCierre && <TableHead className="w-[110px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierres.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={puedeAnularCierre ? 7 : 6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No hay cierres que coincidan con el filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cierres.map((c) => (
                        <TableRow
                          key={c.id}
                          className={cn(
                            c.anulado
                              ? "bg-amber-500/[0.07] border-l-4 border-l-amber-500"
                              : "hover:bg-muted/20 border-l-4 border-l-transparent",
                          )}
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-foreground font-medium">
                                {formatearFechaHora(c.fechaCierre)}
                              </span>
                              {c.anulado && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 w-fit text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                                >
                                  Anulado · caja reabierta
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.aperturaCaja?.usuario?.nombre || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {moneda(c.montoFinal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {moneda(c.montoEsperado)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Diferencia valor={c.diferencia} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                            {c.observaciones || "—"}
                          </TableCell>
                          {puedeAnularCierre && (
                            <TableCell>
                              {!c.anulado && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCierreAAnular(c)}
                                  disabled={anulandoId === c.id}
                                  className="h-8 gap-1.5 text-xs cursor-pointer"
                                >
                                  {anulandoId === c.id ? (
                                    <Spinner className="h-3.5 w-3.5" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                  Reabrir
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Vista móvil */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {cierres.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                    No hay cierres que coincidan con el filtro.
                  </div>
                ) : (
                  cierres.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "p-4 rounded-xl border space-y-3 shadow-sm",
                        c.anulado
                          ? "border-amber-500/40 bg-amber-500/[0.07] border-l-4 border-l-amber-500"
                          : "border-border/60 bg-card/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatearFechaHora(c.fechaCierre)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.aperturaCaja?.usuario?.nombre || "—"}
                          </p>
                        </div>
                        {c.anulado && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15 shrink-0"
                          >
                            Anulado
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Contado</p>
                          <p className="font-mono font-medium">{moneda(c.montoFinal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Esperado</p>
                          <p className="font-mono">{moneda(c.montoEsperado)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Diferencia</p>
                          <Diferencia valor={c.diferencia} />
                        </div>
                      </div>

                      {c.observaciones && (
                        <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
                          {c.observaciones}
                        </p>
                      )}

                      {puedeAnularCierre && !c.anulado && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCierreAAnular(c)}
                          disabled={anulandoId === c.id}
                          className="w-full h-9 gap-1.5 text-xs cursor-pointer"
                        >
                          {anulandoId === c.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Anular cierre y reabrir caja
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {total > LIMITE && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {pagina} de {totalPaginas} · {total} cierres
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina <= 1}
                      className="gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      disabled={pagina >= totalPaginas}
                      className="gap-1 cursor-pointer"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={cierreAAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto && anulandoId === null) setCierreAAnular(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ¿Anular el cierre y reabrir la caja?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  El cierre del{" "}
                  <strong>{formatearFechaHora(cierreAAnular?.fechaCierre)}</strong> quedará anulado
                  y la caja volverá al estado <strong>Abierta</strong> para corregir el monto.
                </p>
                <p>
                  El cierre anulado <strong>no se puede reactivar</strong>: para volver a cerrar la
                  caja habrá que emitir un cierre nuevo. La anulación queda registrada como
                  evidencia de la corrección.
                </p>
                <p className="text-xs">
                  Falla si ya hay otra caja abierta: nunca pueden quedar dos a la vez.
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
                anularCierre();
              }}
              disabled={anulandoId !== null}
              className="bg-amber-600 text-white hover:bg-amber-700 cursor-pointer gap-2"
            >
              {anulandoId !== null && <Spinner className="h-4 w-4" />}
              Sí, anular y reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
