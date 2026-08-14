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
import { api } from "@/lib/api";
import {
  type CatalogosTickets,
  type TicketBackend,
  type MetricasTickets,
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

export function HistorialTicketsEmitidos({ catalogos, refrescarToken }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtroAtraccion, setFiltroAtraccion] = useState<string>(TODOS);
  const [filtroPago, setFiltroPago] = useState<string>(TODOS);
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
  }, [busquedaAplicada, filtroAtraccion, filtroPago, pagina]);

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

  const pagoDe = (t: TicketBackend) => {
    const idOpcion = t.ticketPagos?.[0]?.idOpcionPago;
    return idOpcion ? nombreOpcionPago.get(idOpcion) : undefined;
  };

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No se encontraron tickets emitidos que coincidan con la búsqueda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map((t) => {
                        const pago = pagoDe(t);
                        return (
                          <TableRow key={t.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {t.numeroTicket}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {t.nombre || t.nombreGuia || "—"}
                              {t.tipoTicket === "GUIA" && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] border-amber-500/40 text-amber-600 bg-amber-500/10"
                                >
                                  Guía
                                </Badge>
                              )}
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
                            </TableCell>
                            <TableCell className="text-xs">
                              {t.nombreGuia && t.tipoTicket !== "GUIA" ? (
                                <span className="font-semibold text-foreground flex items-center gap-1">
                                  <Compass className="h-3 w-3 text-primary" />
                                  {t.nombreGuia}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatearFecha(t.fechaCreacion)}</span>
                              </div>
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
                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                    No se encontraron tickets emitidos que coincidan con la búsqueda.
                  </div>
                ) : (
                  tickets.map((t) => {
                    const pago = pagoDe(t);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {t.numeroTicket}
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
                            <h4 className="font-semibold text-sm text-foreground">
                              {t.nombre || t.nombreGuia || "—"}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t.origen?.nombre || "—"} ·{" "}
                              <span className="font-bold text-foreground">
                                {t.cantidadPersonas} Pax
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
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
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                          <div>
                            {t.nombreGuia ? (
                              <div className="flex items-center gap-1 text-foreground font-medium">
                                <Compass className="h-3.5 w-3.5 text-primary" />
                                <span>{t.nombreGuia}</span>
                              </div>
                            ) : (
                              <span className="italic">Sin Guía</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatearFecha(t.fechaCreacion)}</span>
                          </div>
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
    </div>
  );
}
