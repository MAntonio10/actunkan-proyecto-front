"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Pencil,
  Ban,
  ImagePlus,
  MapPin,
  User,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  AlertTriangle,
  ListTree,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagenActividad } from "./imagen_actividad";
import { CatalogoSectores } from "./catalogo_sectores";
import {
  type ActividadParqueBackend,
  type ImagenActividad as TipoImagen,
  type SectorParqueBackend,
  type UsuarioBackend,
} from "@/tipos";

const LIMITE = 20;
const MAX_BYTES = 2 * 1024 * 1024;
const FORMATOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function formatearFecha(valor?: string | null): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
}

/** Convierte ISO a valor de <input type="datetime-local"> en hora local. */
function aInputLocal(iso?: string | null): string {
  if (!iso) return "";
  const f = new Date(iso);
  if (isNaN(f.getTime())) return "";
  const desfase = f.getTimezoneOffset() * 60000;
  return new Date(f.getTime() - desfase).toISOString().slice(0, 16);
}

/** El backend compara contra su hora real: se envía ISO con zona. */
function aISO(valorLocal: string): string {
  return new Date(valorLocal).toISOString();
}

/** Estado de la publicación según los campos que calcula el servidor. */
function EstadoActividad({ a }: { a: ActividadParqueBackend }) {
  if (a.anulado) {
    return (
      <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
        Anulada
      </Badge>
    );
  }
  if (a.expirada) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/15"
      >
        Expirada
      </Badge>
    );
  }
  if (a.programada) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-blue-500/50 text-blue-700 dark:text-blue-400 bg-blue-500/15"
      >
        Programada
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-500/15"
    >
      Vigente
    </Badge>
  );
}

export function ModuloActividades() {
  const { puedeAccion } = useAutenticacion();
  const puedeCrear = puedeAccion("ActividadesParque", "Crear");
  const puedeEditar = puedeAccion("ActividadesParque", "Editar");
  const puedeAnular = puedeAccion("ActividadesParque", "Anular");

  const [pestana, setPestana] = useState("publicaciones");

  // El catálogo alimenta el selector del formulario. Solo se ofrecen los
  // activos: el backend rechaza con 400 asignar uno anulado.
  const [sectores, setSectores] = useState<SectorParqueBackend[]>([]);

  // Responsables: GET /usuarios exige Usuarios.Ver, permiso que un publicador
  // de actividades puede no tener. Si falla, el campo simplemente no se ofrece.
  const [usuarios, setUsuarios] = useState<UsuarioBackend[]>([]);

  const [actividades, setActividades] = useState<ActividadParqueBackend[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [soloMias, setSoloMias] = useState(false);
  const [incluirExpiradas, setIncluirExpiradas] = useState(false);
  // El servidor devuelve solo las anuladas y, como las ajenas nunca
  // se muestran, en la práctica son las propias.
  const [soloAnuladas, setSoloAnuladas] = useState(false);

  // Formulario (crear / editar)
  const [dialogo, setDialogo] = useState(false);
  const [editando, setEditando] = useState<ActividadParqueBackend | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [idSector, setIdSector] = useState<string>("");
  const [idResponsable, setIdResponsable] = useState<string>("");
  // Imágenes elegidas antes de publicar: se suben después de crear, porque
  // el endpoint de imágenes necesita el id de la actividad.
  const [archivosPendientes, setArchivosPendientes] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Visor a tamaño completo: recibe el object URL ya cargado por la miniatura,
  // así no se vuelve a descargar la imagen.
  const [imagenAmpliada, setImagenAmpliada] = useState<{
    imagen: TipoImagen;
    url: string;
  } | null>(null);

  const [aAnular, setAAnular] = useState<ActividadParqueBackend | null>(null);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);
  const [reactivandoId, setReactivandoId] = useState<number | null>(null);

  // Imágenes
  const [gestionandoImagenes, setGestionandoImagenes] =
    useState<ActividadParqueBackend | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoImagenId, setEliminandoImagenId] = useState<number | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

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
  const peticionVigenteLista = useRef(0);

  const cargar = useCallback(async () => {
    const idPeticion = ++peticionVigenteLista.current;
    setCargando(true);
    try {
      const res = await api.actividades.listar({
        buscar: busquedaAplicada || undefined,
        soloMias: soloMias || undefined,
        // Solo aplica a las propias: las ajenas expiradas nunca se muestran
        incluirExpiradas: incluirExpiradas || undefined,
        soloAnuladas: soloAnuladas || undefined,
        pagina,
        limite: LIMITE,
      });
      if (idPeticion !== peticionVigenteLista.current) return;
      setActividades(Array.isArray(res?.datos) ? res.datos : []);
      setTotal(res?.total || 0);
    } catch (err: unknown) {
      if (idPeticion !== peticionVigenteLista.current) return;
      const mensaje = err instanceof Error ? err.message : "No se pudieron cargar las actividades";
      toast.error("Error al cargar", { description: mensaje });
      setActividades([]);
      setTotal(0);
    } finally {
      if (idPeticion === peticionVigenteLista.current) setCargando(false);
    }
  }, [busquedaAplicada, soloMias, incluirExpiradas, soloAnuladas, pagina]);

  const cargarSectores = useCallback(async () => {
    try {
      setSectores(await api.sectores.listar());
    } catch {
      setSectores([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    cargarSectores();
  }, [cargarSectores]);

  useEffect(() => {
    api.usuarios
      // Alimenta un combo: el tope del backend de una vez, no la primera
      // página de 50.
      .getUsuarios(false, { limite: 200 })
      .then((res) => setUsuarios(Array.isArray(res?.datos) ? res.datos : []))
      .catch(() => setUsuarios([]));
  }, []);

  const abrirCrear = () => {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setFechaInicio("");
    setFechaFin("");
    setIdSector("");
    setIdResponsable("");
    setArchivosPendientes([]);
    setDialogo(true);
  };

  const abrirEditar = (a: ActividadParqueBackend) => {
    setEditando(a);
    setNombre(a.nombreActividad);
    setDescripcion(a.descripcionActividad);
    setFechaInicio(aInputLocal(a.fechaInicio));
    setFechaFin(aInputLocal(a.fechaFin));
    setIdSector(a.idSectorParque ? String(a.idSectorParque) : "");
    setIdResponsable(a.idUsuarioResponsable ? String(a.idUsuarioResponsable) : "");
    setArchivosPendientes([]);
    setDialogo(true);
  };

  const guardar = async () => {
    if (guardando) return;

    if (nombre.trim().length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return;
    }
    if (!descripcion.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }
    if (!fechaInicio) {
      toast.error("Indique desde cuándo se muestra la publicación");
      return;
    }
    if (fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
      toast.error("La fecha de fin debe ser posterior a la de inicio");
      return;
    }

    setGuardando(true);
    try {
      if (editando) {
        // fechaFin en null quita la expiración; el backend distingue null de omitido
        await api.actividades.actualizar(editando.id, {
          nombreActividad: nombre.trim(),
          descripcionActividad: descripcion.trim(),
          fechaInicio: aISO(fechaInicio),
          fechaFin: fechaFin ? aISO(fechaFin) : null,
          idSectorParque: idSector ? Number(idSector) : null,
          idUsuarioResponsable: idResponsable ? Number(idResponsable) : null,
        });
        toast.success("Publicación actualizada");
      } else {
        const creada = await api.actividades.crear({
          nombreActividad: nombre.trim(),
          descripcionActividad: descripcion.trim(),
          fechaInicio: aISO(fechaInicio),
          ...(fechaFin ? { fechaFin: aISO(fechaFin) } : {}),
          ...(idSector ? { idSectorParque: Number(idSector) } : {}),
          ...(idResponsable ? { idUsuarioResponsable: Number(idResponsable) } : {}),
        });

        // Las imágenes se suben una vez creada: hasta aquí no había id.
        if (archivosPendientes.length > 0) {
          let fallidas = 0;
          for (const archivo of archivosPendientes) {
            try {
              await api.actividades.subirImagen(creada.id, archivo);
            } catch {
              fallidas++;
            }
          }
          if (fallidas > 0) {
            toast.warning("Actividad publicada con imágenes pendientes", {
              description: `${fallidas} de ${archivosPendientes.length} imágenes no se subieron. Puede reintentarlo desde Administrar imágenes.`,
            });
          } else {
            toast.success("Actividad publicada con sus imágenes");
          }
        } else {
          toast.success("Actividad publicada");
        }
      }
      setDialogo(false);
      await cargar();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error("Error al guardar", { description: mensaje });
    } finally {
      setGuardando(false);
    }
  };

  const anular = useCallback(async () => {
    if (!aAnular || anulandoId !== null) return;
    setAnulandoId(aAnular.id);
    try {
      await api.actividades.anular(aAnular.id);
      toast.success("Publicación anulada", {
        description: "Deja de verse para los demás usuarios.",
      });
      setAAnular(null);
      await cargar();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo anular";
      toast.error("No se pudo anular", { description: mensaje });
    } finally {
      setAnulandoId(null);
    }
  }, [aAnular, anulandoId, cargar]);

  /**
   * Reactivar no revive la ventana de visibilidad: si la publicación ya expiró,
   * vuelve como expirada. Por eso el aviso menciona editar las fechas.
   */
  const reactivar = useCallback(
    async (a: ActividadParqueBackend) => {
      if (reactivandoId !== null) return;
      setReactivandoId(a.id);
      try {
        const activada = await api.actividades.activar(a.id);
        toast.success("Publicación reactivada", {
          description: activada.expirada
            ? "Sigue expirada: edite la fecha de fin para que vuelva a verse."
            : "Vuelve a verse para los demás usuarios.",
        });
        await cargar();
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : "No se pudo reactivar";
        toast.error("No se pudo reactivar", { description: mensaje });
      } finally {
        setReactivandoId(null);
      }
    },
    [reactivandoId, cargar],
  );

  const subirImagen = async (archivo: File) => {
    if (!gestionandoImagenes || subiendo) return;

    // Se valida antes de enviar: el backend responde 400 igual, pero así el
    // usuario ve el motivo concreto sin esperar el viaje.
    if (!FORMATOS.includes(archivo.type)) {
      toast.error("Formato no permitido", {
        description: "Solo JPEG, PNG, WebP o GIF.",
      });
      return;
    }
    if (archivo.size > MAX_BYTES) {
      toast.error("Imagen demasiado grande", { description: "El máximo es 2 MB." });
      return;
    }

    setSubiendo(true);
    try {
      await api.actividades.subirImagen(gestionandoImagenes.id, archivo);
      toast.success("Imagen subida");
      const actualizada = await api.actividades.getById(gestionandoImagenes.id);
      setGestionandoImagenes(actualizada);
      await cargar();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo subir la imagen";
      toast.error("Error al subir", { description: mensaje });
    } finally {
      setSubiendo(false);
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  };

  const eliminarImagen = async (img: TipoImagen) => {
    if (!gestionandoImagenes || eliminandoImagenId !== null) return;
    setEliminandoImagenId(img.id);
    try {
      await api.actividades.eliminarImagen(gestionandoImagenes.id, img.id);
      toast.success("Imagen eliminada");
      const actualizada = await api.actividades.getById(gestionandoImagenes.id);
      setGestionandoImagenes(actualizada);
      await cargar();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "No se pudo eliminar la imagen";
      toast.error("Error al eliminar", { description: mensaje });
    } finally {
      setEliminandoImagenId(null);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));

  return (
    <div className="space-y-6">
      {/* Los sectores no son un módulo aparte: se gobiernan con ActividadesParque */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs value={pestana} onValueChange={setPestana} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 w-full sm:w-[360px] bg-muted p-1 gap-1">
            <TabsTrigger value="publicaciones" className="gap-2 font-semibold cursor-pointer">
              <ClipboardList className="h-4 w-4 text-primary" />
              Publicaciones
            </TabsTrigger>
            <TabsTrigger value="sectores" className="gap-2 font-semibold cursor-pointer">
              <ListTree className="h-4 w-4 text-primary" />
              Sectores
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Recarga los datos sin perder filtros ni recargar el navegador */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            cargar();
            cargarSectores();
          }}
          disabled={cargando}
          className="h-9 gap-2 shrink-0 w-full sm:w-auto cursor-pointer"
        >
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {pestana === "sectores" && <CatalogoSectores onCambio={cargarSectores} />}

      {pestana === "publicaciones" && (
      <Card className="bg-card border-border/50">
        <CardHeader className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Publicaciones
            </CardTitle>
            <CardDescription>
              Solo el autor puede editar, anular o cambiar las imágenes de su publicación.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar actividad..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-muted/40 border-border/60 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="solo-mias"
                checked={soloMias}
                onCheckedChange={(v) => {
                  setSoloMias(v);
                  setPagina(1);
                }}
              />
              <Label htmlFor="solo-mias" className="text-xs cursor-pointer whitespace-nowrap">
                Solo mías
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="incluir-expiradas"
                checked={incluirExpiradas}
                onCheckedChange={(v) => {
                  setIncluirExpiradas(v);
                  setPagina(1);
                }}
              />
              <Label
                htmlFor="incluir-expiradas"
                className="text-xs cursor-pointer whitespace-nowrap"
              >
                Incluir expiradas
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="solo-anuladas"
                checked={soloAnuladas}
                onCheckedChange={(v) => {
                  setSoloAnuladas(v);
                  setPagina(1);
                }}
              />
              <Label htmlFor="solo-anuladas" className="text-xs cursor-pointer whitespace-nowrap">
                Solo anuladas
              </Label>
            </div>

            {puedeCrear && (
              <Button onClick={abrirCrear} size="sm" className="h-9 gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                Publicar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {soloAnuladas ? (
            <p className="text-[11px] text-muted-foreground mb-3">
              Solo sus publicaciones anuladas. Las anuladas de otros usuarios nunca se muestran.
            </p>
          ) : (
            incluirExpiradas && (
              <p className="text-[11px] text-muted-foreground mb-3">
                Este filtro <strong>suma</strong> publicaciones al listado, no lo reduce. Las
                expiradas y programadas solo aparecen para su autor.
              </p>
            )
          )}

          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm text-muted-foreground">Cargando actividades...</p>
            </div>
          ) : actividades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">
                {soloAnuladas
                  ? "No tiene publicaciones anuladas."
                  : "No hay publicaciones que coincidan con el filtro."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {actividades.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    a.anulado
                      ? "border-destructive/40 bg-destructive/[0.05] opacity-75"
                      : a.expirada
                        ? "border-amber-500/40 bg-amber-500/[0.05]"
                        : "border-border/60 bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{a.nombreActividad}</h3>
                        <EstadoActividad a={a} />
                        {a.esAutor && (
                          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                            Tuya
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {a.descripcionActividad}
                      </p>
                    </div>

                    {/* Editar, anular, reactivar e imágenes son exclusivos del
                        autor. Sobre una publicación anulada la única acción es
                        reactivarla, así que sin `Editar` no se ofrece el menú:
                        antes se abría vacío. */}
                    {a.esAutor &&
                      (a.anulado ? puedeEditar : puedeEditar || puedeAnular) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={anulandoId === a.id || reactivandoId === a.id}
                            className="h-8 w-8 shrink-0 cursor-pointer"
                            aria-label={`Acciones de ${a.nombreActividad}`}
                          >
                            {anulandoId === a.id || reactivandoId === a.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {puedeEditar && !a.anulado && (
                            <>
                              <DropdownMenuItem
                                onClick={() => abrirEditar(a)}
                                className="cursor-pointer"
                              >
                                <Pencil className="mr-2 h-4 w-4 text-blue-500" />
                                Editar publicación
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setGestionandoImagenes(a)}
                                className="cursor-pointer"
                              >
                                <ImagePlus className="mr-2 h-4 w-4 text-primary" />
                                Administrar imágenes
                              </DropdownMenuItem>
                            </>
                          )}
                          {puedeAnular && !a.anulado && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setAAnular(a)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Anular publicación
                              </DropdownMenuItem>
                            </>
                          )}
                          {puedeEditar && a.anulado && (
                            <DropdownMenuItem
                              onClick={() => reactivar(a)}
                              disabled={reactivandoId === a.id}
                              className="cursor-pointer"
                            >
                              <RotateCcw className="mr-2 h-4 w-4 text-primary" />
                              Reactivar publicación
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {a.imagenes && a.imagenes.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {a.imagenes.map((img) => (
                        <ImagenActividad
                          key={img.id}
                          idActividad={a.id}
                          imagen={img}
                          onAmpliar={(imagen, url) => setImagenAmpliada({ imagen, url })}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatearFecha(a.fechaInicio)}
                      {a.fechaFin ? ` → ${formatearFecha(a.fechaFin)}` : " · sin expiración"}
                    </span>
                    {a.autor && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {a.autor.nombre}
                      </span>
                    )}
                    {a.responsable && (
                      <span className="flex items-center gap-1">
                        Responsable: {a.responsable.nombre}
                      </span>
                    )}
                    {a.sector && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {a.sector.nombre}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > LIMITE && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Página {pagina} de {totalPaginas} · {total} publicaciones
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
        </CardContent>
      </Card>
      )}

      {/* Crear / editar */}
      <Dialog open={dialogo} onOpenChange={(v) => !guardando && setDialogo(v)}>
        <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editando ? "Editar publicación" : "Publicar actividad"}
            </DialogTitle>
            <DialogDescription>
              La ventana de fechas define desde y hasta cuándo la ven los demás.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="act-nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="act-nombre"
                placeholder="Ej. Jornada de reforestación"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={255}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="act-desc">
                Descripción <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="act-desc"
                placeholder="Detalle de la actividad, requisitos, punto de reunión..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={5000}
                className="min-h-[110px] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="act-inicio">
                  Visible desde <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="act-inicio"
                  type="datetime-local"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-fin">Visible hasta</Label>
                <Input
                  id="act-fin"
                  type="datetime-local"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">
                  Vacío = la publicación no expira.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="act-sector">Sector</Label>
              {/* Solo se listan los activos: asignar uno dado de baja da 400 */}
              <Select
                value={idSector || "ninguno"}
                onValueChange={(v) => setIdSector(v === "ninguno" ? "" : v)}
              >
                <SelectTrigger id="act-sector" className="h-10">
                  <SelectValue placeholder="Sin sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin sector</SelectItem>
                  {sectores
                    .filter((s) => !s.anulado)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {sectores.filter((s) => !s.anulado).length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No hay sectores activos. Créelos en la pestaña Sectores.
                </p>
              )}
            </div>

            {/* El responsable ejecuta la actividad; no otorga permiso de edición.
                Solo se ofrece si se pudo leer el listado de usuarios. */}
            {usuarios.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="act-responsable">Responsable</Label>
                <Select
                  value={idResponsable || "ninguno"}
                  onValueChange={(v) => setIdResponsable(v === "ninguno" ? "" : v)}
                >
                  <SelectTrigger id="act-responsable" className="h-10">
                    <SelectValue placeholder="Sin responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Sin responsable</SelectItem>
                    {usuarios
                      .filter((u) => !u.anulado)
                      .map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Quien ejecuta la actividad. No puede editar la publicación: eso queda con el
                  autor.
                </p>
              </div>
            )}

            {/* Solo al crear: al editar se usa Administrar imágenes, que ya
                trabaja contra el id existente. */}
            {!editando && (
              <div className="space-y-1.5">
                <Label htmlFor="act-imagenes">Imágenes (opcional)</Label>
                <Input
                  id="act-imagenes"
                  type="file"
                  multiple
                  accept={FORMATOS.join(",")}
                  onChange={(e) => {
                    const elegidos = Array.from(e.target.files || []);
                    const validos = elegidos.filter((f) => {
                      if (!FORMATOS.includes(f.type)) {
                        toast.error(`${f.name}: formato no permitido`);
                        return false;
                      }
                      if (f.size > MAX_BYTES) {
                        toast.error(`${f.name}: supera los 2 MB`);
                        return false;
                      }
                      return true;
                    });
                    setArchivosPendientes(validos);
                  }}
                  className="h-10 cursor-pointer file:cursor-pointer file:text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {archivosPendientes.length > 0
                    ? `${archivosPendientes.length} imagen${
                        archivosPendientes.length === 1 ? "" : "es"
                      } se subirán al publicar.`
                    : "JPEG, PNG, WebP o GIF, hasta 2 MB cada una."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogo(false)}
              disabled={guardando}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="gap-2 cursor-pointer"
            >
              {guardando ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editando ? "Guardar cambios" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imágenes */}
      <Dialog
        open={gestionandoImagenes !== null}
        onOpenChange={(v) => {
          if (!v && !subiendo && eliminandoImagenId === null) setGestionandoImagenes(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base">Imágenes de la publicación</DialogTitle>
            <DialogDescription>
              JPEG, PNG, WebP o GIF, hasta 2 MB. Eliminar una imagen la borra definitivamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={inputArchivo}
              type="file"
              accept={FORMATOS.join(",")}
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) subirImagen(archivo);
              }}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => inputArchivo.current?.click()}
              disabled={subiendo}
              className="w-full gap-2 cursor-pointer"
            >
              {subiendo ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
              Subir imagen
            </Button>

            {!gestionandoImagenes?.imagenes?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Esta publicación aún no tiene imágenes.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {gestionandoImagenes.imagenes.map((img) => (
                  <ImagenActividad
                    key={img.id}
                    idActividad={gestionandoImagenes.id}
                    imagen={img}
                    onEliminar={eliminarImagen}
                    eliminando={eliminandoImagenId === img.id}
                    onAmpliar={(imagen, url) => setImagenAmpliada({ imagen, url })}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visor a tamaño completo */}
      <Dialog
        open={imagenAmpliada !== null}
        onOpenChange={(v) => {
          if (!v) setImagenAmpliada(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl p-3 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{imagenAmpliada?.imagen.nombreOriginal || "Imagen"}</DialogTitle>
          </DialogHeader>

          {imagenAmpliada && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagenAmpliada.url}
                alt={imagenAmpliada.imagen.nombreOriginal}
                className="w-full max-h-[75vh] object-contain rounded-lg bg-muted/30"
              />
              <p className="text-xs text-muted-foreground text-center truncate">
                {imagenAmpliada.imagen.nombreOriginal}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <AlertDialog
        open={aAnular !== null}
        onOpenChange={(v) => {
          if (!v && anulandoId === null) setAAnular(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-3rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Anular esta publicación?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{aAnular?.nombreActividad}</strong> dejará de verse para los demás usuarios.
              Es una baja lógica: la publicación y sus imágenes se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
