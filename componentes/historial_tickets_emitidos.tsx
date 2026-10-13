"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  CloudOff,
  TriangleAlert,
  PauseCircle,
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
import { api, esErrorDeRed } from "@/lib/api";
import { Paginador } from "@/componentes/paginador";
import { TarjetaEstadistica } from '@/componentes/tarjeta_estadistica';
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { usePdfTicket } from "@/hooks/use_pdf_ticket";
import {
  extraerCheckoutUrl,
  esPagoPendiente,
  esPagoPagado,
  esPagoCancelado,
} from "@/lib/utils_pagos";
import { ticketsPendientesDeSubir } from "@/lib/emision_offline";
import { suscribirSincronizacion } from "@/lib/sincronizador_tickets";
import {
  type CatalogosTickets,
  type TicketBackend,
  type TicketLocalNoSincronizado,
  type MetricasTickets,
  type RespuestaPagoTicket,
} from "@/tipos";
import { diaDeFechaApi, fechaIsoEnGuatemala, formatearFechaApi, formatearInstante } from "@/lib/fecha_guatemala";

const LIMITE_POR_PAGINA = 20;
const TODOS = "todos";

/** Un ticket local no existe en el backend: no tiene PDF ni se puede anular. */
function esLocal(t: TicketBackend): t is TicketLocalNoSincronizado {
  return "estadoSincronizacion" in t;
}

/** Distintivo de fila local. Se repite en escritorio, móvil y detalle: el
 *  taquillero tiene que poder distinguirlo mire donde mire. */
function BadgeLocal({ ticket }: { ticket: TicketLocalNoSincronizado }) {
  const variante = ticket.estadoSincronizacion === "anulada"
    ? {
        etiqueta: "ANULADA",
        clase: "border-destructive/50 text-destructive bg-destructive/10",
        icono: Ban,
      }
    : ticket.estadoSincronizacion === "rechazada"
      ? {
          etiqueta: "RECHAZADA",
          clase: "border-destructive/50 text-destructive bg-destructive/10",
          icono: TriangleAlert,
        }
      : ticket.estadoSincronizacion === "retenida"
        ? {
            etiqueta: "RETENIDA",
            clase: "border-slate-500/50 text-slate-600 dark:text-slate-300 bg-slate-500/10",
            icono: PauseCircle,
          }
        : {
            etiqueta: "SIN SUBIR",
            clase: "border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15",
            icono: CloudOff,
          };

  const Icono = variante.icono;
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-bold gap-1", variante.clase)}>
      <Icono className="h-2.5 w-2.5" />
      {variante.etiqueta}
    </Badge>
  );
}

interface Props {
  catalogos: CatalogosTickets | null;
  /** Cambia cuando se emite un ticket, para recargar el historial. */
  refrescarToken?: number;
}

/**
 * Acá se cruzan las dos convenciones de fecha del sistema, y se leen al revés.
 *
 * Una fila de la API trae la hora de pared de Guatemala con una `Z` que miente,
 * así que se lee **sin** convertir de zona. Una fila local la escribió Dexie con
 * `new Date()`, que sí es un instante real, y esa se convierte a la zona del
 * parque. Tratarlas igual deja la mitad de la tabla corrida seis horas — y son
 * justamente las filas locales las que el taquillero contrasta contra su propia
 * memoria de la venta. Ver `lib/fecha_guatemala.ts`.
 */
function formatearFecha(valor: string | undefined, local: boolean): string {
  if (!valor) return "—";
  if (!local) return diaDeFechaApi(valor);
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? "—" : fechaIsoEnGuatemala(fecha);
}

function formatearFechaHora(valor: string | null | undefined, local: boolean): string {
  return local ? formatearInstante(valor) : formatearFechaApi(valor);
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
  // El PDF lo arma el backend y la anulación exige que el ticket exista allá:
  // ninguna de las dos aplica a una venta que todavía no subió.
  const local = esLocal(ticket);

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
        {!local && (
          <DropdownMenuItem onClick={() => onPdf(ticket)} className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4 text-primary" />
            Ver PDF del pase
          </DropdownMenuItem>
        )}

        {!local && (url || esPendiente) && (
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
        {!local && puedeAnular && !ticket.anulado && (
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

  const [ticketsServidor, setTicketsServidor] = useState<TicketBackend[]>([]);
  const [ticketsLocales, setTicketsLocales] = useState<TicketLocalNoSincronizado[]>([]);
  const [total, setTotal] = useState(0);
  const [metricas, setMetricas] = useState<MetricasTickets | null>(null);
  const [cargando, setCargando] = useState(true);
  /** El listado del backend no se pudo traer; se muestra solo lo local. */
  const [servidorInalcanzable, setServidorInalcanzable] = useState(false);

  // El texto de búsqueda se aplica con retardo para no disparar una petición por tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Las respuestas se descartan si ya salió otra petición después. La búsqueda
  // sale con retardo y una lenta puede llegar tarde: sin este guardia, escribir
  // rápido deja en pantalla el resultado de un término anterior.
  const peticionVigente = useRef(0);

  const cargarTickets = useCallback(async () => {
    const idPeticion = ++peticionVigente.current;
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
      if (idPeticion !== peticionVigente.current) return;
      setTicketsServidor(Array.isArray(res?.datos) ? res.datos : []);
      setTotal(res?.total || 0);
      setMetricas(res?.metricas || null);
      setServidorInalcanzable(false);
    } catch (err: unknown) {
      if (idPeticion !== peticionVigente.current) return;
      // Sin red no es un error del historial: las ventas locales siguen ahí y
      // son justamente lo que el taquillero necesita consultar en ese momento.
      if (esErrorDeRed(err)) {
        setServidorInalcanzable(true);
      } else {
        const mensaje = err instanceof Error ? err.message : "No se pudo cargar el historial";
        toast.error("Error al cargar el historial", { description: mensaje });
        setServidorInalcanzable(false);
      }
      setTicketsServidor([]);
      setTotal(0);
      setMetricas(null);
    } finally {
      if (idPeticion === peticionVigente.current) setCargando(false);
    }
  }, [busquedaAplicada, filtroAtraccion, filtroPago, filtroEstado, pagina]);

  const cargarLocales = useCallback(async () => {
    try {
      setTicketsLocales(await ticketsPendientesDeSubir());
    } catch {
      setTicketsLocales([]);
    }
  }, []);

  // Depende de `refrescarToken` igual que el listado del servidor: la pestaña
  // no se desmonta al cambiar, así que sin esto una venta recién emitida no
  // aparecía hasta que alguien pulsara Actualizar.
  //
  // Además se suscribe a la cola: al subir una venta, su fila local tiene que
  // desaparecer en el mismo momento en que el backend la devuelve, o quedaría
  // duplicada en pantalla.
  useEffect(() => {
    cargarLocales();
    return suscribirSincronizacion(() => {
      void cargarLocales();
    });
  }, [cargarLocales, refrescarToken]);

  /**
   * Los locales se aplican solo en la primera página: la paginación la lleva el
   * servidor y estas filas no forman parte de su conteo. Van al principio
   * porque son siempre las más recientes de la jornada.
   *
   * Los filtros de texto, atracción y forma de pago se aplican acá a mano, ya
   * que estas filas nunca pasaron por la consulta del backend.
   */
  const localesVisibles = useMemo(() => {
    if (pagina !== 1) return [];

    const opcionSeleccionada =
      filtroPago !== TODOS
        ? catalogos?.opcionesPago.find((o) => o.id === Number(filtroPago))
        : undefined;
    // Sin conexión solo se cobra en efectivo: con otro filtro de pago activo,
    // ninguna venta local puede corresponder.
    if (opcionSeleccionada && !opcionSeleccionada.esEfectivo) return [];

    const texto = busquedaAplicada.trim().toLowerCase();

    return ticketsLocales.filter((t) => {
      if (filtroAtraccion !== TODOS && t.atraccion?.id !== Number(filtroAtraccion)) return false;
      if (!texto) return true;
      return (
        t.numeroTicket.toLowerCase().includes(texto) ||
        (t.nombre ?? "").toLowerCase().includes(texto) ||
        (t.guia?.nombre ?? "").toLowerCase().includes(texto)
      );
    });
  }, [ticketsLocales, pagina, busquedaAplicada, filtroAtraccion, filtroPago, catalogos]);

  const ticketsFiltrados = useMemo(() => {
    const tickets = [...localesVisibles, ...ticketsServidor];

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
  }, [localesVisibles, ticketsServidor, filtroEstado]);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets, refrescarToken]);

  /** Vuelve a pedir el listado del servidor y relee la cola local.
   *
   *  No dispara la sincronización: recargar es una consulta, y subir ventas es
   *  una acción con consecuencias sobre la caja. Para eso está "Subir ahora" en
   *  el indicador de la barra superior, que además respeta el interruptor de
   *  subida automática. */
  const recargar = useCallback(async () => {
    if (cargando) return;
    await Promise.all([cargarTickets(), cargarLocales()]);
  }, [cargando, cargarTickets, cargarLocales]);

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
    // El ticket local no trae `ticketPagos` porque el backend todavía no lo
    // creó, pero la forma de pago no es ambigua: offline solo se vende en
    // efectivo, así que se resuelve desde el catálogo.
    if (esLocal(t)) {
      const efectivo = catalogos?.opcionesPago.find((o) => o.esEfectivo);
      return { nombre: efectivo?.nombre ?? "Efectivo", esEfectivo: true };
    }
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

    // Un ticket local no existe en el backend: pedir su detalle daría 404 y su
    // `id` negativo ni siquiera es una ruta válida. Ya está completo en memoria.
    if (esLocal(t)) {
      setCargandoDetalle(false);
      return;
    }

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
      {/* Fuera de la tabla y de sus filtros: actualizar es una acción sobre toda
          la pantalla, no un control más del listado. */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={recargar}
          disabled={cargando}
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Métricas calculadas por el servidor sobre el filtro completo, no solo la página */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* El `pie` dice lo que falta subir en vez de sumarlo al número: las
            métricas las calcula el servidor y no incluyen lo pendiente, así que
            inflar la cifra la volvería imposible de cuadrar contra el backend. */}
        <TarjetaEstadistica
          className="col-span-2 md:col-span-1"
          etiqueta="Tickets emitidos"
          valor={metricas?.totalTickets ?? '—'}
          icono={Ticket}
          tono="primary"
          pie={ticketsLocales.length > 0 ? `+${ticketsLocales.length} sin sincronizar` : undefined}
        />

        {/* Tickets, personas y quetzales son unidades distintas: entre ellas no
            hay porcentaje que dibujar. La media de personas por ticket sí es un
            dato que se lee de un vistazo, y va como pie. */}
        <TarjetaEstadistica
          etiqueta="Personas ingresadas"
          valor={metricas ? `${metricas.totalPersonas} Pax` : '—'}
          icono={Users}
          tono="info"
          pie={
            metricas && metricas.totalTickets > 0
              ? `${(metricas.totalPersonas / metricas.totalTickets).toFixed(1)} por ticket`
              : undefined
          }
        />

        <TarjetaEstadistica
          etiqueta="Monto recaudado"
          valor={metricas ? `Q${parseFloat(metricas.montoRecaudado).toFixed(2)}` : '—'}
          icono={Banknote}
          tono="positivo"
          pie={
            metricas && metricas.totalTickets > 0
              ? `Q${(parseFloat(metricas.montoRecaudado) / metricas.totalTickets).toFixed(2)} por ticket`
              : undefined
          }
        />
      </div>

      <Card className="bg-card border-border/50">
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
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs bg-muted/40 border-border/60">
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
              <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs bg-muted/40 border-border/60">
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
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs bg-muted/40 border-border/60">
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
          {servidorInalcanzable && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Sin conexión con el servidor. Solo se muestra la recaudación hecha en este
                dispositivo que aún no se ha subido; el historial completo requiere internet.
              </span>
            </div>
          )}

          {localesVisibles.length > 0 && !servidorInalcanzable && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2">
              <CloudOff className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Las filas marcadas <strong>SIN SUBIR</strong> existen solo en este dispositivo: no
                tienen PDF ni se pueden anular hasta que la recaudación llegue al servidor. Las marcadas{" "}
                <strong>RECHAZADA</strong> ya se cobraron y el servidor no las aceptó; hay que
                resolverlas a mano o la caja no cuadra.
              </span>
            </div>
          )}

          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            </div>
          ) : (
            <>
              {/* Vista Escritorio */}
              <div className="hidden lg:block rounded-md border border-border/50 overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[14%]">No. Ticket</TableHead>
                      <TableHead className="w-[15%]">Visitante / Grupo</TableHead>
                      <TableHead className="hidden xl:table-cell w-[10%]">Atracción</TableHead>
                      <TableHead className="hidden 2xl:table-cell w-[10%]">Origen</TableHead>
                      <TableHead className="w-[7%] text-center">Personas</TableHead>
                      <TableHead className="w-[8%] text-right">Monto</TableHead>
                      <TableHead className="hidden 2xl:table-cell w-[11%]">Forma de Pago</TableHead>
                      <TableHead className="hidden xl:table-cell w-[10%]">Guía</TableHead>
                      <TableHead className="w-[9%]">Fecha</TableHead>
                      <TableHead className="w-[6%] text-right">Acciones</TableHead>
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
                            key={t.numeroTicket}
                            className={cn(
                              esAnulado && "opacity-65 bg-destructive/[0.04] hover:bg-destructive/[0.08]",
                              // El borde punteado a la izquierda distingue la fila
                              // local de un vistazo, sin tener que leer el badge.
                              esLocal(t) && !esAnulado && "bg-sky-500/[0.06] hover:bg-sky-500/[0.11] border-l-4 border-l-sky-500 border-dashed",
                              !esLocal(t) && t.tipoTicket === "GUIA" && !esAnulado && "bg-amber-500/[0.07] hover:bg-amber-500/[0.12] border-l-4 border-l-amber-500",
                              !esLocal(t) && !esAnulado && t.tipoTicket !== "GUIA" && "hover:bg-muted/20 border-l-4 border-l-transparent"
                            )}
                          >
                            <TableCell className="font-mono text-xs font-semibold">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={cn(esAnulado ? "line-through text-muted-foreground" : "text-primary")}>
                                  {t.numeroTicket}
                                </span>
                                {esLocal(t) && <BadgeLocal ticket={t} />}
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
                              <div className="flex min-w-0 items-center gap-2">
                                {t.tipoTicket === "GUIA" && (
                                  <Compass className="h-4 w-4 text-amber-500 shrink-0" />
                                )}
                                <span className="truncate">{t.nombre || t.guia?.nombre || "—"}</span>
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
                            <TableCell className="hidden xl:table-cell">
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
                            <TableCell className="hidden 2xl:table-cell text-xs text-muted-foreground font-medium">
                              {t.origen?.nombre || "—"}
                              {t.pais ? ` · ${t.pais.nombre}` : ""}
                            </TableCell>
                            <TableCell className="text-center font-bold text-foreground text-xs">
                              {t.cantidadPersonas} Pax
                            </TableCell>
                            <TableCell className="text-right font-bold text-foreground">
                              Q{parseFloat(t.montoTotal).toFixed(2)}
                            </TableCell>
                            <TableCell className="hidden 2xl:table-cell">
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
                            <TableCell className="hidden xl:table-cell text-xs">
                              {/* El objeto `guia` viene poblado tanto en el
                                  ticket del visitante como en el del guía. */}
                              {t.guia ? (
                                <div className="flex min-w-0 flex-col">
                                  <span className="flex min-w-0 items-center gap-1 font-semibold text-foreground">
                                    <Compass className="h-3 w-3 text-primary shrink-0" />
                                    <span className="truncate">{t.guia.nombre}</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {t.guia.tieneCarnet ? "Acreditado" : "Sin carnet"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Sin guía</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatearFecha(t.fechaCreacion, esLocal(t))}</span>
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
              <div className="grid grid-cols-1 gap-3 lg:hidden">
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
                        key={t.numeroTicket}
                        className={cn(
                          "p-4 rounded-xl border space-y-3 shadow-sm",
                          esAnulado && "opacity-70 bg-destructive/[0.04] border-destructive/30",
                          esLocal(t) && !esAnulado && "border-sky-500/40 border-dashed bg-sky-500/[0.06] border-l-4 border-l-sky-500",
                          !esLocal(t) && t.tipoTicket === "GUIA" && !esAnulado && "border-amber-500/40 bg-amber-500/[0.07] border-l-4 border-l-amber-500",
                          !esLocal(t) && !esAnulado && t.tipoTicket !== "GUIA" && "border-border/60 bg-card"
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="font-mono text-xs font-bold flex items-center gap-1.5 flex-wrap">
                            {t.tipoTicket === "GUIA" && (
                              <Compass className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span className={cn(esAnulado ? "line-through text-muted-foreground" : "text-primary")}>
                              {t.numeroTicket}
                            </span>
                            {esLocal(t) && <BadgeLocal ticket={t} />}
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
                            <span>{formatearFecha(t.fechaCreacion, esLocal(t))}</span>
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
                          {!esLocal(t) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirPdf(t)}
                              className="flex-1 gap-1.5 h-9 text-xs cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              PDF
                            </Button>
                          )}
                          {!esLocal(t) && puedeAnular && !t.anulado && (
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
              <Paginador
                pagina={pagina}
                totalPaginas={totalPaginas}
                total={total}
                etiqueta="tickets"
                cargando={cargando}
                onCambiar={setPagina}
              />
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
                {esLocal(ticketDetalle) && (
                  <div
                    className={cn(
                      "rounded-lg border p-3 space-y-1 text-xs",
                      ticketDetalle.estadoSincronizacion === "rechazada"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200",
                    )}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {ticketDetalle.estadoSincronizacion === "rechazada" ? (
                        <TriangleAlert className="h-4 w-4 shrink-0" />
                      ) : (
                        <CloudOff className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {ticketDetalle.estadoSincronizacion === "rechazada"
                          ? "Recaudación rechazada por el servidor"
                          : "Recaudación emitida sin conexión"}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {ticketDetalle.estadoSincronizacion === "rechazada"
                        ? `El cobro ya se hizo pero el servidor no aceptó la recaudación${
                            ticketDetalle.motivoRechazo ? `: ${ticketDetalle.motivoRechazo}` : "."
                          } Debe resolverse a mano o el arqueo de caja no cuadra.`
                        : "Este ticket todavía no llegó al servidor. El código QR ya es válido para el ingreso; el PDF y la anulación estarán disponibles cuando la recaudación suba."}
                    </p>
                  </div>
                )}

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
                    {formatearFechaHora(ticketDetalle.fechaCreacion, esLocal(ticketDetalle))}
                  </Dato>
                  <Dato etiqueta="Uso">
                    {ticketDetalle.fechaUso ? (
                      formatearFechaHora(ticketDetalle.fechaUso, esLocal(ticketDetalle))
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
                              className="font-mono text-xs h-8 bg-background"
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

                {!esLocal(ticketDetalle) && (
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
                )}
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
