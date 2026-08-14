"use client";

import { useState, useMemo } from "react";
import { LogosInstitucionales } from "./logos_institucionales";
import {
  Heart,
  PlusCircle,
  History,
  Banknote,
  CreditCard,
  Printer,
  Search,
  CheckCircle2,
  Receipt,
  Sparkles,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { DONACIONES_DEMO, type Donacion, type MetodoPago } from "@/tipos";
import { CodigoQR } from "@/componentes/codigo_qr";

export function ModuloDonaciones() {
  const [donaciones, setDonaciones] = useState<Donacion[]>(DONACIONES_DEMO);
  const [pestanaActiva, setPestanaActiva] = useState<string>("emision");

  // Campos del formulario
  const [nombreDonante, setNombreDonante] = useState<string>("");
  const [montoInput, setMontoInput] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [notasInput, setNotasInput] = useState<string>("");

  // Búsqueda en historial
  const [busqueda, setBusqueda] = useState<string>("");

  // Recibo activo generado
  const [reciboGenerado, setReciboGenerado] = useState<Donacion | null>(null);

  // Cálculo del monto numérico para el preview reactivo
  const montoNumerico = useMemo(() => {
    const val = parseFloat(montoInput.replace(/^0+(?=\d)/, ""));
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [montoInput]);

  // Totales financieros
  const estadisticas = useMemo(() => {
    const totalRecaudado = donaciones.reduce((acc, d) => acc + d.monto, 0);
    const cantidadDonaciones = donaciones.length;
    const promedio = cantidadDonaciones > 0 ? totalRecaudado / cantidadDonaciones : 0;
    return { totalRecaudado, cantidadDonaciones, promedio };
  }, [donaciones]);

  // Donaciones filtradas en la tabla
  const donacionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return donaciones;
    const q = busqueda.toLowerCase().trim();
    return donaciones.filter(
      (d) =>
        d.nombre_donante.toLowerCase().includes(q) ||
        d.numero_recibo.toLowerCase().includes(q)
    );
  }, [donaciones, busqueda]);

  const handleEmitirDonacion = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombreDonante.trim()) {
      toast.error("Nombre requerido", {
        description: "Por favor ingrese el nombre de la persona o entidad que realiza la donación.",
      });
      return;
    }

    if (montoNumerico <= 0) {
      toast.error("Monto no válido", {
        description: "El monto a donar debe ser mayor a Q0.00.",
      });
      return;
    }

    const nuevoReciboNo = `DON-2026-${String(donaciones.length + 1).padStart(3, "0")}`;
    const nuevaDonacion: Donacion = {
      id: `don-${Date.now()}`,
      numero_recibo: nuevoReciboNo,
      nombre_donante: nombreDonante.trim(),
      monto: montoNumerico,
      metodo_pago: metodoPago,
      fecha: new Date(),
      notas: notasInput.trim() || undefined,
    };

    setDonaciones((prev) => [nuevaDonacion, ...prev]);
    setReciboGenerado(nuevaDonacion);

    toast.success("Donación registrada y recibo emitido", {
      description: `${nuevaDonacion.numero_recibo} · ${nuevaDonacion.nombre_donante} · Q${nuevaDonacion.monto.toFixed(2)}`,
    });
  };

  const handleLimpiarFormulario = () => {
    setNombreDonante("");
    setMontoInput("");
    setMetodoPago("efectivo");
    setNotasInput("");
    setReciboGenerado(null);
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas de Donación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Total Recaudado por Mes
              </p>
              <p className="text-2xl font-bold text-primary">
                Q{estadisticas.totalRecaudado.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Donaciones Emitidas por Mes
              </p>
              <p className="text-2xl font-bold text-foreground">
                {estadisticas.cantidadDonaciones}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Promedio por Donativo
              </p>
              <p className="text-2xl font-bold text-foreground">
                Q{estadisticas.promedio.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pestañas Principales: Emisión vs Registro */}
      <Tabs defaultValue="emision" value={pestanaActiva} onValueChange={setPestanaActiva} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="emision" className="text-xs md:text-sm gap-2">
            <PlusCircle className="h-4 w-4" />
            Emitir Recibo
          </TabsTrigger>
          <TabsTrigger value="registro" className="text-xs md:text-sm gap-2">
            <History className="h-4 w-4" />
            Registro de Donaciones ({donaciones.length})
          </TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Emisión de Recibo */}
        <TabsContent value="emision" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Formulario de donación (3 columnas) */}
            <Card className="lg:col-span-3 bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Emisión de Recibo de Donación
                </CardTitle>
                <CardDescription>
                  Registre el donativo otorgado al Parque Regional Municipal Actún Kan y emita su recibo de comprobación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmitirDonacion} className="space-y-5">
                  {/* Nombre del donante */}
                  <div className="space-y-2">
                    <Label htmlFor="nombre_donante" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Nombre de la Persona / Entidad Donante
                    </Label>
                    <Input
                      id="nombre_donante"
                      placeholder="Ej. Carlos Mendoza o Fundación Petén Verde"
                      value={nombreDonante}
                      onChange={(e) => setNombreDonante(e.target.value)}
                      className="bg-muted/50 border-border/50 h-11"
                    />
                  </div>

                  {/* Monto a donar */}
                  <div className="space-y-2">
                    <Label htmlFor="monto_donativo" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Monto a Donar (Quetzales)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-primary text-base">
                        Q
                      </span>
                      <Input
                        id="monto_donativo"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Ej. 100.00"
                        value={montoInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/^0+(?=\d)/, "");
                          setMontoInput(val);
                        }}
                        className="bg-muted/50 border-border/50 h-11 pl-9 font-bold text-lg text-foreground"
                      />
                    </div>
                  </div>

                  {/* Forma de Pago */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Forma de Pago
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

                  {/* Notas opcionales */}
                  <div className="space-y-2">
                    <Label htmlFor="notas_donacion" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Notas / Propósito del Donativo (Opcional)
                    </Label>
                    <Textarea
                      id="notas_donacion"
                      placeholder="Ej. Apoyo para conservación de flora, reforestación, mantenimientos, etc."
                      value={notasInput}
                      onChange={(e) => setNotasInput(e.target.value)}
                      className="bg-muted/50 border-border/50 min-h-[75px] resize-none"
                    />
                  </div>

                  <Separator />

                  {/* Botones de acción */}
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Receipt className="mr-2 h-5 w-5" />
                      Emitir Recibo de Donación
                    </Button>
                    {reciboGenerado && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLimpiarFormulario}
                        className="h-12 border-border/60 text-muted-foreground hover:text-foreground"
                      >
                        Nueva Donación
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Preview del Recibo de Donación (2 columnas) */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 space-y-3">
                <Card className="bg-card/90 backdrop-blur-sm border-2 border-primary/30 overflow-hidden shadow-lg">
                  <CardContent className="p-0">
                    {/* Header del recibo */}
                    <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 text-center border-b border-dashed border-border/60">
                      <LogosInstitucionales tamano="md" className="mb-2" />
                      <h3 className="text-lg font-extrabold tracking-tight text-foreground">
                        ACTÚN KAN
                      </h3>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                        Recibo de Donación
                      </p>
                      <Badge variant="outline" className="mt-2 font-mono text-xs border-primary/40 text-primary bg-background">
                        {reciboGenerado ? reciboGenerado.numero_recibo : `DON-2026-${String(donaciones.length + 1).padStart(3, "0")}`}
                      </Badge>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Nombre del donante */}
                      <div className="rounded-lg bg-muted/40 p-3 border border-border/40 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                          Donante
                        </span>
                        <p className="text-lg font-bold text-foreground truncate">
                          {nombreDonante.trim() || reciboGenerado?.nombre_donante || "Nombre del Donante"}
                        </p>
                      </div>

                      {/* Monto donado */}
                      <div className="flex items-baseline justify-between rounded-lg bg-primary/10 p-3.5 border-2 border-primary/30">
                        <span className="text-xs uppercase font-bold tracking-wider text-primary">
                          Monto Donado
                        </span>
                        <p className="text-3xl font-black text-primary tabular-nums">
                          Q{(reciboGenerado ? reciboGenerado.monto : montoNumerico).toFixed(2)}
                        </p>
                      </div>

                      {/* Forma de Pago - Destacada para impresoras térmicas de 80 mm */}
                      <div className="rounded-lg border-2 border-border/60 bg-muted/30 p-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Forma de Pago
                        </span>
                        <span className="text-base font-black tracking-wide text-foreground uppercase flex items-center gap-2">
                          {metodoPago === "efectivo" ? (
                            <>
                              <span>EFECTIVO</span>
                            </>
                          ) : (
                            <>
                              <span>TARJETA</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs pt-1">
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground font-medium">Fecha de Emisión:</span>
                          <span className="font-semibold text-foreground">
                            {(reciboGenerado ? reciboGenerado.fecha : new Date()).toISOString().split("T")[0]}
                          </span>
                        </div>
                        {(notasInput.trim() || reciboGenerado?.notas) && (
                          <div className="py-1">
                            <span className="text-muted-foreground font-medium block mb-0.5">Notas:</span>
                            <p className="text-xs text-foreground italic bg-muted/30 p-2 rounded border border-border/30">
                              {notasInput.trim() || reciboGenerado?.notas}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Código QR de recibo */}
                      <div className="flex flex-col items-center pt-2">
                        <div className="bg-white p-3 rounded-lg border border-border/40 shadow-sm">
                          <CodigoQR
                            valor={JSON.stringify({
                              recibo: reciboGenerado ? reciboGenerado.numero_recibo : `DON-2026-${String(donaciones.length + 1).padStart(3, "0")}`,
                              donante: nombreDonante || reciboGenerado?.nombre_donante || "Donante",
                              monto: reciboGenerado ? reciboGenerado.monto : montoNumerico,
                              pago: metodoPago,
                            })}
                            size={160}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 font-medium text-center">
                          ¡Muchas gracias por su apoyo a la conservación del Parque Regional Municipal Actún Kan!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Pestaña 2: Registro / Historial de Donaciones */}
        <TabsContent value="registro" className="m-0">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Historial de Donaciones Registradas
                </CardTitle>
                <CardDescription>
                  Registro completo de donativos y recibos emitidos en el sistema.
                </CardDescription>
              </div>

              {/* Búsqueda */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar donante o recibo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 bg-muted/40 border-border/60 h-9 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Vista Escritorio (Tabla) */}
              <div className="hidden md:block rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[140px]">No. Recibo</TableHead>
                      <TableHead>Donante</TableHead>
                      <TableHead className="text-right">Monto (Q)</TableHead>
                      <TableHead>Forma de Pago</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donacionesFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron donaciones registradas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      donacionesFiltradas.map((d) => (
                        <TableRow key={d.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {d.numero_recibo}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {d.nombre_donante}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground">
                            Q{d.monto.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] gap-1 font-semibold ${
                                d.metodo_pago === "efectivo"
                                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                  : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                              }`}
                            >
                              {d.metodo_pago === "efectivo" ? (
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
                          <TableCell className="text-xs text-muted-foreground">
                            {d.fecha.toISOString().split("T")[0]}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {d.notas || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Móvil (Tarjetas) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {donacionesFiltradas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg p-4 border border-border/50 text-sm">
                    No se encontraron donaciones registradas.
                  </div>
                ) : (
                  donacionesFiltradas.map((d) => (
                    <div key={d.id} className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {d.numero_recibo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d.fecha.toISOString().split("T")[0]}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Donante</span>
                          <h4 className="font-semibold text-sm text-foreground">{d.nombre_donante}</h4>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-base text-primary">
                            Q{d.monto.toFixed(2)}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 font-semibold mt-1 ${
                              d.metodo_pago === "efectivo"
                                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                : "border-blue-500/40 text-blue-600 bg-blue-500/10"
                            }`}
                          >
                            {d.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta"}
                          </Badge>
                        </div>
                      </div>

                      {d.notas && (
                        <div className="pt-2 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground font-medium block mb-0.5">Notas:</span>
                          <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded border border-border/30">
                            {d.notas}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
