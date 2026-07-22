"use client";

import { useState, useMemo } from "react";
import {
  History,
  Search,
  Ticket,
  Users,
  Compass,
  Banknote,
  CreditCard,
  Mountain,
  Flower2,
  Calendar,
} from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { type TicketEmitido, type AtraccionVisitante, type MetodoPago } from "@/tipos";

interface Props {
  tickets: TicketEmitido[];
}

export function HistorialTicketsEmitidos({ tickets }: Props) {
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroAtraccion, setFiltroAtraccion] = useState<string>("todas");
  const [filtroPago, setFiltroPago] = useState<string>("todos");

  // Métricas financieras y de aforo
  const metricas = useMemo(() => {
    const totalTickets = tickets.length;
    const totalPersonas = tickets.reduce((acc, t) => acc + t.cantidad_personas, 0);
    const totalRecaudado = tickets.reduce(
      (acc, t) => acc + t.monto_total + (t.monto_guia || 0),
      0
    );
    return { totalTickets, totalPersonas, totalRecaudado };
  }, [tickets]);

  // Filtro de lista
  const ticketsFiltrados = useMemo(() => {
    return tickets.filter((t) => {
      // Filtro texto
      const q = busqueda.toLowerCase().trim();
      const coincideTexto =
        !q ||
        t.nombre_visitante.toLowerCase().includes(q) ||
        t.numero_ticket.toLowerCase().includes(q) ||
        (t.nombre_guia && t.nombre_guia.toLowerCase().includes(q));

      // Filtro Atracción
      const coincideAtraccion =
        filtroAtraccion === "todas" || t.atraccion === filtroAtraccion;

      // Filtro Pago
      const coincidePago =
        filtroPago === "todos" || t.metodo_pago === filtroPago;

      return coincideTexto && coincideAtraccion && coincidePago;
    });
  }, [tickets, busqueda, filtroAtraccion, filtroPago]);

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas de Emisión */}
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
                {metricas.totalTickets}
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
                {metricas.totalPersonas} Pax
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
                Monto Recaudado en Boleta
              </p>
              <p className="text-2xl font-bold text-foreground">
                Q{metricas.totalRecaudado.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla del Historial de Tickets */}
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

          {/* Filtros de búsqueda */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Buscador por texto */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ticket o visitante..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-muted/40 border-border/60 h-9 text-xs"
              />
            </div>

            {/* Filtro por Atracción */}
            <Select value={filtroAtraccion} onValueChange={setFiltroAtraccion}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-muted/40 border-border/60">
                <SelectValue placeholder="Atracción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las atracciones</SelectItem>
                <SelectItem value="cuevas">Cuevas</SelectItem>
                <SelectItem value="mariposario">Mariposario</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por Pago */}
            <Select value={filtroPago} onValueChange={setFiltroPago}>
              <SelectTrigger className="w-[120px] h-9 text-xs bg-muted/40 border-border/60">
                <SelectValue placeholder="Forma de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los pagos</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {/* Vista Escritorio (Tabla) */}
          <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[130px]">No. Ticket</TableHead>
                  <TableHead>Visitante / Grupo</TableHead>
                  <TableHead>Atracción</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-center">Personas</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead>Forma de Pago</TableHead>
                  <TableHead>Guía Acompañante</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron tickets emitidos que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  ticketsFiltrados.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {t.numero_ticket}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {t.nombre_visitante}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[11px] gap-1 font-semibold ${
                            t.atraccion === "cuevas"
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                          }`}
                        >
                          {t.atraccion === "cuevas" ? (
                            <>
                              <Mountain className="h-3 w-3" />
                              Cuevas
                            </>
                          ) : (
                            <>
                              <Flower2 className="h-3 w-3" />
                              Mariposario
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-xs text-muted-foreground font-medium">
                        {t.origen}
                      </TableCell>
                      <TableCell className="text-center font-bold text-foreground text-xs">
                        {t.cantidad_personas} Pax
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        Q{(t.monto_total + (t.monto_guia || 0)).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[11px] gap-1 font-semibold ${
                            t.metodo_pago === "efectivo"
                              ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                              : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                          }`}
                        >
                          {t.metodo_pago === "efectivo" ? (
                            <>
                              <Banknote className="h-3 w-3" />
                              Efectivo
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3 w-3" />
                              Tarjeta
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.nombre_guia ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <Compass className="h-3 w-3 text-primary" />
                              {t.nombre_guia}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.tiene_carnet_guia ? "Acreditado" : `Ticket Guía Q${t.monto_guia?.toFixed(2)}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Sin Guía</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{t.fecha.toISOString().split("T")[0]}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Vista Móvil (Tarjetas) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {ticketsFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                No se encontraron tickets emitidos que coincidan con la búsqueda.
              </div>
            ) : (
              ticketsFiltrados.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {t.numero_ticket}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] gap-1 font-semibold ${
                        t.atraccion === "cuevas"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                      }`}
                    >
                      {t.atraccion === "cuevas" ? (
                        <>
                          <Mountain className="h-3 w-3" />
                          Cuevas
                        </>
                      ) : (
                        <>
                          <Flower2 className="h-3 w-3" />
                          Mariposario
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">{t.nombre_visitante}</h4>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {t.origen} · <span className="font-bold text-foreground">{t.cantidad_personas} Pax</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-base text-foreground">
                        Q{(t.monto_total + (t.monto_guia || 0)).toFixed(2)}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 font-semibold mt-1 ${
                          t.metodo_pago === "efectivo"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                        }`}
                      >
                        {t.metodo_pago === "efectivo" ? (
                          <>
                            <Banknote className="h-3 w-3" />
                            Efectivo
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3 w-3" />
                            Tarjeta
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                    <div>
                      {t.nombre_guia ? (
                        <div className="flex items-center gap-1 text-foreground font-medium">
                          <Compass className="h-3.5 w-3.5 text-primary" />
                          <span>{t.nombre_guia}</span>
                          <span className="text-[10px] text-muted-foreground">({t.tiene_carnet_guia ? "Acreditado" : `Q${t.monto_guia?.toFixed(2)}`})</span>
                        </div>
                      ) : (
                        <span className="italic">Sin Guía</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{t.fecha.toISOString().split("T")[0]}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
