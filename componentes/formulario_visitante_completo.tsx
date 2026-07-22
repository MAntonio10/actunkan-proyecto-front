"use client";

import { useState, useMemo, useEffect } from "react";
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
  Flower2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  ORIGENES_VISITANTE,
  CATEGORIAS_VISITANTE,
  TIPOS_RECORRIDO,
  PRECIOS_VISITANTE,
  PRECIOS_MARIPOSARIO,
  PRECIO_TICKET_GUIA_SIN_CARNET,
  GUIAS_DEMO,
  type OrigenVisitante,
  type CategoriaVisitante,
  type TipoRecorrido,
  type TipoAcceso,
  type Guia,
  type MetodoPago,
  type AtraccionVisitante,
  type TicketEmitido,
} from "@/tipos";

// Iconos por origen y categoría
const ICONO_ORIGEN: Record<OrigenVisitante, typeof Flag> = {
  nacional: Flag,
  extranjero: Globe2,
};
const ICONO_CATEGORIA: Record<CategoriaVisitante, typeof User> = {
  adulto: User,
  nino: Baby,
  nino_menor: Baby,
  centro_educativo: GraduationCap,
};

const esquema = z
  .object({
    nombre_grupo: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres"),
    origen: z.enum(["nacional", "extranjero"] as const),
    tipo_recorrido: z.enum(["corto", "largo"] as const),
    cantidad_adulto: z.number().min(0).max(100),
    cantidad_nino: z.number().min(0).max(100),
    cantidad_nino_menor: z.number().min(0).max(100),
    cantidad_centro_educativo: z.number().min(0).max(100),
    notas: z.string().optional(),
  })
  .refine(
    (d) =>
      d.cantidad_adulto + d.cantidad_nino + d.cantidad_nino_menor + d.cantidad_centro_educativo >= 1,
    {
      message: "Debe agregar al menos 1 persona",
      path: ["cantidad_adulto"],
    },
  );

type FormValues = z.infer<typeof esquema>;

export interface DatosGuiaPreview {
  asignado: boolean;
  nombre: string;
  numeroCarnet?: string;
  tieneCarnet: boolean;
  requiereTicketSeparado: boolean;
  precioTicketGuia: number;
  metodoPago?: MetodoPago;
}

export interface DatosTicketPreview {
  nombreVisitante: string;
  tipoAcceso: TipoAcceso;
  cantidadPersonas: number;
  montoTotal: number;
  montoGuiaIndependiente?: number;
  datosGuia?: DatosGuiaPreview;
  metodoPago: MetodoPago;
  atraccion: AtraccionVisitante;
}

interface Props {
  onDatosChange?: (datos: DatosTicketPreview) => void;
  onTicketEmitido?: (ticket: TicketEmitido) => void;
}

const CAMPO_CANTIDAD: Record<
  CategoriaVisitante,
  "cantidad_adulto" | "cantidad_nino" | "cantidad_nino_menor" | "cantidad_centro_educativo"
> = {
  adulto: "cantidad_adulto",
  nino: "cantidad_nino",
  nino_menor: "cantidad_nino_menor",
  centro_educativo: "cantidad_centro_educativo",
};

export function FormularioVisitanteCompleto({ onDatosChange, onTicketEmitido }: Props) {
  const [enviando, setEnviando] = useState(false);
  
  // Estado para la Atracción seleccionada (Cuevas vs Mariposario)
  const [atraccion, setAtraccion] = useState<AtraccionVisitante>("cuevas");

  const [cantidades, setCantidades] = useState<
    Record<CategoriaVisitante, number>
  >({
    adulto: 1,
    nino: 0,
    nino_menor: 0,
    centro_educativo: 0,
  });

  // Estado para Forma de Pago (Efectivo vs Tarjeta) del visitante
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");

  // Estado para Forma de Pago independiente del ticket de Guía (cuando no tiene carnet)
  const [metodoPagoGuia, setMetodoPagoGuia] = useState<MetodoPago>("efectivo");

  // Estado para Precios Personalizados/Editables por Atracción y por Origen
  const [preciosEditadosPorAtraccion, setPreciosEditadosPorAtraccion] = useState<
    Record<AtraccionVisitante, Record<OrigenVisitante, Record<CategoriaVisitante, number>>>
  >({
    cuevas: {
      nacional: { ...PRECIOS_VISITANTE.nacional },
      extranjero: { ...PRECIOS_VISITANTE.extranjero },
    },
    mariposario: {
      nacional: { ...PRECIOS_MARIPOSARIO.nacional },
      extranjero: { ...PRECIOS_MARIPOSARIO.extranjero },
    },
  });

  const [modoEdicionPrecios, setModoEdicionPrecios] = useState(false);

  const [preciosPersonalizadosGuardadosPorAtraccion, setPreciosPersonalizadosGuardadosPorAtraccion] = useState<
    Record<AtraccionVisitante, Record<OrigenVisitante, boolean>>
  >({
    cuevas: { nacional: false, extranjero: false },
    mariposario: { nacional: false, extranjero: false },
  });

  // Estado para Guía Espiritual/Turístico
  const [modoGuia, setModoGuia] = useState<"sin_guia" | "existente" | "nuevo">(
    "sin_guia"
  );
  const [guiasDisponibles, setGuiasDisponibles] = useState<Guia[]>(GUIAS_DEMO);
  const [guiaSeleccionadoId, setGuiaSeleccionadoId] = useState<string>("");
  const [nombreGuiaInput, setNombreGuiaInput] = useState<string>("");
  const [tieneCarnetGuia, setTieneCarnetGuia] = useState<boolean>(true);
  const [numeroCarnetGuiaInput, setNumeroCarnetGuiaInput] = useState<string>("");
  const [precioTicketGuia, setPrecioTicketGuia] = useState<number>(
    PRECIO_TICKET_GUIA_SIN_CARNET
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre_grupo: "",
      origen: "nacional",
      tipo_recorrido: "corto",
      cantidad_adulto: 1,
      cantidad_nino: 0,
      cantidad_nino_menor: 0,
      cantidad_centro_educativo: 0,
      notas: "",
    },
  });

  const nombreGrupo = watch("nombre_grupo");
  const origen = watch("origen");
  const tipoRecorrido = watch("tipo_recorrido");

  // Precios actuales para la atracción y origen activos
  const preciosEditados = preciosEditadosPorAtraccion[atraccion][origen];
  const preciosPersonalizadosGuardados = preciosPersonalizadosGuardadosPorAtraccion[atraccion][origen];

  // Restablecer tarifas estándar para la atracción y origen activo
  const restablecerPreciosEstandar = () => {
    const estandar = atraccion === "cuevas" ? PRECIOS_VISITANTE[origen] : PRECIOS_MARIPOSARIO[origen];
    setPreciosEditadosPorAtraccion((prev) => ({
      ...prev,
      [atraccion]: {
        ...prev[atraccion],
        [origen]: { ...estandar },
      },
    }));
    setPrecioTicketGuia(PRECIO_TICKET_GUIA_SIN_CARNET);
    setPreciosPersonalizadosGuardadosPorAtraccion((prev) => ({
      ...prev,
      [atraccion]: {
        ...prev[atraccion],
        [origen]: false,
      },
    }));
    setModoEdicionPrecios(false);
    toast.info(`Tarifas de ${atraccion === "cuevas" ? "Cuevas" : "Mariposario"} (${origen}) restablecidas`);
  };

  // Guardar Precios con Validación de Q0.00
  const handleGuardarPrecios = () => {
    const categoriasConCosto: CategoriaVisitante[] = ["adulto", "nino", "centro_educativo"];
    const hayPrecioInvalido = categoriasConCosto.some(
      (cat) => isNaN(preciosEditados[cat]) || preciosEditados[cat] <= 0
    );

    if (hayPrecioInvalido) {
      toast.error("Tarifa no válida", {
        description: "No se permite guardar precios en Q0.00 o vacíos (excepto niños menores a 7 años).",
      });
      return;
    }

    if (isNaN(precioTicketGuia) || precioTicketGuia <= 0) {
      toast.error("Tarifa de Guía no válida", {
        description: "El precio del ticket de guía debe ser mayor a Q0.00.",
      });
      return;
    }

    setPreciosPersonalizadosGuardadosPorAtraccion((prev) => ({
      ...prev,
      [atraccion]: {
        ...prev[atraccion],
        [origen]: true,
      },
    }));
    setModoEdicionPrecios(false);
    toast.success(`Precios guardados para ${atraccion === "cuevas" ? "Cuevas" : "Mariposario"} (${origen})`, {
      description: `Adulto: Q${preciosEditados.adulto.toFixed(2)} · Niño (7+): Q${preciosEditados.nino.toFixed(2)}`,
    });
  };

  const handleCambioPrecioUnitario = (cat: CategoriaVisitante, nuevoValor: number) => {
    setPreciosEditadosPorAtraccion((prev) => ({
      ...prev,
      [atraccion]: {
        ...prev[atraccion],
        [origen]: {
          ...prev[atraccion][origen],
          [cat]: nuevoValor,
        },
      },
    }));
  };

  const handleSeleccionarGuiaExistente = (id: string) => {
    setGuiaSeleccionadoId(id);
    const guiaEncontrado = guiasDisponibles.find((g) => g.id === id);
    if (guiaEncontrado) {
      setNombreGuiaInput(guiaEncontrado.nombre);
      setTieneCarnetGuia(guiaEncontrado.tiene_carnet);
      setNumeroCarnetGuiaInput(guiaEncontrado.numero_carnet || "");
    }
  };

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

    const nombre = nombreGuiaInput.trim() || "Guía";
    const numeroCarnet = tieneCarnetGuia ? numeroCarnetGuiaInput.trim() : undefined;
    const requiereTicketSeparado = !tieneCarnetGuia;

    return {
      asignado: true,
      nombre,
      numeroCarnet,
      tieneCarnet: tieneCarnetGuia,
      requiereTicketSeparado,
      precioTicketGuia: requiereTicketSeparado ? precioTicketGuia : 0,
      metodoPago: requiereTicketSeparado ? metodoPagoGuia : undefined,
    };
  }, [
    modoGuia,
    nombreGuiaInput,
    tieneCarnetGuia,
    numeroCarnetGuiaInput,
    precioTicketGuia,
    metodoPagoGuia,
  ]);

  const calculos = useMemo(() => {
    const totalPersonas =
      cantidades.adulto + cantidades.nino + cantidades.nino_menor + cantidades.centro_educativo;

    const desgloses = (
      Object.keys(cantidades) as CategoriaVisitante[]
    ).map((cat) => {
      const precioUnitario = cat === "nino_menor" ? 0 : preciosEditados[cat];
      return {
        categoria: cat,
        cantidad: cantidades[cat],
        precioUnitario,
        subtotal: cantidades[cat] * precioUnitario,
      };
    });

    const subtotalVisitantes = desgloses.reduce((acc, d) => acc + d.subtotal, 0);
    
    const montoGuiaIndependiente = datosGuiaCalculados.requiereTicketSeparado
      ? datosGuiaCalculados.precioTicketGuia
      : 0;

    const montoTotal = subtotalVisitantes + montoGuiaIndependiente;

    const etiquetaOrigen = ORIGENES_VISITANTE.find(
      (o) => o.valor === origen,
    )!.etiqueta;
    const etiquetaAtraccion = atraccion === "cuevas" ? "Cuevas Actun Kan" : "Mariposario";
    const etiquetaRecorrido =
      tipoRecorrido === "corto" ? "Recorrido Corto" : "Recorrido Largo";

    const partes: string[] = [];
    if (cantidades.adulto > 0) {
      partes.push(
        `${cantidades.adulto} ${cantidades.adulto === 1 ? "Adulto" : "Adultos"}`,
      );
    }
    if (cantidades.nino > 0) {
      partes.push(
        `${cantidades.nino} ${cantidades.nino === 1 ? "Niño" : "Niños"} (7+ años)`,
      );
    }
    if (cantidades.nino_menor > 0) {
      partes.push(
        `${cantidades.nino_menor} ${cantidades.nino_menor === 1 ? "Niño" : "Niños"} (<7 años - Gratis)`,
      );
    }
    if (cantidades.centro_educativo > 0) {
      partes.push(`${cantidades.centro_educativo} Centro Educativo`);
    }
    const resumenCategorias =
      partes.length > 0 ? partes.join(" · ") : "Sin personas";

    const tipoAcceso: TipoAcceso = {
      id: `${atraccion}-${origen}-${tipoRecorrido}`,
      nombre: `[${etiquetaAtraccion}] ${resumenCategorias} (${etiquetaOrigen}) · ${etiquetaRecorrido}`,
      precio: totalPersonas > 0 ? subtotalVisitantes / totalPersonas : 0,
      descripcion:
        tipoRecorrido === "corto" ? "Recorrido 45 min" : "Recorrido 2 horas",
    };

    return {
      totalPersonas,
      desgloses,
      subtotalVisitantes,
      montoGuiaIndependiente,
      montoTotal,
      tipoAcceso,
    };
  }, [atraccion, origen, tipoRecorrido, cantidades, preciosEditados, datosGuiaCalculados]);

  useEffect(() => {
    onDatosChange?.({
      nombreVisitante: nombreGrupo,
      tipoAcceso: calculos.tipoAcceso,
      cantidadPersonas: calculos.totalPersonas,
      montoTotal: calculos.montoTotal,
      montoGuiaIndependiente: calculos.montoGuiaIndependiente,
      datosGuia: datosGuiaCalculados,
      metodoPago,
      atraccion,
    });
  }, [
    nombreGrupo,
    calculos.totalPersonas,
    calculos.montoTotal,
    calculos.montoGuiaIndependiente,
    calculos.tipoAcceso,
    datosGuiaCalculados,
    metodoPago,
    atraccion,
    onDatosChange,
  ]);

  const ajustarCantidad = (cat: CategoriaVisitante, delta: number) => {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(100, prev[cat] + delta));
      setValue(CAMPO_CANTIDAD[cat], nueva, { shouldValidate: true });
      return { ...prev, [cat]: nueva };
    });
  };

  const onSubmit = async (datos: FormValues) => {
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 600));

    if (modoGuia === "nuevo" && nombreGuiaInput.trim()) {
      const nuevoGuia: Guia = {
        id: `g-${Date.now()}`,
        nombre: nombreGuiaInput.trim(),
        numero_carnet: tieneCarnetGuia ? numeroCarnetGuiaInput.trim() : undefined,
        tiene_carnet: tieneCarnetGuia,
      };
      setGuiasDisponibles((prev) => [...prev, nuevoGuia]);
    }

    const ticketEmitido: TicketEmitido = {
      id: `t-${Date.now()}`,
      numero_ticket: `TCK-2026-${Math.floor(100 + Math.random() * 900)}`,
      nombre_visitante: datos.nombre_grupo,
      atraccion,
      origen,
      tipo_recorrido: tipoRecorrido,
      cantidad_personas: calculos.totalPersonas,
      monto_total: calculos.subtotalVisitantes,
      metodo_pago: metodoPago,
      nombre_guia: datosGuiaCalculados.asignado ? datosGuiaCalculados.nombre : undefined,
      tiene_carnet_guia: datosGuiaCalculados.asignado ? datosGuiaCalculados.tieneCarnet : undefined,
      monto_guia: datosGuiaCalculados.requiereTicketSeparado ? datosGuiaCalculados.precioTicketGuia : undefined,
      metodo_pago_guia: datosGuiaCalculados.requiereTicketSeparado ? metodoPagoGuia : undefined,
      fecha: new Date(),
    };

    onTicketEmitido?.(ticketEmitido);

    if (datosGuiaCalculados.asignado && datosGuiaCalculados.requiereTicketSeparado) {
      toast.success("Se emitieron 2 tickets exitosamente", {
        description: `1x Ticket ${atraccion === "cuevas" ? "Cuevas" : "Mariposario"} (${metodoPago}) + 1x Ticket Guía (${metodoPagoGuia}) · Total Q${calculos.montoTotal.toFixed(2)}`,
      });
    } else {
      toast.success("Ticket emitido exitosamente", {
        description: `${datos.nombre_grupo} · ${atraccion === "cuevas" ? "Cuevas" : "Mariposario"} · ${calculos.totalPersonas} personas · Q${calculos.montoTotal.toFixed(2)} (${metodoPago})`,
      });
    }

    reset();
    setCantidades({ adulto: 1, nino: 0, nino_menor: 0, centro_educativo: 0 });
    setMetodoPago("efectivo");
    setMetodoPagoGuia("efectivo");
    setModoGuia("sin_guia");
    setNombreGuiaInput("");
    setNumeroCarnetGuiaInput("");
    setTieneCarnetGuia(true);
    setEnviando(false);
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 border-b border-border/40 mb-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary shrink-0" />
          <div>
            <CardTitle className="text-lg">
              Registro y Emisión de Ticket
            </CardTitle>
            {modoEdicionPrecios ? (
              <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Edición de Precios ({atraccion === "cuevas" ? "Cuevas" : "Mariposario"} · {origen === "nacional" ? "Nacionales" : "Extranjeros"})
              </span>
            ) : preciosPersonalizadosGuardados ? (
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                Tarifas Personalizadas ({atraccion === "cuevas" ? "Cuevas" : "Mariposario"})
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!modoEdicionPrecios ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModoEdicionPrecios(true)}
              className="text-xs h-9 border-primary/40 text-primary hover:bg-primary/10 font-semibold cursor-pointer"
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              Editar Precios
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleGuardarPrecios}
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Guardar Precios
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={restablecerPreciosEstandar}
            className="text-xs h-9 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Restablecer tarifas estándar"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restablecer
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Selector de Atracción: Cuevas vs Mariposario */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
              <Compass className="h-4 w-4 text-primary" />
              Atracción / Destino
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAtraccion("cuevas")}
                className={`h-auto min-h-[3.5rem] py-2.5 px-2.5 sm:px-3.5 justify-start gap-2 sm:gap-2.5 border-2 cursor-pointer transition-colors w-full overflow-hidden ${
                  atraccion === "cuevas"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                <Mountain className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="flex flex-col items-start leading-tight text-left min-w-0 flex-1 overflow-hidden">
                  <span className="text-xs sm:text-sm font-bold text-foreground truncate w-full">Cuevas Actun Kan</span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal truncate w-full">Cavernas naturales</span>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setAtraccion("mariposario")}
                className={`h-auto min-h-[3.5rem] py-2.5 px-2.5 sm:px-3.5 justify-start gap-2 sm:gap-2.5 border-2 cursor-pointer transition-colors w-full overflow-hidden ${
                  atraccion === "mariposario"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                <Flower2 className="h-5 w-5 text-purple-500 shrink-0" />
                <div className="flex flex-col items-start leading-tight text-left min-w-0 flex-1 overflow-hidden">
                  <span className="text-xs sm:text-sm font-bold text-foreground truncate w-full">Mariposario</span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal truncate w-full">Santuario tropical</span>
                </div>
              </Button>
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
              <p className="text-sm text-destructive">
                {errors.nombre_grupo.message}
              </p>
            )}
          </div>

          {/* Origen */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Origen
            </Label>
            <RadioGroup
              value={origen}
              onValueChange={(v) => {
                const nuevoOrigen = v as OrigenVisitante;
                setValue("origen", nuevoOrigen);
                if (nuevoOrigen === "extranjero") {
                  setCantidades((prev) => ({ ...prev, centro_educativo: 0 }));
                  setValue("cantidad_centro_educativo", 0);
                }
              }}
              className="grid grid-cols-2 gap-2"
            >
              {ORIGENES_VISITANTE.map((o) => {
                const Icono = ICONO_ORIGEN[o.valor];
                const activo = origen === o.valor;
                return (
                  <div key={o.valor} className="relative">
                    <RadioGroupItem
                      value={o.valor}
                      id={`origen-${o.valor}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`origen-${o.valor}`}
                      className={`flex items-center justify-center gap-2 h-11 rounded-md border-2 cursor-pointer transition-colors ${
                        activo
                          ? "border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:border-primary"
                          : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                      }`}
                    >
                      <Icono className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        {o.etiqueta}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Forma de Pago (Efectivo vs Tarjeta) */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
              <Banknote className="h-4 w-4 text-primary" />
              Forma de Pago (Ticket Visitante)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetodoPago("efectivo")}
                className={`h-11 justify-center gap-2 border-2 cursor-pointer transition-colors ${
                  metodoPago === "efectivo"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                <Banknote className="h-4 w-4 text-emerald-500" />
                <span>Efectivo</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setMetodoPago("tarjeta")}
                className={`h-11 justify-center gap-2 border-2 cursor-pointer transition-colors ${
                  metodoPago === "tarjeta"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4 text-blue-500" />
                <span>Tarjeta</span>
              </Button>
            </div>
          </div>

          {/* Cantidad por categoría con Precios Editables Independientes */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>Visitantes por Categoría ({atraccion === "cuevas" ? "Cuevas" : "Mariposario"} · {origen === "nacional" ? "Nacionales" : "Extranjeros"})</span>
                {modoEdicionPrecios && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-500 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Modo Edición Habilitado
                  </span>
                )}
              </Label>
              <span className="text-xs text-muted-foreground">
                Total Registrados: <span className="font-semibold text-foreground">{calculos.totalPersonas}</span>
              </span>
            </div>
            <div className="space-y-2.5">
              {CATEGORIAS_VISITANTE.filter(
                (cat) =>
                  !(origen === "extranjero" && cat.valor === "centro_educativo"),
              ).map((cat) => {
                const Icono = ICONO_CATEGORIA[cat.valor];
                const cantidadCat = cantidades[cat.valor];
                const activo = cantidadCat > 0;
                const esGratuito = cat.valor === "nino_menor";
                const precio = esGratuito ? 0 : preciosEditados[cat.valor];
                const subtotal = cantidadCat * precio;

                return (
                  <div
                    key={cat.valor}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                      activo
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/50 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          activo
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icono className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium leading-tight text-sm sm:text-base flex items-center gap-1.5">
                          <span>{cat.etiqueta}</span>
                          {esGratuito && (
                            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 rounded-full border border-emerald-500/30">
                              Gratis
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {esGratuito ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Ingreso sin costo (Menor de 7 años)
                            </span>
                          ) : cantidadCat > 0 ? (
                            <span className="text-foreground font-medium">
                              Subtotal Q{subtotal.toFixed(2)}
                            </span>
                          ) : (
                            <span>Tarifa: Q{precio.toFixed(2)} c/u</span>
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
                              value={precio === 0 ? "" : precio}
                              onChange={(e) => {
                                const valClean = e.target.value.replace(/^0+(?=\d)/, "");
                                const parsed = valClean === "" ? 0 : parseFloat(valClean);
                                handleCambioPrecioUnitario(cat.valor, isNaN(parsed) ? 0 : parsed);
                              }}
                              className="w-16 h-7 p-0 border-none bg-transparent text-sm font-bold text-center focus-visible:ring-0 focus-visible:ring-offset-0"
                              title={`Editar precio unitario para ${atraccion} (${origen})`}
                            />
                          </div>
                        )
                      ) : (
                        <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border ${
                          esGratuito
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold"
                            : "bg-muted text-muted-foreground border-border/40"
                        }`}>
                          {esGratuito ? "Q0.00 (Gratis)" : `Q${precio.toFixed(2)} c/u`}
                        </div>
                      )}

                      <div className="flex items-center gap-1 bg-card border border-border/60 rounded-md h-9 px-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10 cursor-pointer"
                          onClick={() => ajustarCantidad(cat.valor, -1)}
                          disabled={cantidadCat <= 0}
                          aria-label={`Quitar un ${cat.etiqueta.toLowerCase()}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="w-8 text-center">
                          <span className="text-base font-bold tabular-nums">
                            {cantidadCat}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/10 cursor-pointer"
                          onClick={() => ajustarCantidad(cat.valor, 1)}
                          disabled={cantidadCat >= 100}
                          aria-label={`Agregar un ${cat.etiqueta.toLowerCase()}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {errors.cantidad_adulto && (
              <p className="text-sm text-destructive">
                {errors.cantidad_adulto.message}
              </p>
            )}
          </div>

          {/* Tipo de recorrido */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de Recorrido
            </Label>
            <RadioGroup
              value={tipoRecorrido}
              onValueChange={(v) =>
                setValue("tipo_recorrido", v as TipoRecorrido)
              }
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {TIPOS_RECORRIDO.map((tipo) => (
                <div key={tipo.valor} className="relative">
                  <RadioGroupItem
                    value={tipo.valor}
                    id={tipo.valor}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={tipo.valor}
                    className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      tipoRecorrido === tipo.valor
                        ? "border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/10 hover:border-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                    }`}
                  >
                    <span className="font-medium">{tipo.etiqueta}</span>
                    <span className="text-xs text-muted-foreground">
                      {tipo.descripcion}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Sección de Asignación / Registro de Guía */}
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

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModoGuia("sin_guia");
                  setNombreGuiaInput("");
                  setNumeroCarnetGuiaInput("");
                }}
                className={`text-xs h-9 border-2 cursor-pointer transition-colors ${
                  modoGuia === "sin_guia"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                Sin Guía
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModoGuia("existente");
                  if (guiasDisponibles.length > 0) {
                    handleSeleccionarGuiaExistente(guiasDisponibles[0].id);
                  }
                }}
                className={`text-xs h-9 border-2 cursor-pointer transition-colors ${
                  modoGuia === "existente"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                Seleccionar Guía
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModoGuia("nuevo");
                  setGuiaSeleccionadoId("");
                  setNombreGuiaInput("");
                  setNumeroCarnetGuiaInput("");
                  setTieneCarnetGuia(true);
                }}
                className={`text-xs h-9 border-2 cursor-pointer transition-colors ${
                  modoGuia === "nuevo"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/80 hover:bg-background hover:text-muted-foreground"
                }`}
              >
                + Crear Guía
              </Button>
            </div>

            {modoGuia === "existente" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Seleccionar Guía Registrado
                  </Label>
                  <Select
                    value={guiaSeleccionadoId}
                    onValueChange={handleSeleccionarGuiaExistente}
                  >
                    <SelectTrigger className="bg-background border-border/60 h-10">
                      <SelectValue placeholder="Seleccione un guía..." />
                    </SelectTrigger>
                    <SelectContent>
                      {guiasDisponibles.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nombre} {g.tiene_carnet ? "(Acreditado)" : "(Sin Carnet)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!tieneCarnetGuia && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-3 text-xs text-amber-600 dark:text-amber-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Guía No Acreditado (Sin Carnet)</p>
                        <p className="text-muted-foreground mt-0.5">
                          Este guía no cuenta con carnet registrado. Se generará un <strong>ticket independiente por separado</strong> para el guía.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                      <span className="font-semibold text-foreground">Forma de pago ticket de guía:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMetodoPagoGuia("efectivo")}
                          className={`h-8 px-2.5 text-xs border cursor-pointer transition-colors ${
                            metodoPagoGuia === "efectivo"
                              ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-500/20"
                              : "border-border/60 bg-background text-muted-foreground hover:border-amber-500/60 hover:bg-background"
                          }`}
                        >
                          <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Efectivo</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMetodoPagoGuia("tarjeta")}
                          className={`h-8 px-2.5 text-xs border cursor-pointer transition-colors ${
                            metodoPagoGuia === "tarjeta"
                              ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-500/20"
                              : "border-border/60 bg-background text-muted-foreground hover:border-amber-500/60 hover:bg-background"
                          }`}
                        >
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                          <span>Tarjeta</span>
                        </Button>
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
                            value={precioTicketGuia === 0 ? "" : precioTicketGuia}
                            onChange={(e) => {
                              const valClean = e.target.value.replace(/^0+(?=\d)/, "");
                              const parsed = valClean === "" ? 0 : parseFloat(valClean);
                              setPrecioTicketGuia(isNaN(parsed) ? 0 : parsed);
                            }}
                            className="w-16 h-6 p-0 border-none bg-transparent text-xs font-bold text-center text-foreground focus-visible:ring-0"
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-foreground">Q{precioTicketGuia.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )}
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
                    <p className="text-xs text-muted-foreground">
                      Acreditación oficial de guía
                    </p>
                  </div>
                  <Switch
                    checked={tieneCarnetGuia}
                    onCheckedChange={(checked) => setTieneCarnetGuia(checked)}
                  />
                </div>

                {tieneCarnetGuia ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="numero_carnet_guia" className="text-xs text-muted-foreground">
                      Número de Carnet / Acreditación (Registro interno del sistema)
                    </Label>
                    <Input
                      id="numero_carnet_guia"
                      placeholder="Ej. GT-2024-001"
                      value={numeroCarnetGuiaInput}
                      onChange={(e) => setNumeroCarnetGuiaInput(e.target.value)}
                      className="bg-background border-border/60 h-10 font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      * El número de carnet solo se guardará en el sistema; no se imprimirá en el ticket por seguridad.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-3 text-xs text-amber-600 dark:text-amber-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Guía No Acreditado (Sin Carnet)</p>
                        <p className="text-muted-foreground mt-0.5">
                          Al no disponer de carnet, el sistema generará automáticamente un <strong>ticket independiente por separado</strong> para el guía.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                      <span className="font-semibold text-foreground">Forma de pago ticket de guía:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMetodoPagoGuia("efectivo")}
                          className={`h-8 px-2.5 text-xs border cursor-pointer transition-colors ${
                            metodoPagoGuia === "efectivo"
                              ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-500/20"
                              : "border-border/60 bg-background text-muted-foreground hover:border-amber-500/60 hover:bg-background"
                          }`}
                        >
                          <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Efectivo</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMetodoPagoGuia("tarjeta")}
                          className={`h-8 px-2.5 text-xs border cursor-pointer transition-colors ${
                            metodoPagoGuia === "tarjeta"
                              ? "border-amber-500 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-500/20"
                              : "border-border/60 bg-background text-muted-foreground hover:border-amber-500/60 hover:bg-background"
                          }`}
                        >
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                          <span>Tarjeta</span>
                        </Button>
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
                            value={precioTicketGuia === 0 ? "" : precioTicketGuia}
                            onChange={(e) => {
                              const valClean = e.target.value.replace(/^0+(?=\d)/, "");
                              const parsed = valClean === "" ? 0 : parseFloat(valClean);
                              setPrecioTicketGuia(isNaN(parsed) ? 0 : parsed);
                            }}
                            className="w-16 h-6 p-0 border-none bg-transparent text-xs font-bold text-center text-foreground focus-visible:ring-0"
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-foreground">Q{precioTicketGuia.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label
              htmlFor="notas"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
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

          {/* Resumen de total */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="space-y-1 text-xs">
              {calculos.desgloses
                .filter((d) => d.cantidad > 0)
                .map((d) => {
                  const etiqueta = CATEGORIAS_VISITANTE.find(
                    (c) => c.valor === d.categoria,
                  )!.etiqueta;
                  const esGratuito = d.categoria === "nino_menor";
                  return (
                    <div
                      key={d.categoria}
                      className="flex justify-between text-muted-foreground"
                    >
                      <span>
                        {etiqueta} · {d.cantidad} {esGratuito ? "(Gratis)" : `× Q${d.precioUnitario.toFixed(2)}`}
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
                  Total a pagar ({atraccion === "cuevas" ? "Cuevas" : "Mariposario"}) ·{" "}
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
          </div>

          {/* Botón de envío */}
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
                * Para evitar errores, la emisión de tickets está bloqueada mientras edita los precios. Presione &quot;Guardar Precios&quot; arriba para habilitar.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
