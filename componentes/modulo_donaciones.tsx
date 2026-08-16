"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HandHeart,
  Banknote,
  Search,
  FileText,
  Ban,
  History,
  Plus,
  Users,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { usePdfDocumento } from "@/hooks/use_pdf_ticket";
import {
  type DonacionBackend,
  type MetricasDonaciones,
  type AperturaCajaBackend,
} from "@/tipos";

const LIMITE = 50;

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

export function ModuloDonaciones() {
  const { puedeAccion } = useAutenticacion();
  const puedeCrear = puedeAccion("Donaciones", "Crear");
  const puedeAnular = puedeAccion("Donaciones", "Anular");
  const { abrirPdf, pdfEnCursoId } = usePdfDocumento();

  const [pestana, setPestana] = useState("registro");

  // Registrar: solo el monto es obligatorio
  const [nombreDonante, setNombreDonante] = useState("");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<DonacionBackend | null>(null);

  // Caja: registrar exige una abierta, el backend responde 400 sin ella
  const [cajaActual, setCajaActual] = useState<AperturaCajaBackend | null>(null);
  const [cargandoCaja, setCargandoCaja] = useState(true);

  // Historial
  const [donaciones, setDonaciones] = useState<DonacionBackend[]>([]);
  const [metricas, setMetricas] = useState<MetricasDonaciones | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  const [aAnular, setAAnular] = useState<DonacionBackend | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarCaja = useCallback(async () => {
    setCargandoCaja(true);
    try {
      setCajaActual(await api.cajas.getActual());
    } catch {
      setCajaActual(null);
    } finally {
      setCargandoCaja(false);
    }
  }, []);

  const cargarDonaciones = useCallback(async () => {
    setCargandoLista(true);
    try {
      const res = await api.donaciones.listar({
        buscar: busquedaAplicada || undefined,
        incluirAnulados: true,
        pagina,
        limite: LIMITE,
      });
      setDonaciones(Array.isArray(res.datos) ? res.datos : []);
      setTotal(res.total || 0);
      setMetricas(res.metricas || null);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cargar el historial";
      toast.error("Error al cargar donaciones", { description: mensaje });
      setDonaciones([]);
      setTotal(0);
      setMetricas(null);
    } finally {
      setCargandoLista(false);
    }
  }, [busquedaAplicada, pagina]);

  useEffect(() => {
    cargarCaja();
  }, [cargarCaja]);

  useEffect(() => {
    cargarDonaciones();
  }, [cargarDonaciones]);

  const registrar = async () => {
    if (registrando) return;
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error("Monto no válido", { description: "Debe ser mayor a Q0.00." });
      return;
    }

    setRegistrando(true);
    try {
      const recibo = await api.donaciones.crear({
        monto: montoNum,
        nombreDonante: nombreDonante.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      setUltimoRecibo(recibo);
      toast.success("Donación registrada", {
        description: `${recibo.numeroRecibo} · ${moneda(recibo.monto)}`,
      });
      setNombreDonante("");
      setMonto("");
      setObservaciones("");
      await Promise.all([cargarDonaciones(), cargarCaja()]);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo registrar la donación";
      toast.error("Error al registrar", { description: mensaje });
    } finally {
      setRegistrando(false);
    }
  };

  const anular = useCallback(async () => {
    if (!aAnular || anulandoId !== null) return;
    setAnulandoId(aAnular.id);
    try {
      await api.donaciones.anular(aAnular.id, motivoAnulacion.trim() || undefined);
      toast.success("Recibo anulado", {
        description: "Deja de contar en el arqueo de caja.",
      });
      setAAnular(null);
      setMotivoAnulacion("");
      await cargarDonaciones();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular el recibo";
      // 400 si ya estaba anulado o si la caja de origen ya se cerró
      toast.error("No se pudo anular", { description: mensaje });
    } finally {
      setAnulandoId(null);
    }
  }, [aAnular, anulandoId, motivoAnulacion, cargarDonaciones]);

  const verPdf = (d: DonacionBackend) =>
    abrirPdf({ id: d.id, folio: d.numeroRecibo, obtener: api.donaciones.getPdf });

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Recibos emitidos
              </p>
              <p className="text-2xl font-bold text-primary">{metricas?.totalRecibos ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Monto recaudado
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {metricas ? moneda(metricas.montoRecaudado) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={pestana} onValueChange={setPestana}>
        <TabsList className="grid grid-cols-2 w-full sm:w-[340px] bg-muted/60 p-1 gap-1">
          {puedeCrear && (
            <TabsTrigger value="registro" className="gap-2 font-semibold cursor-pointer">
              <Plus className="h-4 w-4 text-primary" />
              Registrar
            </TabsTrigger>
          )}
          <TabsTrigger value="historial" className="gap-2 font-semibold cursor-pointer">
            <History className="h-4 w-4 text-primary" />
            Recibos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pestana === "registro" && puedeCrear && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3 bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <HandHeart className="h-5 w-5 text-primary" />
                Registrar donación
              </CardTitle>
              <CardDescription>
                Solo se aceptan donaciones en efectivo. Se entrega un recibo no contable.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Registrar exige caja abierta: el efectivo entra al mismo cajón
                  que las ventas y suma al arqueo. */}
              {!cargandoCaja && !cajaActual && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">No hay caja abierta</p>
                    <p className="text-muted-foreground mt-0.5">
                      La donación es efectivo que suma al arqueo, así que necesita una caja
                      abierta. Ábrala desde el módulo Caja y Cierre.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="monto-donacion">
                  Monto (Q) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="monto-donacion"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="h-11 text-lg font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nombre-donante">Nombre del donante (opcional)</Label>
                <Input
                  id="nombre-donante"
                  placeholder="Ej. Fundación Verde"
                  value={nombreDonante}
                  onChange={(e) => setNombreDonante(e.target.value)}
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  Si se deja vacío, el recibo sale a nombre de “Donante anónimo”.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-donacion">Observaciones (opcional)</Label>
                <Textarea
                  id="obs-donacion"
                  placeholder="Ej. Aporte para conservación"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="min-h-[70px] resize-none"
                />
              </div>

              <Button
                onClick={registrar}
                disabled={registrando || cargandoCaja || !cajaActual}
                className="w-full h-12 gap-2 text-base font-semibold cursor-pointer"
              >
                {registrando ? <Spinner className="h-5 w-5" /> : <HandHeart className="h-5 w-5" />}
                Registrar donación
              </Button>
            </CardContent>
          </Card>

          {/* Último recibo emitido */}
          <div className="lg:col-span-2">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 lg:sticky lg:top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Último recibo</CardTitle>
                <CardDescription>El PDF lo genera el servidor.</CardDescription>
              </CardHeader>
              <CardContent>
                {!ultimoRecibo ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-center">
                    <FileText className="h-9 w-9 opacity-40" />
                    <p className="text-sm">Aún no ha registrado ninguna donación.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <dl className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2">
                        <dt className="text-muted-foreground">No. Recibo</dt>
                        <dd className="font-mono font-semibold text-primary">
                          {ultimoRecibo.numeroRecibo}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2">
                        <dt className="text-muted-foreground">Donante</dt>
                        <dd className="text-right font-medium">
                          {ultimoRecibo.nombreDonante || "Donante anónimo"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2">
                        <dt className="text-muted-foreground">Monto</dt>
                        <dd className="font-bold tabular-nums">{moneda(ultimoRecibo.monto)}</dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2">
                        <dt className="text-muted-foreground">Fecha</dt>
                        <dd className="text-right text-xs">
                          {formatearFechaHora(ultimoRecibo.fechaCreacion)}
                        </dd>
                      </div>
                    </dl>

                    <Button
                      onClick={() => verPdf(ultimoRecibo)}
                      disabled={pdfEnCursoId === ultimoRecibo.id}
                      className="w-full gap-2 cursor-pointer"
                    >
                      {pdfEnCursoId === ultimoRecibo.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Ver recibo en PDF
                    </Button>

                    <p className="text-[11px] text-muted-foreground text-center">
                      Documento no contable: no tiene validez fiscal ni sustituye a una factura.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {(pestana === "historial" || !puedeCrear) && (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recibos de donación
              </CardTitle>
              <CardDescription>
                Los recibos se ordenan por fecha; el folio es texto, no un número.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar folio o donante..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-muted/40 border-border/60 h-9 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {cargandoLista ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Spinner className="h-7 w-7 text-primary" />
                <p className="text-sm text-muted-foreground">Cargando recibos...</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-[160px]">No. Recibo</TableHead>
                        <TableHead>Donante</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Registró</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="w-[140px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donaciones.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No hay recibos que coincidan con la búsqueda.
                          </TableCell>
                        </TableRow>
                      ) : (
                        donaciones.map((d) => (
                          <TableRow
                            key={d.id}
                            className={cn(
                              d.anulado
                                ? "bg-destructive/[0.06] border-l-4 border-l-destructive opacity-80"
                                : "hover:bg-muted/20 border-l-4 border-l-transparent",
                            )}
                          >
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {d.numeroRecibo}
                              {d.anulado && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] border-destructive/40 text-destructive"
                                >
                                  Anulado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {d.nombreDonante || (
                                <span className="text-muted-foreground italic">
                                  Donante anónimo
                                </span>
                              )}
                              {d.anulado && d.motivoAnulacion && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Motivo: {d.motivoAnulacion}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums">
                              {moneda(d.monto)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {d.usuario?.nombre || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatearFechaHora(d.fechaCreacion)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={pdfEnCursoId === d.id || anulandoId === d.id}
                                    className="h-8 w-8 cursor-pointer"
                                    aria-label={`Acciones del recibo ${d.numeroRecibo}`}
                                  >
                                    {pdfEnCursoId === d.id || anulandoId === d.id ? (
                                      <Spinner className="h-4 w-4" />
                                    ) : (
                                      <MoreVertical className="h-4 w-4" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => verPdf(d)}
                                    className="cursor-pointer"
                                  >
                                    <FileText className="mr-2 h-4 w-4 text-primary" />
                                    Ver recibo en PDF
                                  </DropdownMenuItem>

                                  {/* Anular exige Donaciones/Anular y que la
                                      caja de origen siga abierta. */}
                                  {puedeAnular && !d.anulado && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setAAnular(d)}
                                        className="text-destructive focus:text-destructive cursor-pointer"
                                      >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Anular recibo
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista móvil */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {donaciones.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                      No hay recibos que coincidan con la búsqueda.
                    </div>
                  ) : (
                    donaciones.map((d) => (
                      <div
                        key={d.id}
                        className={cn(
                          "p-4 rounded-xl border space-y-3 shadow-sm",
                          d.anulado
                            ? "border-destructive/40 bg-destructive/[0.06] border-l-4 border-l-destructive"
                            : "border-border/60 bg-card/60",
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {d.numeroRecibo}
                          </span>
                          {d.anulado && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-destructive/40 text-destructive"
                            >
                              Anulado
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">
                              {d.nombreDonante || "Donante anónimo"}
                            </h4>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {formatearFechaHora(d.fechaCreacion)}
                            </p>
                          </div>
                          <p className="font-extrabold text-base text-foreground shrink-0">
                            {moneda(d.monto)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verPdf(d)}
                            disabled={pdfEnCursoId === d.id}
                            className="flex-1 gap-1.5 h-9 text-xs cursor-pointer"
                          >
                            {pdfEnCursoId === d.id ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </Button>
                          {puedeAnular && !d.anulado && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAAnular(d)}
                              disabled={anulandoId === d.id}
                              className="flex-1 gap-1.5 h-9 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Anular
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {total > LIMITE && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Página {pagina} de {totalPaginas} · {total} recibos
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
      )}

      <AlertDialog
        open={aAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto && anulandoId === null) {
            setAAnular(null);
            setMotivoAnulacion("");
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              El recibo <strong>{aAnular?.numeroRecibo}</strong> por{" "}
              <strong>{moneda(aAnular?.monto)}</strong> dejará de contar en el arqueo. Solo es
              posible mientras la caja donde se registró siga abierta.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-anulacion" className="text-xs">
              Motivo (opcional)
            </Label>
            <Input
              id="motivo-anulacion"
              placeholder="Ej. Error de captura"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Queda guardado en el recibo y en la bitácora.
            </p>
          </div>

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
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
