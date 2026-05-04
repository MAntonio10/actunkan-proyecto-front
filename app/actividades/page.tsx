'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ClipboardList,
  Plus,
  X,
  Calendar,
  MapPin,
  User,
  FileText,
  ImagePlus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import {
  type ActividadParque,
  type SectorParque,
  SECTORES_PARQUE,
  ACTIVIDADES_DEMO,
} from '@/tipos'

// ---- Schema de validacion ----
const esquemaActividad = z.object({
  nombre_actividad: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  sector: z.string().min(1, 'Seleccione un sector'),
  fecha_realizacion: z.string().min(1, 'Seleccione una fecha'),
  descripcion: z.string().min(10, 'La descripcion debe tener al menos 10 caracteres'),
  planificacion: z.string().optional(),
  responsable: z.string().min(2, 'Ingrese el nombre del responsable'),
})

type FormActividad = z.infer<typeof esquemaActividad>

// ---- Helpers ----
function etiquetaSector(sector: SectorParque): string {
  return SECTORES_PARQUE.find((s) => s.valor === sector)?.etiqueta ?? sector
}

function colorSector(sector: SectorParque): string {
  const mapa: Record<SectorParque, string> = {
    cavernas_principales: 'bg-primary/15 text-primary border-primary/30',
    sendero_norte: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    sendero_sur: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    zona_arqueologica: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    area_administrativa: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    estacionamiento: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    taquilla: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    area_picnic: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
    otro: 'bg-muted text-muted-foreground border-border',
  }
  return mapa[sector] ?? 'bg-muted text-muted-foreground border-border'
}

// ---- Tarjeta de actividad ----
function TarjetaActividad({
  actividad,
  onEliminar,
}: {
  actividad: ActividadParque
  onEliminar: (id: string) => void
}) {
  const [expandida, setExpandida] = useState(false)

  return (
    <Card className="border-border/60 bg-card/60 hover:bg-card/80 transition-colors">
      <CardContent className="p-0">
        {/* Imagen si existe */}
        {actividad.imagen_url && (
          <div className="h-40 overflow-hidden rounded-t-xl">
            <img
              src={actividad.imagen_url}
              alt={actividad.nombre_actividad}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {actividad.nombre_actividad}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={`text-xs ${colorSector(actividad.sector)}`}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {etiquetaSector(actividad.sector)}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(actividad.fecha_realizacion, "d 'de' MMMM yyyy", { locale: es })}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={() => onEliminar(actividad.id)}
              aria-label="Eliminar actividad"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Responsable */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{actividad.responsable}</span>
          </div>

          {/* Descripcion */}
          <p className={`text-sm text-muted-foreground leading-relaxed ${!expandida ? 'line-clamp-2' : ''}`}>
            {actividad.descripcion}
          </p>

          {/* Planificacion (expandible) */}
          {actividad.planificacion && (
            <div className="border-t border-border/40 pt-3">
              <button
                onClick={() => setExpandida(!expandida)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <FileText className="h-3.5 w-3.5" />
                {expandida ? 'Ocultar planificacion' : 'Ver planificacion'}
                {expandida ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {expandida && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                  {actividad.planificacion}
                </p>
              )}
            </div>
          )}

          {/* Fecha de registro */}
          <p className="text-xs text-muted-foreground/60 pt-1">
            Registrado el {format(actividad.fecha_registro, "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Formulario en Sheet ----
function FormularioActividad({
  abierto,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean
  onCerrar: () => void
  onGuardar: (datos: FormActividad, imagen: File | null) => void
}) {
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [imagenFile, setImagenFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormActividad>({
    resolver: zodResolver(esquemaActividad),
    defaultValues: {
      fecha_realizacion: new Date().toISOString().split('T')[0],
    },
  })

  const handleImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5 MB')
      return
    }
    setImagenFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagenPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const eliminarImagen = () => {
    setImagenPreview(null)
    setImagenFile(null)
  }

  const onSubmit = (datos: FormActividad) => {
    onGuardar(datos, imagenFile)
    reset()
    setImagenPreview(null)
    setImagenFile(null)
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) onCerrar() }}>
      <DialogContent className="w-full max-w-lg bg-background p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Nueva Actividad
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Complete los datos de la actividad realizada en el parque.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90svh-8rem)]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-5">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="nombre_actividad">Nombre de la actividad <span className="text-destructive">*</span></Label>
              <Input
                id="nombre_actividad"
                placeholder="Ej. Limpieza de sendero norte"
                {...register('nombre_actividad')}
              />
              {errors.nombre_actividad && (
                <p className="text-xs text-destructive">{errors.nombre_actividad.message}</p>
              )}
            </div>

            {/* Sector */}
            <div className="space-y-1.5">
              <Label htmlFor="sector">Sector del parque <span className="text-destructive">*</span></Label>
              <Select onValueChange={(v) => setValue('sector', v)}>
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Seleccionar sector..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTORES_PARQUE.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sector && (
                <p className="text-xs text-destructive">{errors.sector.message}</p>
              )}
            </div>

            {/* Fecha + Responsable en grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_realizacion">Fecha <span className="text-destructive">*</span></Label>
                <Input
                  id="fecha_realizacion"
                  type="date"
                  {...register('fecha_realizacion')}
                  className="[color-scheme:dark]"
                />
                {errors.fecha_realizacion && (
                  <p className="text-xs text-destructive">{errors.fecha_realizacion.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsable">Responsable <span className="text-destructive">*</span></Label>
                <Input
                  id="responsable"
                  placeholder="Nombre completo"
                  {...register('responsable')}
                />
                {errors.responsable && (
                  <p className="text-xs text-destructive">{errors.responsable.message}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Descripcion */}
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripcion detallada <span className="text-destructive">*</span></Label>
              <Textarea
                id="descripcion"
                placeholder="Describe lo realizado durante la actividad..."
                rows={3}
                className="resize-none"
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="text-xs text-destructive">{errors.descripcion.message}</p>
              )}
            </div>

            {/* Planificacion */}
            <div className="space-y-1.5">
              <Label htmlFor="planificacion">Planificacion <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Textarea
                id="planificacion"
                placeholder="Detalles de planificacion, periodicidad, coordinacion..."
                rows={2}
                className="resize-none"
                {...register('planificacion')}
              />
            </div>

            {/* Imagen */}
            <div className="space-y-1.5">
              <Label>Imagen <span className="text-xs text-muted-foreground">(opcional, max 5 MB)</span></Label>
              {imagenPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img
                    src={imagenPreview}
                    alt="Vista previa"
                    className="w-full h-40 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={eliminarImagen}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="imagen_actividad"
                  className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Toca para subir imagen</span>
                  <input
                    id="imagen_actividad"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleImagen}
                  />
                </label>
              )}
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2 pb-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-primary text-primary-foreground" disabled={isSubmitting}>
                Guardar Actividad
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ---- Pagina principal ----
export default function ActividadesPage() {
  const [actividades, setActividades] = useState<ActividadParque[]>(ACTIVIDADES_DEMO)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [filtroSector, setFiltroSector] = useState<string>('todos')

  const actividadesFiltradas = filtroSector === 'todos'
    ? actividades
    : actividades.filter((a) => a.sector === filtroSector)

  const handleGuardar = (datos: FormActividad, imagen: File | null) => {
    const nueva: ActividadParque = {
      id: `act-${Date.now()}`,
      nombre_actividad: datos.nombre_actividad,
      sector: datos.sector as SectorParque,
      fecha_realizacion: new Date(datos.fecha_realizacion),
      descripcion: datos.descripcion,
      planificacion: datos.planificacion || undefined,
      responsable: datos.responsable,
      imagen_url: imagen ? URL.createObjectURL(imagen) : undefined,
      fecha_registro: new Date(),
      usuario_registro_id: '1',
    }
    setActividades((prev) => [nueva, ...prev])
    setFormularioAbierto(false)
    toast.success('Actividad registrada correctamente')
  }

  const handleEliminar = (id: string) => {
    setActividades((prev) => prev.filter((a) => a.id !== id))
    toast.success('Actividad eliminada')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <BarraNavegacionSuperior />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Registro de Actividades
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Uso interno — actividades realizadas en el parque
            </p>
          </div>
          <Button
            onClick={() => setFormularioAbierto(true)}
            className="bg-primary text-primary-foreground gap-2 flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva Actividad</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>

        {/* Filtro por sector */}
        <div className="mb-5 overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            <Button
              variant={filtroSector === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroSector('todos')}
              className={filtroSector === 'todos' ? 'bg-primary text-primary-foreground' : ''}
            >
              Todos ({actividades.length})
            </Button>
            {SECTORES_PARQUE.filter((s) =>
              actividades.some((a) => a.sector === s.valor)
            ).map((s) => (
              <Button
                key={s.valor}
                variant={filtroSector === s.valor ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroSector(s.valor)}
                className={filtroSector === s.valor ? 'bg-primary text-primary-foreground' : ''}
              >
                {s.etiqueta}
              </Button>
            ))}
          </div>
        </div>

        {/* Lista de actividades */}
        {actividadesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">No hay actividades registradas</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {filtroSector === 'todos'
                ? 'Presione "Nueva Actividad" para registrar la primera.'
                : 'No hay actividades para este sector.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actividadesFiltradas.map((actividad) => (
              <TarjetaActividad
                key={actividad.id}
                actividad={actividad}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        )}
      </main>

      <FormularioActividad
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        onGuardar={handleGuardar}
      />
    </div>
  )
}
