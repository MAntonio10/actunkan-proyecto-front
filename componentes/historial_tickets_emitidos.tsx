"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Search,
  Ticket,
  Users,
  Compass,
  Banknote,
  CreditCard,
  Mountain,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Ban,
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Send,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { api } from "@/lib/api";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { usePdfTicket } from "@/hooks/use_pdf_ticket";
import {
  extraerCheckoutUrl,
  esPagoPendiente,
  esPagoPagado,
  esPagoCancelado,
} from "@/lib/utils_pagos";
import {
  type CatalogosTickets,
  type TicketBackend,
  type MetricasTickets,
  type RespuestaPagoTicket,
} from "@/tipos";

const LIMITE_POR_PAGINA = 50;
const TODOS = "todos";

interface Props {
  catalogos: CatalogosTickets | null;
  /** Cambia cuando se emite un ticket, para recargar el historial. */
  refrescarToken?: number;
}

function formatearFecha(valor?: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toISOString().split("T")[0];
}

function formatearFechaHora(valor?: string | null): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
}

/** Fila etiqueta/valor del detalle compacto. */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground shrink-0">{etiqueta}</dt>
      <dd className="text-right text-foreground font-medium">{children}</dd>
    </div>
  );
}

/** Menú de acciones por fila en la vista de escritorio. */
function AccionesTicket({
  ticket,
  puedeAnular,
  anulando,
  onVer,
  onPdf,
  onAnular,
}: {
  ticket: TicketBackend;
  puedeAnular: boolean;
  anulando: boolean;
  onVer: (t: TicketBackend) => void;
  onPdf: (t: TicketBackend) => void;
  onAnular: (t: TicketBackend) => void;
}) {
  const url = extraerCheckoutUrl(ticket);
  const esPendiente = esPagoPendiente(ticket.estadoPago);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-pointer"
          disabled={anulando}
          aria-label={`Acciones del ticket ${ticket.numeroTicket}`}
        >
          {anulando ? <Spinner className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onVer(ticket)} className="cursor-pointer">
          <Eye className="mr-2 h-4 w-4 text-blue-500" />
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPdf(ticket)} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4 text-primary" />
          Ver PDF del pase
        </DropdownMenuItem>

        {(url || esPendiente) && (
          <>
            <DropdownMenuSeparator />
            {url ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast.success("Enlace de pago copiado al portapapeles");
                  }}
                  className="cursor-pointer"
                >
                  <Copy className="mr-2 h-4 w-4 text-amber-500" />
                  Copiar link de pago
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola, aquí tienes tu enlace de pago para las entradas del Parque Actún Kan (${ticket.numeroTicket}): ${url}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-[#128C7E] dark:text-[#25D366]"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar por WhatsApp
                  </a>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onVer(ticket)} className="cursor-pointer text-amber-600 dark:text-amber-400">
                <CreditCard className="mr-2 h-4 w-4" />
                Gestionar link de pago
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Anular exige EmisionTickets/Anular y la caja de origen abierta */}
        {puedeAnular && !ticket.anulado && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onAnular(ticket)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Ban className="mr-2 h-4 w-4" />
              Anular ticket
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HistorialTicketsEmitidos({ catalogos, refrescarToken }: Props) {
  const { puedeAccion } = useAutenticacion();
  const puedeAnular = puedeAccion("EmisionTickets", "Anular");
  const { abrirPdf, pdfEnCursoId } = usePdfTicket();

  // Detalle / impresión / anulación
  const [ticketDetalle, setTicketDetalle] = useState<TicketBackend | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ticketAAnular, setTicketAAnular] = useState<TicketBackend | null>(null);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);
  const [infoPago, setInfoPago] = useState<RespuestaPagoTicket | null>(null);
  const [consultandoPago, setConsultandoPago] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtroAtraccion, setFiltroAtraccion] = useState<string>(TODOS);
  const [filtroPago, setFiltroPago] = useState<string>(TODOS);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);

  const [tickets, setTickets] = useState<TicketBackend[]>([]);
  const [total, setTotal] = useState(0);
  const [metricas, setMetricas] = useState<MetricasTickets | null>(null);
  const [cargando, setCargando] = useState(true);

  // El texto de búsqueda se aplica con retardo para no disparar una petición por tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarTickets = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.tickets.getTickets({
        buscar: busquedaAplicada || undefined,
        idAtraccion: filtroAtraccion !== TODOS ? Number(filtroAtraccion) : undefined,
        idOpcionPago: filtroPago !== TODOS ? Number(filtroPago) : undefined,
        incluirAnulados: filtroEstado !== "activos" && filtroEstado !== "pagados",
        pagina,
        limite: LIMITE_POR_PAGINA,
      });
      setTickets(Array.isArray(res.datos) ? res.datos : []);
      setTotal(res.total || 0);
      setMetricas(res.metricas || null);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cargar el historial";
      toast.error("Error al cargar el historial", { description: mensaje });
      setTickets([]);
      setTotal(0);
      setMetricas(null);
    } finally {
      setCargando(false);
    }
  }, [busquedaAplicada, filtroAtraccion, filtroPago, filtroEstado, pagina]);

  const ticketsFiltrados = useMemo(() => {
    if (filtroEstado === "activos") {
      return tickets.filter((t) => !t.anulado && !esPagoCancelado(t.estadoPago));
    }
    if (filtroEstado === "anulados") {
      return tickets.filter((t) => t.anulado === true || esPagoCancelado(t.estadoPago));
    }
    if (filtroEstado === "pendientes") {
      return tickets.filter((t) => esPagoPendiente(t.estadoPago) && !t.anulado);
    }
    if (filtroEstado === "pagados") {
      return tickets.filter((t) => (esPagoPagado(t.estadoPago) || !t.estadoPago) && !t.anulado);
    }
    return tickets;
  }, [tickets, filtroEstado]);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets, refrescarToken]);

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_POR_PAGINA));

  const nombreOpcionPago = useMemo(() => {
    const mapa = new Map<number, { nombre: string; esEfectivo: boolean }>();
    catalogos?.opcionesPago.forEach((o) =>
      mapa.set(o.id, { nombre: o.nombre, esEfectivo: o.esEfectivo }),
    );
    return mapa;
  }, [catalogos]);

  const nombreTipoVisitante = useMemo(() => {
    const mapa = new Map<number, string>();
    catalogos?.tiposVisitante.forEach((t) => mapa.set(t.id, t.nombre));
    return mapa;
  }, [catalogos]);

  const pagoDe = (t: TicketBackend) => {
    const idOpcion = t.ticketPagos?.[0]?.idOpcionPago;
    return idOpcion ? nombreOpcionPago.get(idOpcion) : undefined;
  };

  const consultarEstadoPago = useCallback(
    async (idTicket: number) => {
      setConsultandoPago(true);
      try {
        const [resPago, resTicket] = await Promise.allSettled([
          api.pagos.getPorTicket(idTicket),
          api.tickets.getTicketById(idTicket),
        ]);

        const info = resPago.status === "fulfilled" ? resPago.value : null;
        const ticketActualizado = resTicket.status === "fulfilled" ? resTicket.value : null;

        if (info) setInfoPago(info);

        const pagado =
          (info && (
            esPagoPagado(info.estado) ||
            esPagoPagado(info.estadoPago) ||
            esPagoPagado((info as Record<string, unknown>).status) ||
            (info as Record<string, unknown>).pagado === true ||
            (info as Record<string, unknown>).paid === true
          )) ||
          (ticketActualizado && esPagoPagado(ticketActualizado.estadoPago));

        if (pagado) {
          toast.success("Pago confirmado como PAGADO en pasarela");
          if (ticketActualizado) {
            setTicketDetalle({ ...ticketActualizado, estadoPago: "PAGADO" });
          } else {
            setTicketDetalle((prev) => (prev ? { ...prev, estadoPago: "PAGADO" } : null));
          }
          await cargarTickets();
        } else {
          if (ticketActualizado) setTicketDetalle(ticketActualizado);
          const estadoNombre =
            info?.estado ||
            info?.estadoPago ||
            (info as Record<string, unknown>)?.status ||
            ticketActualizado?.estadoPago ||
            "Pago pendiente";

          toast.info(
            `Estado del cobro: ${estadoNombre}`,
            { description: "El visitante aún no ha completado la transacción en la pasarela." }
          );
        }
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : "No se pudo consultar el estado del cobro";
        toast.error("Error al consultar pago", { description: mensaje });
      } finally {
        setConsultandoPago(false);
      }
    },
    [cargarTickets]
  );

  // El listado no trae el `qr`: se pide el detalle para tener el pase completo
  // y poder imprimirlo con el código firmado por el servidor.
  const abrirDetalle = useCallback(async (t: TicketBackend) => {
    setTicketDetalle(t);
    setInfoPago(null);
    setCargandoDetalle(true);
    try {
      const completo = await api.tickets.getTicketById(t.id);
      setTicketDetalle(completo);
      // Si el ticket figura pendiente o no tiene checkoutUrl en caché, consultar pasarela en segundo plano
      if (esPagoPendiente(completo.estadoPago) || !extraerCheckoutUrl(completo)) {
        api.pagos.getPorTicket(t.id).then(setInfoPago).catch(() => {});
      }
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cargar el ticket";
      toast.error("Error al cargar el detalle", { description: mensaje });
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const anular = useCallback(async () => {
    if (!ticketAAnular || anulandoId !== null) return;
    setAnulandoId(ticketAAnular.id);
    try {
      await api.tickets.anular(ticketAAnular.id);
      toast.success("Ticket anulado", {
        description: `${ticketAAnular.numeroTicket} salió del arqueo de caja.`,
      });
      setTicketAAnular(null);
      await cargarTickets();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular el ticket";
      // El backend solo permite anular con la caja de origen abierta
      toast.error("No se pudo anular", { description: mensaje });
    } finally {
      setAnulandoId(null);
    }
  }, [ticketAAnular, anulandoId, cargarTickets]);

  return (
    <div className="space-y-6">
      {/* Métricas calculadas por el servidor sobre el filtro completo, no solo la página */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Tickets Emitidos
              </p>
              <p className="text-2xl font-bold text-primary">
                {metricas?.totalTickets ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Total Personas Ingresadas
              </p>
              <p className="text-2xl font-bold text-foreground">
                {metricas ? `${metricas.totalPersonas} Pax` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Monto Recaudado
              </p>
              <p className="text-2xl font-bold text-foreground">
                {metricas ? `Q${parseFloat(metricas.montoRecaudado).toFixed(2)}` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Tickets Emitidos
            </CardTitle>
            <CardDescription>
              Registro detallado de pases de acceso generados en taquilla.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ticket, visitante o guía..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-muted/40 border-border/60 h-9 text-xs"
              />
            </div>

            <Select
              value={filtroAtraccion}
              onValueChange={(v) => {
                setFiltroAtraccion(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[150px] h-9 text-xs bg-muted/40 border-border/60">
                <SelectValue placeholder="Atracción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las atracciones</SelectItem>
                {catalogos?.atracciones.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filtroPago}
              onValueChange={(v) => {
                setFiltroPago(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9 text-xs bg-muted/40 border-border/60">
                <SelectValue placeholder="Forma de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los pagos</SelectItem>
                {catalogos?.opcionesPago.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selector de filtro por estado del ticket */}
            <Select
              value={filtroEstado}
              onValueChange={(v) => {
                setFiltroEstado(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/40 border-border/60">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tickets</SelectItem>
                <SelectItem value="activos">Solo activos</SelectItem>
                <SelectItem value="anulados">Solo anulados</SelectItem>
                <SelectItem value="pendientes">Cobro pendiente</SelectItem>
                <SelectItem value="pagados">Pagados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            </div>
          ) : (
            <>
              {/* Vista Escritorio */}
              <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[150px]">No. Ticket</TableHead>
                      <TableHead>Visitante / Grupo</TableHead>
                      <TableHead>Atracción</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="text-center">Personas</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Forma de Pago</TableHead>
                      <TableHead>Guía</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="w-[60px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketsFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No se encontraron tickets que coincidan con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ticketsFiltrados.map((t) => {
                        const pago = pagoDe(t);
                        const esAnulado = t.anulado === true || esPagoCancelado(t.estadoPago);
                        return (
                          <TableRow
                            key={t.id}
                            className={cn(
                              esAnulado && "opacity-65 bg-destructive/[0.04] hover:bg-destructive/[0.08]",
                              t.tipoTicket === "GUIA" && !esAnulado && "bg-amber-500/[0.07] hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500",
                              !esAnulado && t.tipoTicket !== "GUIA" && "hover:bg-muted/20 border-l-4 border-l-transparent"
                            )}
                          >
                            <TableCell className="font-mono text-xs font-semibold">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={cn(esAnulado ? "line-through text-muted-foreground" : "text-primary")}>
                                  {t.numeroTicket}
                                </span>
                                {esAnulado && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 border-destructive/50 text-destructive bg-destructive/10 font-bold"
                                  >
                                    ANULADO
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {t.tipoTicket === "GUIA" && (
                                  <Compass className="h-4 w-4 text-amber-500 shrink-0" />
                                )}
                                <span>{t.nombre || t.guia?.nombre || "—"}</span>
                                {t.tipoTicket === "GUIA" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-bold border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                                  >
                                    GUÍA
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.atraccion && (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] gap-1 font-semibold ${
                                    t.atraccion.codigo === "mariposario"
                                      ? "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                                      : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                                  }`}
                                >
                                  {t.atraccion.codigo === "mariposario" ? (
                                    <BookOpen className="h-3 w-3" />
                                  ) : (
                                    <Mountain className="h-3 w-3" />
                                  )}
                                  {t.atraccion.nombre}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">
                              {t.origen?.nombre || "—"}
                              {t.pais ? ` · ${t.pais.nombre}` : ""}
                            </TableCell>
                            <TableCell className="text-center font-bold text-foreground text-xs">
                              {t.cantidadPersonas} Pax
                            </TableCell>
                            <TableCell className="text-right font-bold text-foreground">
                              Q{parseFloat(t.montoTotal).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                {pago && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[11px] gap-1 font-semibold ${
                                      pago.esEfectivo
                                        ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                        : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                                    }`}
                                  >
                                    {pago.esEfectivo ? (
                                      <Banknote className="h-3 w-3" />
                                    ) : (
                                      <CreditCard className="h-3 w-3" />
                                    )}
                                    {pago.nombre}
                                  </Badge>
                                )}
                                {t.anulado === true || esPagoCancelado(t.estadoPago) ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 font-semibold border-destructive/40 text-destructive bg-destructive/10"
                                  >
                                    <Ban className="h-2.5 w-2.5" />
                                    ANULADO
                                  </Badge>
                                ) : esPagoPendiente(t.estadoPago) ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 font-bold border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    PENDIENTE
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] gap-1 font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                                  >
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    PAGADO
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {/* El objeto `guia` viene poblado tanto en el
                                  ticket del visitante como en el del guía. */}
                              {t.guia ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground flex items-center gap-1">
                                    <Compass className="h-3 w-3 text-primary shrink-0" />
                                    {t.guia.nombre}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {t.guia.tieneCarnet ? "Acreditado" : "Sin carnet"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Sin guía</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatearFecha(t.fechaCreacion)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <AccionesTicket
                                ticket={t}
                                puedeAnular={puedeAnular}
                                anulando={anulandoId === t.id}
                                onVer={abrirDetalle}
                                onPdf={abrirPdf}
                                onAnular={setTicketAAnular}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Móvil */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {ticketsFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                    No se encontraron tickets que coincidan con los filtros aplicados.
                  </div>
                ) : (
                  ticketsFiltrados.map((t) => {
                    const pago = pagoDe(t);
                    const esAnulado = t.anulado === true || esPagoCancelado(t.estadoPago);
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "p-4 rounded-xl border space-y-3 shadow-sm",
                          esAnulado && "opacity-70 bg-destructive/[0.04] border-destructive/30",
                          t.tipoTicket === "GUIA" && !esAnulado && "border-amber-500/40 bg-amber-500/[0.07] border-l-4 border-l-amber-500",
                          !esAnulado && t.tipoTicket !== "GUIA" && "border-border/60 bg-card/60"
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                            {t.tipoTicket === "GUIA" && (
                              <Compass className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span className={cn(esAnulado ? "line-through text-muted-foreground" : "text-primary")}>
                              {t.numeroTicket}
                            </span>
                            {esAnulado && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 border-destructive/50 text-destructive bg-destructive/10 font-bold"
                              >
                                ANULADO
                              </Badge>
                            )}
                          </span>
                          {t.atraccion && (
                            <Badge
                              variant="outline"
                              className={`text-[11px] gap-1 font-semibold ${
                                t.atraccion.codigo === "mariposario"
                                  ? "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                                  : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              }`}
                            >
                              {t.atraccion.codigo === "mariposario" ? (
                                <BookOpen className="h-3 w-3" />
                              ) : (
                                <Mountain className="h-3 w-3" />
                              )}
                              {t.atraccion.nombre}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2 flex-wrap">
                              <span>{t.nombre || t.guia?.nombre || "—"}</span>
                              {t.tipoTicket === "GUIA" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                                >
                                  GUÍA
                                </Badge>
                              )}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t.origen?.nombre || "—"} ·{" "}
                              <span className="font-bold text-foreground">
                                {t.cantidadPersonas} Pax
                              </span>
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="font-extrabold text-base text-foreground">
                              Q{parseFloat(t.montoTotal).toFixed(2)}
                            </p>
                            {pago && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] gap-1 font-semibold mt-1 ${
                                  pago.esEfectivo
                                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                    : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                                }`}
                              >
                                {pago.esEfectivo ? (
                                  <Banknote className="h-3 w-3" />
                                ) : (
                                  <CreditCard className="h-3 w-3" />
                                )}
                                {pago.nombre}
                              </Badge>
                            )}
                            {esPagoPendiente(t.estadoPago) ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 font-bold border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15 mt-1"
                              >
                                <Clock className="h-2.5 w-2.5" />
                                PENDIENTE
                              </Badge>
                            ) : esPagoCancelado(t.estadoPago) || t.anulado ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 font-semibold border-destructive/40 text-destructive bg-destructive/10 mt-1"
                              >
                                <Ban className="h-2.5 w-2.5" />
                                CANCELADO
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                          <div>
                            {t.guia ? (
                              <div className="flex items-center gap-1 text-foreground font-medium">
                                <Compass className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>{t.guia.nombre}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({t.guia.tieneCarnet ? "acreditado" : "sin carnet"})
                                </span>
                              </div>
                            ) : (
                              <span className="italic">Sin guía</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatearFecha(t.fechaCreacion)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirDetalle(t)}
                            className="flex-1 gap-1.5 h-9 text-xs cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirPdf(t)}
                            className="flex-1 gap-1.5 h-9 text-xs cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          {puedeAnular && !t.anulado && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTicketAAnular(t)}
                              disabled={anulandoId === t.id}
                              className="flex-1 gap-1.5 h-9 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              {anulandoId === t.id ? (
                                <Spinner className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                              Anular
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Paginación */}
              {total > LIMITE_POR_PAGINA && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {pagina} de {totalPaginas} · {total} tickets
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

      {/* Detalle del ticket: reutiliza el mismo pase que se ve al emitir, con
          servidor genera el PDF del pase aparte. */}
      <Dialog
        open={ticketDetalle !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setTicketDetalle(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {ticketDetalle?.tipoTicket === "GUIA" ? (
                <Compass className="h-4 w-4 text-amber-500" />
              ) : (
                <Ticket className="h-4 w-4 text-primary" />
              )}
              <span className="font-mono">{ticketDetalle?.numeroTicket}</span>
            </DialogTitle>
            <DialogDescription>
              {ticketDetalle?.tipoTicket === "GUIA"
                ? "Ticket independiente de guía sin carnet"
                : "Ticket de visitante"}
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando ticket...</p>
            </div>
          ) : (
            ticketDetalle && (
              <div className="space-y-4">
                {ticketDetalle.anulado && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive">
                    <Ban className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">
                      Ticket anulado: no permite el ingreso.
                    </span>
                  </div>
                )}

                <dl className="divide-y divide-border/50 rounded-lg border border-border/60 text-sm">
                  <Dato etiqueta="Titular">
                    {ticketDetalle.nombre || ticketDetalle.guia?.nombre || "—"}
                  </Dato>
                  <Dato etiqueta="Atracción">{ticketDetalle.atraccion?.nombre || "—"}</Dato>
                  <Dato etiqueta="Origen">
                    {ticketDetalle.origen?.nombre || "—"}
                    {ticketDetalle.pais ? ` · ${ticketDetalle.pais.nombre}` : ""}
                  </Dato>
                  <Dato etiqueta="Recorrido">
                    {ticketDetalle.tipoRecorrido?.nombre || "—"}
                  </Dato>
                  <Dato etiqueta="Personas">{ticketDetalle.cantidadPersonas} Pax</Dato>
                  <Dato etiqueta="Guía">
                    {ticketDetalle.guia ? (
                      <>
                        {ticketDetalle.guia.nombre}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({ticketDetalle.guia.tieneCarnet ? "acreditado" : "sin carnet"})
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin guía</span>
                    )}
                  </Dato>
                  {ticketDetalle.idGrupoEmision && (
                    <Dato etiqueta="Grupo de emisión">
                      <span className="font-mono">#{ticketDetalle.idGrupoEmision}</span>
                    </Dato>
                  )}
                  {ticketDetalle.usuario && (
                    <Dato etiqueta="Emitido por">{ticketDetalle.usuario.nombre}</Dato>
                  )}
                  <Dato etiqueta="Emitido">
                    {formatearFechaHora(ticketDetalle.fechaCreacion)}
                  </Dato>
                  <Dato etiqueta="Uso">
                    {ticketDetalle.fechaUso ? (
                      formatearFechaHora(ticketDetalle.fechaUso)
                    ) : (
                      <span className="text-muted-foreground">Sin usar</span>
                    )}
                  </Dato>
                  <Dato etiqueta="Estado del Cobro">
                    {esPagoPendiente(ticketDetalle.estadoPago) ? (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 font-bold border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
                      >
                        <Clock className="h-3 w-3" />
                        PAGO PENDIENTE
                      </Badge>
                    ) : esPagoCancelado(ticketDetalle.estadoPago) || ticketDetalle.anulado ? (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 font-semibold border-destructive/40 text-destructive bg-destructive/10"
                      >
                        <Ban className="h-3 w-3" />
                        CANCELADO
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        PAGADO
                      </Badge>
                    )}
                  </Dato>
                  <Dato etiqueta="Total">
                    <span className="font-bold tabular-nums">
                      Q{parseFloat(ticketDetalle.montoTotal).toFixed(2)}
                    </span>
                  </Dato>
                </dl>

                {/* Alerta de pago pendiente y gestión del checkout */}
                {esPagoPendiente(ticketDetalle.estadoPago) && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Cobro Pendiente con Tarjeta</span>
                      </div>
                      <p className="leading-relaxed text-[11px]">
                        El visitante aún no ha completado el pago en la pasarela. Este ticket no autoriza el ingreso en puerta.
                      </p>
                      <div className="p-2 bg-amber-500/15 rounded-lg border border-amber-500/30 text-[11px] font-medium text-amber-950 dark:text-amber-100">
                        💡 <strong>Recomendación:</strong> Si el cliente nunca paga, anula este ticket para liberar el correlativo y no afectar el arqueo de caja.
                      </div>
                    </div>

                    {/* Link de checkout si está disponible */}
                    {(() => {
                      const urlCheckout =
                        extraerCheckoutUrl(ticketDetalle) ||
                        extraerCheckoutUrl(infoPago);

                      if (!urlCheckout) {
                        return (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => consultarEstadoPago(ticketDetalle.id)}
                            disabled={consultandoPago}
                            className="w-full text-xs font-semibold gap-1.5 cursor-pointer"
                          >
                            {consultandoPago ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Consultar estado en pasarela
                          </Button>
                        )
                      }

                      return (
                        <div className="rounded-xl border border-border/70 p-3 bg-muted/20 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Enlace de Pago para el Visitante
                          </span>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              value={urlCheckout}
                              className="font-mono text-xs h-8 bg-background/80"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(urlCheckout)
                                toast.success("Enlace de pago copiado al portapapeles")
                              }}
                              className="h-8 px-2.5 text-xs font-semibold cursor-pointer shrink-0"
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 text-[11px] font-medium gap-1 text-[#128C7E] dark:text-[#25D366] cursor-pointer"
                            >
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  `Hola, aquí tienes tu enlace de pago para las entradas del Parque Actún Kan (${ticketDetalle.numeroTicket}): ${urlCheckout}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Send className="h-3 w-3" />
                                WhatsApp
                              </a>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 text-[11px] font-medium gap-1 cursor-pointer"
                            >
                              <a
                                href={urlCheckout}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Abrir enlace
                              </a>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => consultarEstadoPago(ticketDetalle.id)}
                              disabled={consultandoPago}
                              className="h-7 text-[11px] font-medium gap-1 cursor-pointer ml-auto"
                            >
                              {consultandoPago ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                              Consultar estado
                            </Button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Desglose por categoría, solo si el backend lo trae */}
                {ticketDetalle.visitantePorTickets &&
                  ticketDetalle.visitantePorTickets.length > 0 && (
                    <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Desglose
                      </p>
                      {ticketDetalle.visitantePorTickets.map((v) => (
                        <div
                          key={v.idTipoVisitante}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <span>
                            {nombreTipoVisitante.get(v.idTipoVisitante) ||
                              `Tipo ${v.idTipoVisitante}`}{" "}
                            · {v.cantidad} × Q{parseFloat(v.precioUnitario).toFixed(2)}
                          </span>
                          <span className="text-foreground font-medium tabular-nums">
                            Q{parseFloat(v.subtotal).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                <Button
                  onClick={() => abrirPdf(ticketDetalle)}
                  disabled={pdfEnCursoId === ticketDetalle.id}
                  className="w-full gap-2 cursor-pointer"
                >
                  {pdfEnCursoId === ticketDetalle.id ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Ver PDF del pase
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación de anulación */}
      <AlertDialog
        open={ticketAAnular !== null}
        onOpenChange={(abierto) => {
          if (!abierto && anulandoId === null) setTicketAAnular(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Se dará de baja el ticket <strong>{ticketAAnular?.numeroTicket}</strong> y sus pagos,
              para que el ingreso salga del arqueo de caja. Solo es posible mientras la caja donde
              se emitió siga abierta. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulandoId !== null} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Se evita el cierre automático para poder mostrar el error si falla
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
