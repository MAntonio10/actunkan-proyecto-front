"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus,
  Minus,
  Plus,
  Ticket,
  Flag,
  Globe2,
  User,
  Baby,
  GraduationCap,
  Compass,
  IdCard,
  Edit3,
  Check,
  RotateCcw,
  BadgeAlert,
  AlertCircle,
  Banknote,
  CreditCard,
  Mountain,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { SelectorGuia } from "./selector_guia";

import {
  type CatalogosTickets,
  type CatalogoCodificado,
  type PayloadEmisionTicket,
  type RespuestaEmisionTicket,
} from "@/tipos";

// Los iconos se eligen por `codigo` (clave estable del catálogo), no por nombre.
const ICONO_TIPO_VISITANTE: Record<string, typeof User> = {
  adulto: User,
  nino: Baby,
  nino_menor: Baby,
  centro_educativo: GraduationCap,
};
// Se indexan por `codigo`, la clave estable del catálogo. 'mariposario' sigue
// siendo el código en base de datos aunque la atracción se llame ahora
// Biblioteca Ambiental; el nombre visible viene del backend.
const ICONO_ATRACCION: Record<string, typeof Mountain> = {
  cuevas: Mountain,
  mariposario: BookOpen,
};
const COLOR_ATRACCION: Record<string, string> = {
  cuevas: "text-emerald-500",
  mariposario: "text-purple-500",
};

const CODIGO_EXTRANJERO = "extranjero";
const CODIGO_NINO_MENOR = "nino_menor";
const CODIGO_CENTRO_EDUCATIVO = "centro_educativo";

const esquema = z.object({
  nombre_grupo: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  notas: z.string().optional(),
});

type FormValues = z.infer<typeof esquema>;

export interface DatosGuiaPreview {
  asignado: boolean;
  nombre: string;
  tieneCarnet: boolean;
  requiereTicketSeparado: boolean;
  precioTicketGuia: number;
  nombreOpcionPago?: string;
}

export interface DatosTicketPreview {
  nombreVisitante: string;
  descripcionAcceso: string;
  cantidadPersonas: number;
  montoTotal: number;
  montoGuiaIndependiente?: number;
  datosGuia?: DatosGuiaPreview;
  nombreOpcionPago: string;
  nombreAtraccion: string;
  codigoAtraccion: string;
}

interface Props {
  onDatosChange?: (datos: DatosTicketPreview) => void;
  onTicketEmitido?: (respuesta: RespuestaEmisionTicket) => void;
  /** Comparte los catálogos hacia arriba para que no se pidan dos veces. */
  onCatalogosCargados?: (catalogos: CatalogosTickets) => void;
}

export function FormularioVisitanteCompleto({
  onDatosChange,
  onTicketEmitido,
  onCatalogosCargados,
}: Props) {
  const [catalogos, setCatalogos] = useState<CatalogosTickets | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Selecciones del formulario, todas por id real del catálogo
  const [idAtraccion, setIdAtraccion] = useState<number | null>(null);
  const [idOrigen, setIdOrigen] = useState<number | null>(null);
  const [idPais, setIdPais] = useState<number | null>(null);
  const [idTipoRecorrido, setIdTipoRecorrido] = useState<number | null>(null);
  const [idOpcionPago, setIdOpcionPago] = useState<number | null>(null);
  const [idOpcionPagoGuia, setIdOpcionPagoGuia] = useState<number | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});

  const [paisPopoverAbierto, setPaisPopoverAbierto] = useState(false);
  const [busquedaPais, setBusquedaPais] = useState("");

  // Edición de tarifas: se persiste contra /tarifas, no en estado local
  const [modoEdicionPrecios, setModoEdicionPrecios] = useState(false);
  const [preciosEditados, setPreciosEditados] = useState<Record<number, string>>({});
  const [precioGuiaEditado, setPrecioGuiaEditado] = useState<string>("");
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);

  // Guía acompañante
  const [modoGuia, setModoGuia] = useState<"sin_guia" | "existente" | "nuevo">("sin_guia");
  const [idGuiaSeleccionado, setIdGuiaSeleccionado] = useState<number | null>(null);
  const [nombreGuiaInput, setNombreGuiaInput] = useState("");
  const [tieneCarnetGuia, setTieneCarnetGuia] = useState(true);
  const [numeroCarnetGuiaInput, setNumeroCarnetGuiaInput] = useState("");

  const [errorPais, setErrorPais] = useState<string | null>(null);
  const [errorCantidades, setErrorCantidades] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre_grupo: "", notas: "" },
  });

  const nombreGrupo = watch("nombre_grupo");

  const onCatalogosCargadosRef = useRef(onCatalogosCargados);
  useEffect(() => {
    onCatalogosCargadosRef.current = onCatalogosCargados;
  }, [onCatalogosCargados]);

  const cargarCatalogos = useCallback(async () => {
    setCargandoCatalogos(true);
    try {
      const res = await api.tickets.getCatalogos();
      setCatalogos(res);
      // Por ref: si dependiera del prop, un cambio de identidad del callback
      // volvería a disparar la carga de catálogos.
      onCatalogosCargadosRef.current?.(res);

      // Valores iniciales: primera opción de cada catálogo
      setIdAtraccion((prev) => prev ?? res.atracciones[0]?.id ?? null);
      setIdOrigen((prev) => prev ?? res.origenes[0]?.id ?? null);
      setIdTipoRecorrido((prev) => prev ?? res.tiposRecorrido[0]?.id ?? null);
      const efectivo = res.opcionesPago.find((o) => o.esEfectivo) || res.opcionesPago[0];
      setIdOpcionPago((prev) => prev ?? efectivo?.id ?? null);
      setIdOpcionPagoGuia((prev) => prev ?? efectivo?.id ?? null);
      setCantidades((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const inicial: Record<number, number> = {};
        res.tiposVisitante.forEach((t) => {
          inicial[t.id] = t.codigo === "adulto" ? 1 : 0;
        });
        return inicial;
      });
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudieron cargar los catálogos";
      toast.error("Error al cargar catálogos", { description: mensaje });
    } finally {
      setCargandoCatalogos(false);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const atraccionActual = catalogos?.atracciones.find((a) => a.id === idAtraccion);
  const origenActual = catalogos?.origenes.find((o) => o.id === idOrigen);
  const tipoRecorridoActual = catalogos?.tiposRecorrido.find((t) => t.id === idTipoRecorrido);
  const opcionPagoActual = catalogos?.opcionesPago.find((o) => o.id === idOpcionPago);
  const opcionPagoGuiaActual = catalogos?.opcionesPago.find((o) => o.id === idOpcionPagoGuia);
  const esExtranjero = origenActual?.codigo === CODIGO_EXTRANJERO;

  // Guatemala se excluye del selector: es el país sede, no aplica a extranjeros
  const paisesExtranjero = useMemo(
    () => (catalogos?.paises || []).filter((p) => p.nombre !== "Guatemala"),
    [catalogos],
  );
  const paisSeleccionado = paisesExtranjero.find((p) => p.id === idPais);
  const paisesFiltrados = useMemo(() => {
    const q = busquedaPais.trim().toLowerCase();
    if (!q) return paisesExtranjero;
    return paisesExtranjero.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [busquedaPais, paisesExtranjero]);

  // Centro educativo no aplica a visitantes extranjeros
  const tiposVisitanteVisibles = useMemo(() => {
    if (!catalogos) return [];
    return catalogos.tiposVisitante.filter(
      (t) => !(esExtranjero && t.codigo === CODIGO_CENTRO_EDUCATIVO),
    );
  }, [catalogos, esExtranjero]);

  // Precio unitario vigente. El servidor vuelve a resolverlo al emitir: esto es
  // solo para mostrarle el total al usuario antes de confirmar.
  const precioDe = useCallback(
    (tipo: CatalogoCodificado): number => {
      if (tipo.codigo === CODIGO_NINO_MENOR) return 0;
      const tarifa = catalogos?.tarifas.find(
        (t) =>
          t.idAtraccion === idAtraccion &&
          t.idOrigen === idOrigen &&
          t.idTipoVisitante === tipo.id,
      );
      return tarifa ? parseFloat(tarifa.precio) : 0;
    },
    [catalogos, idAtraccion, idOrigen],
  );

  const precioTicketGuia = catalogos ? parseFloat(catalogos.precioTicketGuia) : 0;

  const datosGuiaCalculados = useMemo<DatosGuiaPreview>(() => {
    if (modoGuia === "sin_guia") {
      return {
        asignado: false,
        nombre: "",
        tieneCarnet: true,
        requiereTicketSeparado: false,
        precioTicketGuia: 0,
      };
    }
    const requiereTicketSeparado = !tieneCarnetGuia;
    return {
      asignado: true,
      nombre: nombreGuiaInput.trim() || "Guía",
      tieneCarnet: tieneCarnetGuia,
      requiereTicketSeparado,
      precioTicketGuia: requiereTicketSeparado ? precioTicketGuia : 0,
      nombreOpcionPago: requiereTicketSeparado ? opcionPagoGuiaActual?.nombre : undefined,
    };
  }, [modoGuia, nombreGuiaInput, tieneCarnetGuia, precioTicketGuia, opcionPagoGuiaActual]);

  const calculos = useMemo(() => {
    const desgloses = tiposVisitanteVisibles.map((tipo) => {
      const cantidad = cantidades[tipo.id] || 0;
      const precioUnitario = precioDe(tipo);
      return { tipo, cantidad, precioUnitario, subtotal: cantidad * precioUnitario };
    });

    const totalPersonas = desgloses.reduce((acc, d) => acc + d.cantidad, 0);
    const subtotalVisitantes = desgloses.reduce((acc, d) => acc + d.subtotal, 0);
    const montoGuiaIndependiente = datosGuiaCalculados.requiereTicketSeparado
      ? datosGuiaCalculados.precioTicketGuia
      : 0;

    const partes = desgloses
      .filter((d) => d.cantidad > 0)
      .map((d) => `${d.cantidad} ${d.tipo.nombre}`);

    const descripcionAcceso = [
      atraccionActual ? `[${atraccionActual.nombre}]` : "",
      partes.length > 0 ? partes.join(" · ") : "Sin personas",
      origenActual ? `(${origenActual.nombre})` : "",
      tipoRecorridoActual ? `· ${tipoRecorridoActual.nombre}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      desgloses,
      totalPersonas,
      subtotalVisitantes,
      montoGuiaIndependiente,
      montoTotal: subtotalVisitantes + montoGuiaIndependiente,
      descripcionAcceso,
    };
  }, [
    tiposVisitanteVisibles,
    cantidades,
    precioDe,
    datosGuiaCalculados,
    atraccionActual,
    origenActual,
    tipoRecorridoActual,
  ]);

  useEffect(() => {
    onDatosChange?.({
      nombreVisitante: nombreGrupo,
      descripcionAcceso: calculos.descripcionAcceso,
      cantidadPersonas: calculos.totalPersonas,
      montoTotal: calculos.montoTotal,
      montoGuiaIndependiente: calculos.montoGuiaIndependiente,
      datosGuia: datosGuiaCalculados,
      nombreOpcionPago: opcionPagoActual?.nombre || "",
      nombreAtraccion: atraccionActual?.nombre || "",
      codigoAtraccion: atraccionActual?.codigo || "",
    });
  }, [
    nombreGrupo,
    calculos.descripcionAcceso,
    calculos.totalPersonas,
    calculos.montoTotal,
    calculos.montoGuiaIndependiente,
    datosGuiaCalculados,
    opcionPagoActual,
    atraccionActual,
    onDatosChange,
  ]);

  const ajustarCantidad = (idTipo: number, delta: number) => {
    setCantidades((prev) => ({
      ...prev,
      [idTipo]: Math.max(0, Math.min(100, (prev[idTipo] || 0) + delta)),
    }));
    setErrorCantidades(null);
  };

  const handleCambiarOrigen = (nuevoIdOrigen: number) => {
    setIdOrigen(nuevoIdOrigen);
    const nuevoOrigen = catalogos?.origenes.find((o) => o.id === nuevoIdOrigen);
    if (nuevoOrigen?.codigo !== CODIGO_EXTRANJERO) {
      setIdPais(null);
      setErrorPais(null);
    } else {
      // Centro educativo no aplica a extranjeros: se limpia su cantidad
      const centroEducativo = catalogos?.tiposVisitante.find(
        (t) => t.codigo === CODIGO_CENTRO_EDUCATIVO,
      );
      if (centroEducativo) {
        setCantidades((prev) => ({ ...prev, [centroEducativo.id]: 0 }));
      }
    }
  };

  const entrarModoEdicionPrecios = () => {
    const iniciales: Record<number, string> = {};
    tiposVisitanteVisibles.forEach((t) => {
      if (t.codigo !== CODIGO_NINO_MENOR) iniciales[t.id] = String(precioDe(t));
    });
    setPreciosEditados(iniciales);
    setPrecioGuiaEditado(String(precioTicketGuia));
    setModoEdicionPrecios(true);
  };

  const handleGuardarPrecios = async () => {
    if (!idAtraccion || !idOrigen) return;

    // El backend rechaza precio <= 0 salvo en nino_menor, única categoría gratuita
    const invalido = Object.values(preciosEditados).some((v) => {
      const n = parseFloat(v);
      return isNaN(n) || n <= 0;
    });
    if (invalido) {
      toast.error("Tarifa no válida", {
        description: "No se permite guardar precios en Q0.00 o vacíos.",
      });
      return;
    }
    const precioGuiaNum = parseFloat(precioGuiaEditado);
    if (isNaN(precioGuiaNum) || precioGuiaNum <= 0) {
      toast.error("Tarifa de Guía no válida", {
        description: "El precio del ticket de guía debe ser mayor a Q0.00.",
      });
      return;
    }

    setGuardandoPrecios(true);
    try {
      // Cada PATCH cierra la vigencia anterior y crea una nueva tarifa
      const cambios = Object.entries(preciosEditados)
        .filter(([idTipo, valor]) => {
          const tipo = tiposVisitanteVisibles.find((t) => t.id === Number(idTipo));
          return tipo && parseFloat(valor) !== precioDe(tipo);
        })
        .map(([idTipo, valor]) =>
          api.tarifas.actualizarTarifa({
            idAtraccion,
            idOrigen,
            idTipoVisitante: Number(idTipo),
            precio: parseFloat(valor),
          }),
        );

      if (precioGuiaNum !== precioTicketGuia) {
        cambios.push(api.tarifas.actualizarTarifaGuia(precioGuiaNum) as Promise<never>);
      }

      if (cambios.length === 0) {
        setModoEdicionPrecios(false);
        toast.info("No hubo cambios de tarifa");
        return;
      }

      await Promise.all(cambios);
      await cargarCatalogos();
      setModoEdicionPrecios(false);
      toast.success("Tarifas actualizadas", {
        description: "Los tickets ya emitidos conservan su precio original.",
      });
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudieron guardar las tarifas";
      toast.error("Error al guardar tarifas", { description: mensaje });
    } finally {
      setGuardandoPrecios(false);
    }
  };


  const onSubmit = async (datos: FormValues) => {
    if (!idAtraccion || !idOrigen || !idTipoRecorrido || !idOpcionPago) {
      toast.error("Faltan datos del catálogo", {
        description: "Recargue la página para volver a cargar los catálogos.",
      });
      return;
    }

    if (calculos.totalPersonas < 1) {
      setErrorCantidades("Debe agregar al menos 1 persona");
      return;
    }
    if (esExtranjero && !idPais) {
      setErrorPais("Seleccione el país de origen del visitante extranjero");
      return;
    }
    if (modoGuia === "existente" && !idGuiaSeleccionado) {
      toast.error("Seleccione un guía de la lista");
      return;
    }
    if (modoGuia === "nuevo" && !nombreGuiaInput.trim()) {
      toast.error("Ingrese el nombre del guía");
      return;
    }
    if (modoGuia === "nuevo" && tieneCarnetGuia && !numeroCarnetGuiaInput.trim()) {
      toast.error("Ingrese el número de carnet del guía");
      return;
    }

    const guia: PayloadEmisionTicket["guia"] =
      modoGuia === "sin_guia"
        ? undefined
        : modoGuia === "existente"
          ? {
              modo: "existente",
              idGuia: idGuiaSeleccionado!,
              ...(tieneCarnetGuia ? {} : { idOpcionPagoGuia: idOpcionPagoGuia ?? undefined }),
            }
          : {
              modo: "nuevo",
              nombre: nombreGuiaInput.trim(),
              tieneCarnet: tieneCarnetGuia,
              ...(tieneCarnetGuia
                ? { numeroCarnet: numeroCarnetGuiaInput.trim() }
                : { idOpcionPagoGuia: idOpcionPagoGuia ?? undefined }),
            };

    const payload: PayloadEmisionTicket = {
      nombreGrupo: datos.nombre_grupo,
      idAtraccion,
      idOrigen,
      idPais: esExtranjero ? idPais : null,
      idTipoRecorrido,
      cantidades: Object.entries(cantidades)
        .filter(([, cantidad]) => cantidad > 0)
        .map(([idTipoVisitante, cantidad]) => ({
          idTipoVisitante: Number(idTipoVisitante),
          cantidad,
        })),
      idOpcionPago,
      notas: datos.notas || undefined,
      guia,
    };

    setEnviando(true);
    try {
      const respuesta = await api.tickets.emitir(payload);
      onTicketEmitido?.(respuesta);

      const cantidadTickets = respuesta.tickets.length;
      toast.success(
        cantidadTickets > 1
          ? `Se emitieron ${cantidadTickets} tickets exitosamente`
          : "Ticket emitido exitosamente",
        {
          description: `${datos.nombre_grupo} · ${atraccionActual?.nombre} · Total Q${parseFloat(
            respuesta.montoTotalGeneral,
          ).toFixed(2)}`,
        },
      );

      reset();
      setCantidades((prev) => {
        const limpio: Record<number, number> = {};
        Object.keys(prev).forEach((k) => {
          const tipo = catalogos?.tiposVisitante.find((t) => t.id === Number(k));
          limpio[Number(k)] = tipo?.codigo === "adulto" ? 1 : 0;
        });
        return limpio;
      });
      setIdPais(null);
      setModoGuia("sin_guia");
      setIdGuiaSeleccionado(null);
      setNombreGuiaInput("");
      setNumeroCarnetGuiaInput("");
      setTieneCarnetGuia(true);
      setErrorPais(null);
      setErrorCantidades(null);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo emitir el ticket";
      // El backend exige una caja abierta para vender y responde 400 si no la hay
      const esFaltaDeCaja = err instanceof ApiError && err.status === 400 && /caja/i.test(mensaje);
      toast.error(esFaltaDeCaja ? "No hay caja abierta" : "Error al emitir el ticket", {
        description: esFaltaDeCaja
          ? "Debe abrir la caja en el módulo Cierre Diario antes de emitir tickets."
          : mensaje,
      });
    } finally {
      setEnviando(false);
    }
  };

  if (cargandoCatalogos) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Cargando catálogos...</p>
        </CardContent>
      </Card>
    );
  }

  if (!catalogos) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            No se pudieron cargar los catálogos de emisión.
          </p>
          <Button variant="outline" onClick={cargarCatalogos} className="cursor-pointer">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 border-b border-border/40 mb-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary shrink-0" />
          <div>
            <CardTitle className="text-lg">Registro y Emisión de Ticket</CardTitle>
            {modoEdicionPrecios && (
              <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Edición de Tarifas ({atraccionActual?.nombre} · {origenActual?.nombre})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!modoEdicionPrecios ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={entrarModoEdicionPrecios}
              className="text-xs h-9 border-primary/40 text-primary hover:bg-primary/10 font-semibold cursor-pointer"
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              Editar Precios
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleGuardarPrecios}
                disabled={guardandoPrecios}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
              >
                {guardandoPrecios ? (
                  <Spinner className="mr-1.5 h-4 w-4" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                Guardar Precios
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModoEdicionPrecios(false)}
                className="text-xs h-9 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Atracción / Destino */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
              <Compass className="h-4 w-4 text-primary" />
              Atracción / Destino
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              {catalogos.atracciones.map((a) => {
                const Icono = ICONO_ATRACCION[a.codigo] || Compass;
                const activo = idAtraccion === a.id;
                return (
                  <Button
                    key={a.id}
                    type="button"
                    variant="outline"
                    onClick={() => setIdAtraccion(a.id)}
                    className={cn(
                      "h-auto min-h-[3.5rem] py-2.5 px-2.5 sm:px-3.5 justify-start gap-2 sm:gap-2.5 border-2 cursor-pointer transition-colors w-full overflow-hidden",
                      activo
                        ? "border-primary bg-primary/10 font-bold shadow-sm hover:bg-primary/10 hover:border-primary"
                        : "border-border/60 bg-background hover:border-primary/80 hover:bg-background",
                    )}
                  >
                    <Icono
                      className={cn("h-5 w-5 shrink-0", COLOR_ATRACCION[a.codigo] || "text-primary")}
                    />
                    <div className="flex flex-col items-start leading-tight text-left min-w-0 flex-1 overflow-hidden">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate w-full">
                        {a.nombre}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Nombre del visitante/grupo */}
          <div className="space-y-2">
            <Label
              htmlFor="nombre_grupo"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Nombre del Visitante / Grupo
            </Label>
            <Input
              id="nombre_grupo"
              placeholder="Ej. Familia Rodríguez"
              className="bg-muted/50 border-border/50 h-11"
              {...register("nombre_grupo")}
            />
            {errors.nombre_grupo && (
              <p className="text-sm text-destructive">{errors.nombre_grupo.message}</p>
            )}
          </div>

          {/* Origen */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Origen</Label>
            <RadioGroup
              value={idOrigen ? String(idOrigen) : ""}
              onValueChange={(v) => handleCambiarOrigen(Number(v))}
              className="grid grid-cols-2 gap-2"
            >
              {catalogos.origenes.map((o) => {
                const Icono = o.codigo === CODIGO_EXTRANJERO ? Globe2 : Flag;
                const activo = idOrigen === o.id;
                return (
                  <div key={o.id} className="relative">
                    <RadioGroupItem
                      value={String(o.id)}
                      id={`origen-${o.id}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`origen-${o.id}`}
                      className={cn(
                        "flex items-center justify-center gap-2 h-11 rounded-md border-2 cursor-pointer transition-colors",
                        activo
                          ? "border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:border-primary"
                          : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground",
                      )}
                    >
                      <Icono className="h-4 w-4" />
                      <span className="font-medium text-sm">{o.nombre}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* País de origen (solo visitantes extranjeros) */}
          {esExtranjero && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
                <Globe2 className="h-4 w-4 text-primary" />
                País de Origen
              </Label>
              <Popover
                open={paisPopoverAbierto}
                onOpenChange={(open) => {
                  setPaisPopoverAbierto(open);
                  if (!open) setBusquedaPais("");
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={paisPopoverAbierto}
                    className={cn(
                      "w-full h-11 justify-between bg-muted/50 border-border/50 font-normal",
                      !paisSeleccionado && "text-muted-foreground",
                    )}
                  >
                    {paisSeleccionado?.nombre || "Seleccione el país..."}
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2 border-b border-border/50">
                    <Input
                      placeholder="Buscar país..."
                      value={busquedaPais}
                      onChange={(e) => setBusquedaPais(e.target.value)}
                      className="h-9"
                      autoFocus
                    />
                  </div>
                  <ScrollArea className="h-60">
                    <div className="p-1">
                      {paisesFiltrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No se encontraron países.
                        </p>
                      ) : (
                        paisesFiltrados.map((p) => {
                          const seleccionado = p.id === idPais;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setIdPais(p.id);
                                setErrorPais(null);
                                setPaisPopoverAbierto(false);
                                setBusquedaPais("");
                              }}
                              className={cn(
                                "w-full flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-left cursor-pointer hover:bg-muted transition-colors",
                                seleccionado && "bg-primary/10 text-primary font-semibold",
                              )}
                            >
                              <span>{p.nombre}</span>
                              {seleccionado && <Check className="h-4 w-4 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {errorPais && <p className="text-sm text-destructive">{errorPais}</p>}
            </div>
          )}

          {/* Visitantes por categoría */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>
                  Visitantes por Categoría ({atraccionActual?.nombre} · {origenActual?.nombre})
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">
                Total Registrados:{" "}
                <span className="font-semibold text-foreground">{calculos.totalPersonas}</span>
              </span>
            </div>

            <div className="space-y-2.5">
              {calculos.desgloses.map(({ tipo, cantidad, precioUnitario, subtotal }) => {
                const Icono = ICONO_TIPO_VISITANTE[tipo.codigo] || User;
                const activo = cantidad > 0;
                const esGratuito = tipo.codigo === CODIGO_NINO_MENOR;

                return (
                  <div
                    key={tipo.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border-2 p-3 transition-all",
                      activo ? "border-primary/60 bg-primary/5" : "border-border/50 bg-muted/20",
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                          activo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icono className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium leading-tight text-sm sm:text-base flex items-center gap-1.5">
                          <span>{tipo.nombre}</span>
                          {esGratuito && (
                            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 rounded-full border border-emerald-500/30">
                              Gratis
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {esGratuito ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Ingreso sin costo
                            </span>
                          ) : cantidad > 0 ? (
                            <span className="text-foreground font-medium">
                              Subtotal Q{subtotal.toFixed(2)}
                            </span>
                          ) : (
                            <span>Tarifa: Q{precioUnitario.toFixed(2)} c/u</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      {modoEdicionPrecios ? (
                        esGratuito ? (
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-md border border-emerald-500/30">
                            Q0.00 (Gratis)
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-background border-2 border-emerald-500/60 rounded-md px-2 h-9 shadow-sm">
                            <span className="text-xs font-semibold text-emerald-500">Q</span>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="0"
                              value={preciosEditados[tipo.id] ?? ""}
                              onChange={(e) =>
                                setPreciosEditados((prev) => ({
                                  ...prev,
                                  [tipo.id]: e.target.value,
                                }))
                              }
                              className="w-16 h-7 p-0 border-none bg-transparent text-sm font-bold text-center focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        )
                      ) : (
                        <div
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1.5 rounded-md border",
                            esGratuito
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold"
                              : "bg-muted text-muted-foreground border-border/40",
                          )}
                        >
                          {esGratuito ? "Q0.00 (Gratis)" : `Q${precioUnitario.toFixed(2)} c/u`}
                        </div>
                      )}

                      <div className="flex items-center gap-1 bg-card border border-border/60 rounded-md h-9 px-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10 cursor-pointer"
                          onClick={() => ajustarCantidad(tipo.id, -1)}
                          disabled={cantidad <= 0}
                          aria-label={`Quitar un ${tipo.nombre}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="w-8 text-center">
                          <span className="text-base font-bold tabular-nums">{cantidad}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10 cursor-pointer"
                          onClick={() => ajustarCantidad(tipo.id, 1)}
                          disabled={cantidad >= 100}
                          aria-label={`Agregar un ${tipo.nombre}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {errorCantidades && <p className="text-sm text-destructive">{errorCantidades}</p>}
          </div>

          {/* Tipo de recorrido */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de Recorrido
            </Label>
            <RadioGroup
              value={idTipoRecorrido ? String(idTipoRecorrido) : ""}
              onValueChange={(v) => setIdTipoRecorrido(Number(v))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {catalogos.tiposRecorrido.map((t) => (
                <div key={t.id} className="relative">
                  <RadioGroupItem
                    value={String(t.id)}
                    id={`recorrido-${t.id}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`recorrido-${t.id}`}
                    className={cn(
                      "flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors",
                      idTipoRecorrido === t.id
                        ? "border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:border-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground",
                    )}
                  >
                    <span className="font-medium">{t.nombre}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Forma de Pago */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
              <Banknote className="h-4 w-4 text-primary" />
              Forma de Pago (Ticket Visitante)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {catalogos.opcionesPago.map((o) => {
                const Icono = o.esEfectivo ? Banknote : CreditCard;
                const activo = idOpcionPago === o.id;
                return (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    onClick={() => setIdOpcionPago(o.id)}
                    className={cn(
                      "h-11 justify-center gap-2 border-2 cursor-pointer transition-colors",
                      activo
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground",
                    )}
                  >
                    <Icono
                      className={cn("h-4 w-4", o.esEfectivo ? "text-emerald-500" : "text-blue-500")}
                    />
                    <span>{o.nombre}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Guía acompañante */}
          <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider font-semibold text-primary flex items-center gap-1.5">
                <Compass className="h-4 w-4" />
                Guía Acompañante
              </Label>
              {modoGuia !== "sin_guia" && (
                <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                  {modoGuia === "existente" ? "Guía Seleccionado" : "Nuevo Guía"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {(
                [
                  { modo: "sin_guia" as const, etiqueta: "Sin Guía" },
                  { modo: "existente" as const, etiqueta: "Seleccionar Guía" },
                  { modo: "nuevo" as const, etiqueta: "+ Crear Guía" },
                ]
              ).map(({ modo, etiqueta }) => (
                <Button
                  key={modo}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // No se preselecciona ningún guía: el selector trae su
                    // propia lista y elegir uno por defecto arriesga emitir
                    // el ticket con el guía equivocado.
                    setModoGuia(modo);
                    setNombreGuiaInput("");
                    setNumeroCarnetGuiaInput("");
                    setIdGuiaSeleccionado(null);
                    setTieneCarnetGuia(true);
                  }}
                  className={cn(
                    "text-[11px] sm:text-xs h-auto min-h-[2.25rem] py-1.5 px-1 whitespace-normal text-center leading-tight border-2 cursor-pointer transition-colors",
                    modoGuia === modo
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground",
                  )}
                >
                  {etiqueta}
                </Button>
              ))}
            </div>

            {modoGuia === "existente" && (
              <div className="pt-2">
                <SelectorGuia
                  idSeleccionado={idGuiaSeleccionado}
                  onSeleccionar={(g) => {
                    setIdGuiaSeleccionado(g.id);
                    setNombreGuiaInput(g.nombre);
                    setTieneCarnetGuia(g.tieneCarnet);
                    setNumeroCarnetGuiaInput(g.numeroCarnet || "");
                  }}
                />
              </div>
            )}

            {modoGuia === "nuevo" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre_guia_input" className="text-xs text-muted-foreground">
                    Nombre Completo del Guía
                  </Label>
                  <Input
                    id="nombre_guia_input"
                    placeholder="Ej. Pedro Ak'abal"
                    value={nombreGuiaInput}
                    onChange={(e) => setNombreGuiaInput(e.target.value)}
                    className="bg-background border-border/60 h-10"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-background/60 p-3 border border-border/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <IdCard className="h-4 w-4 text-primary" />
                      <span>¿Cuenta con número de carnet?</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Acreditación oficial de guía</p>
                  </div>
                  <Switch checked={tieneCarnetGuia} onCheckedChange={setTieneCarnetGuia} />
                </div>

                {tieneCarnetGuia && (
                  <div className="space-y-1.5">
                    <Label htmlFor="numero_carnet_guia" className="text-xs text-muted-foreground">
                      Número de Carnet / Acreditación
                    </Label>
                    <Input
                      id="numero_carnet_guia"
                      placeholder="Ej. GT-2024-001"
                      value={numeroCarnetGuiaInput}
                      onChange={(e) => setNumeroCarnetGuiaInput(e.target.value)}
                      className="bg-background border-border/60 h-10 font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      * El número de carnet solo se guarda en el sistema; no se imprime en el ticket.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Guía sin carnet: genera un ticket independiente con su propia forma de pago */}
            {modoGuia !== "sin_guia" && !tieneCarnetGuia && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-3 text-xs text-amber-600 dark:text-amber-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Guía No Acreditado (Sin Carnet)</p>
                    <p className="text-muted-foreground mt-0.5">
                      Se generará un <strong>ticket independiente por separado</strong> para el guía.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                  <span className="font-semibold text-foreground">Forma de pago ticket de guía:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {catalogos.opcionesPago.map((o) => {
                      const Icono = o.esEfectivo ? Banknote : CreditCard;
                      return (
                        <Button
                          key={o.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIdOpcionPagoGuia(o.id)}
                          className={cn(
                            "h-8 px-2.5 text-xs border cursor-pointer transition-colors",
                            idOpcionPagoGuia === o.id
                              ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-500/20"
                              : "border-border/60 bg-background text-muted-foreground hover:border-amber-500/60 hover:bg-background",
                          )}
                        >
                          <Icono
                            className={cn(
                              "h-3.5 w-3.5",
                              o.esEfectivo ? "text-emerald-500" : "text-blue-500",
                            )}
                          />
                          <span>{o.nombre}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                  <span>Precio ticket de guía (Sin Carnet):</span>
                  {modoEdicionPrecios ? (
                    <div className="flex items-center gap-1 bg-background rounded px-2 py-0.5 border-2 border-emerald-500/60">
                      <span className="font-semibold text-emerald-500">Q</span>
                      <Input
                        type="number"
                        min={1}
                        placeholder="0"
                        value={precioGuiaEditado}
                        onChange={(e) => setPrecioGuiaEditado(e.target.value)}
                        className="w-16 h-6 p-0 border-none bg-transparent text-xs font-bold text-center text-foreground focus-visible:ring-0"
                      />
                    </div>
                  ) : (
                    <span className="font-bold text-foreground">
                      Q{precioTicketGuia.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas" className="text-xs uppercase tracking-wider text-muted-foreground">
              Notas Adicionales (Opcional)
            </Label>
            <Textarea
              id="notas"
              placeholder="Ej. Grupo escolar, requiere accesibilidad, etc."
              className="bg-muted/50 border-border/50 min-h-[70px] resize-none"
              {...register("notas")}
            />
          </div>

          <Separator />

          {/* Resumen */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="space-y-1 text-xs">
              {calculos.desgloses
                .filter((d) => d.cantidad > 0)
                .map((d) => {
                  const esGratuito = d.tipo.codigo === CODIGO_NINO_MENOR;
                  return (
                    <div key={d.tipo.id} className="flex justify-between text-muted-foreground">
                      <span>
                        {d.tipo.nombre} · {d.cantidad}{" "}
                        {esGratuito ? "(Gratis)" : `× Q${d.precioUnitario.toFixed(2)}`}
                      </span>
                      <span className="text-foreground font-medium tabular-nums">
                        {esGratuito ? "Q0.00" : `Q${d.subtotal.toFixed(2)}`}
                      </span>
                    </div>
                  );
                })}
              {datosGuiaCalculados.requiereTicketSeparado && (
                <div className="flex justify-between text-amber-500 font-medium pt-1 border-t border-border/40">
                  <span className="flex items-center gap-1">
                    <BadgeAlert className="h-3.5 w-3.5" />
                    Ticket Guía Independiente ({datosGuiaCalculados.nombre})
                  </span>
                  <span className="tabular-nums">
                    +Q{calculos.montoGuiaIndependiente.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total a pagar ({atraccionActual?.nombre}) ·{" "}
                  <span className="text-foreground font-medium">
                    {calculos.totalPersonas}{" "}
                    {calculos.totalPersonas === 1 ? "persona" : "personas"}
                  </span>
                </p>
                {datosGuiaCalculados.requiereTicketSeparado && (
                  <p className="text-[11px] text-amber-500 font-medium">
                    (Incluye Ticket de Visitante + Ticket de Guía)
                  </p>
                )}
              </div>
              <p className="text-3xl font-bold text-primary">
                Q{calculos.montoTotal.toFixed(2)}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              El monto final lo confirma el servidor al emitir el ticket.
            </p>
          </div>

          {/* Envío */}
          <div className="space-y-1.5">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 cursor-pointer"
              disabled={enviando || modoEdicionPrecios}
            >
              {enviando ? (
                <>
                  <Spinner className="mr-2 h-5 w-5" />
                  Procesando...
                </>
              ) : modoEdicionPrecios ? (
                <>
                  <AlertCircle className="mr-2 h-5 w-5 text-amber-300" />
                  Guarde los Precios Antes de Emitir
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  {datosGuiaCalculados.requiereTicketSeparado
                    ? "Emitir 2 Tickets (Visitante + Guía)"
                    : "Emitir Ticket"}
                </>
              )}
            </Button>
            {modoEdicionPrecios && (
              <p className="text-xs text-amber-500 font-medium text-center">
                * La emisión está bloqueada mientras edita las tarifas.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
