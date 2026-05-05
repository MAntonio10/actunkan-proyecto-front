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
  Trees,
  Flag,
  Globe2,
  User,
  Baby,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import {
  ORIGENES_VISITANTE,
  CATEGORIAS_VISITANTE,
  TIPOS_RECORRIDO,
  PRECIOS_VISITANTE,
  PRECIO_APORTE_REFORESTACION,
  type OrigenVisitante,
  type CategoriaVisitante,
  type TipoRecorrido,
  type TipoAcceso,
} from "@/tipos";

// Iconos por origen y categoria, para los selectores
const ICONO_ORIGEN: Record<OrigenVisitante, typeof Flag> = {
  nacional: Flag,
  extranjero: Globe2,
};
const ICONO_CATEGORIA: Record<CategoriaVisitante, typeof User> = {
  adulto: User,
  nino: Baby,
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
    cantidad_centro_educativo: z.number().min(0).max(100),
    aporte_reforestacion: z.boolean(),
    notas: z.string().optional(),
  })
  .refine(
    (d) =>
      d.cantidad_adulto + d.cantidad_nino + d.cantidad_centro_educativo >= 1,
    {
      message: "Debe agregar al menos 1 persona",
      path: ["cantidad_adulto"],
    },
  );

type FormValues = z.infer<typeof esquema>;

export interface DatosTicketPreview {
  nombreVisitante: string;
  tipoAcceso: TipoAcceso;
  cantidadPersonas: number;
  montoTotal: number;
}

interface Props {
  onDatosChange?: (datos: DatosTicketPreview) => void;
}

// Map de categoria a nombre del campo del formulario
const CAMPO_CANTIDAD: Record<
  CategoriaVisitante,
  "cantidad_adulto" | "cantidad_nino" | "cantidad_centro_educativo"
> = {
  adulto: "cantidad_adulto",
  nino: "cantidad_nino",
  centro_educativo: "cantidad_centro_educativo",
};

export function FormularioVisitanteCompleto({ onDatosChange }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [cantidades, setCantidades] = useState<
    Record<CategoriaVisitante, number>
  >({
    adulto: 1,
    nino: 0,
    centro_educativo: 0,
  });
  const [aporte, setAporte] = useState(false);

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
      cantidad_centro_educativo: 0,
      aporte_reforestacion: false,
      notas: "",
    },
  });

  const nombreGrupo = watch("nombre_grupo");
  const origen = watch("origen");
  const tipoRecorrido = watch("tipo_recorrido");

  // Calculo de precios reactivo: suma por categoria (precio segun origen)
  const calculos = useMemo(() => {
    const totalPersonas =
      cantidades.adulto + cantidades.nino + cantidades.centro_educativo;

    const desgloses = (
      Object.keys(cantidades) as CategoriaVisitante[]
    ).map((cat) => ({
      categoria: cat,
      cantidad: cantidades[cat],
      precioUnitario: PRECIOS_VISITANTE[origen][cat],
      subtotal: cantidades[cat] * PRECIOS_VISITANTE[origen][cat],
    }));

    const subtotal = desgloses.reduce((acc, d) => acc + d.subtotal, 0);
    const montoAporte = aporte ? PRECIO_APORTE_REFORESTACION * totalPersonas : 0;
    const montoTotal = subtotal + montoAporte;

    const etiquetaOrigen = ORIGENES_VISITANTE.find(
      (o) => o.valor === origen,
    )!.etiqueta;
    const etiquetaRecorrido =
      tipoRecorrido === "corto" ? "Recorrido Corto" : "Recorrido Largo";

    // Resumen "2 Adultos · 1 Nino" para desplegar en el pase
    const partes: string[] = [];
    if (cantidades.adulto > 0) {
      partes.push(
        `${cantidades.adulto} ${cantidades.adulto === 1 ? "Adulto" : "Adultos"}`,
      );
    }
    if (cantidades.nino > 0) {
      partes.push(
        `${cantidades.nino} ${cantidades.nino === 1 ? "Nino" : "Ninos"}`,
      );
    }
    if (cantidades.centro_educativo > 0) {
      partes.push(`${cantidades.centro_educativo} Centro Educativo`);
    }
    const resumenCategorias =
      partes.length > 0 ? partes.join(" · ") : "Sin personas";

    const tipoAcceso: TipoAcceso = {
      id: `${origen}-${tipoRecorrido}-mixto`,
      nombre: `${resumenCategorias} (${etiquetaOrigen}) · ${etiquetaRecorrido}`,
      precio: totalPersonas > 0 ? subtotal / totalPersonas : 0,
      descripcion:
        tipoRecorrido === "corto" ? "Recorrido 45 min" : "Recorrido 2 horas",
    };

    return {
      totalPersonas,
      desgloses,
      subtotal,
      montoAporte,
      montoTotal,
      tipoAcceso,
    };
  }, [origen, tipoRecorrido, cantidades, aporte]);

  // Propagar cambios para el preview en tiempo real
  useEffect(() => {
    onDatosChange?.({
      nombreVisitante: nombreGrupo,
      tipoAcceso: calculos.tipoAcceso,
      cantidadPersonas: calculos.totalPersonas,
      montoTotal: calculos.montoTotal,
    });
  }, [
    nombreGrupo,
    calculos.totalPersonas,
    calculos.montoTotal,
    calculos.tipoAcceso,
    onDatosChange,
  ]);

  const ajustarCantidad = (cat: CategoriaVisitante, delta: number) => {
    setCantidades((prev) => {
      const nueva = Math.max(0, Math.min(100, prev[cat] + delta));
      setValue(CAMPO_CANTIDAD[cat], nueva, { shouldValidate: true });
      return { ...prev, [cat]: nueva };
    });
  };

  const alternarAporte = (valor: boolean) => {
    setAporte(valor);
    setValue("aporte_reforestacion", valor);
  };

  const onSubmit = async (datos: FormValues) => {
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 800));

    toast.success("Ticket emitido y visitante registrado", {
      description: `${datos.nombre_grupo} · ${calculos.totalPersonas} personas · Q${calculos.montoTotal.toFixed(2)}`,
    });

    reset();
    setCantidades({ adulto: 1, nino: 0, centro_educativo: 0 });
    setAporte(false);
    setEnviando(false);
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="h-5 w-5 text-primary" />
          Registro y Emision de Ticket
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              placeholder="Ej. Familia Rodriguez"
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
                // Centro Educativo solo aplica para nacionales
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
                      className={`flex items-center justify-center gap-2 h-11 rounded-md border-2 cursor-pointer transition-all ${
                        activo
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 bg-muted/30 hover:border-primary/50"
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

          {/* Cantidad por categoria — permite mezclar (p.ej. 1 adulto + 2 ninos) */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Visitantes por Categoria
              </Label>
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{calculos.totalPersonas}</span>
              </span>
            </div>
            <div className="space-y-2">
              {CATEGORIAS_VISITANTE.filter(
                (cat) =>
                  !(origen === "extranjero" && cat.valor === "centro_educativo"),
              ).map((cat) => {
                const Icono = ICONO_CATEGORIA[cat.valor];
                const cantidadCat = cantidades[cat.valor];
                const activo = cantidadCat > 0;
                const precio = PRECIOS_VISITANTE[origen][cat.valor];
                const subtotal = cantidadCat * precio;
                return (
                  <div
                    key={cat.valor}
                    className={`flex items-center gap-3 rounded-lg border-2 p-2.5 transition-all ${
                      activo
                        ? "border-primary/60 bg-primary/5"
                        : "border-border/50 bg-muted/20"
                    }`}
                  >
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
                      <p className="font-medium leading-tight">
                        {cat.etiqueta}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Q{precio} c/u
                        {cantidadCat > 0 && (
                          <span className="text-foreground">
                            {" "}
                            · Subtotal Q{subtotal}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-card border border-border/60 rounded-md h-9 px-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
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
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        onClick={() => ajustarCantidad(cat.valor, 1)}
                        disabled={cantidadCat >= 100}
                        aria-label={`Agregar un ${cat.etiqueta.toLowerCase()}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
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

          {/* Tipo de recorrido (sin precio) */}
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
                    className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      tipoRecorrido === tipo.valor
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-muted/30 hover:border-primary/50"
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

          {/* Aporte reforestacion */}
          <div
            className={`flex items-start gap-3 rounded-lg border-2 p-3 transition-all ${
              aporte
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-muted/20"
            }`}
          >
            <Checkbox
              id="aporte_reforestacion"
              checked={aporte}
              onCheckedChange={(v) => alternarAporte(Boolean(v))}
              className="mt-0.5"
            />
            <label
              htmlFor="aporte_reforestacion"
              className="flex-1 cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium">
                <Trees className="h-4 w-4 text-primary" />
                Aporte para Reforestacion (+Q{PRECIO_APORTE_REFORESTACION} por
                persona)
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Colabora con la siembra de arboles nativos en las zonas
                afectadas.
              </p>
            </label>
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
                  return (
                    <div
                      key={d.categoria}
                      className="flex justify-between text-muted-foreground"
                    >
                      <span>
                        {etiqueta} · {d.cantidad} × Q{d.precioUnitario}
                      </span>
                      <span className="text-foreground font-medium tabular-nums">
                        Q{d.subtotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              {aporte && calculos.montoAporte > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Aporte reforestacion · {calculos.totalPersonas} × Q
                    {PRECIO_APORTE_REFORESTACION}
                  </span>
                  <span className="text-foreground font-medium tabular-nums">
                    Q{calculos.montoAporte.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total a pagar ·{" "}
                <span className="text-foreground font-medium">
                  {calculos.totalPersonas}{" "}
                  {calculos.totalPersonas === 1 ? "persona" : "personas"}
                </span>
              </p>
              <p className="text-3xl font-bold text-primary">
                Q{calculos.montoTotal.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Boton de envio */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={enviando}
          >
            {enviando ? (
              <>
                <Spinner className="mr-2 h-5 w-5" />
                Procesando...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-5 w-5" />
                Emitir Ticket
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
