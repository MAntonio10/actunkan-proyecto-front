'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Minus, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

import { 
  NACIONALIDADES, 
  TIPOS_RECORRIDO,
  type Nacionalidad,
  type TipoRecorrido,
  type Visitante,
} from '@/tipos'

const esquemaVisitante = z.object({
  nombre_grupo: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  nacionalidad: z.enum(['guatemalteco', 'mexicano', 'estadounidense', 'europeo', 'centroamericano', 'sudamericano', 'otro'] as const),
  tipo_recorrido: z.enum(['corto', 'largo'] as const),
  cantidad_personas: z.number().min(1, 'Minimo 1 persona').max(100, 'Maximo 100 personas'),
  notas: z.string().optional(),
})

type FormularioVisitante = z.infer<typeof esquemaVisitante>

interface FormularioRegistroVisitantesProps {
  onRegistroExitoso?: (visitante: Visitante) => void
}

export function FormularioRegistroVisitantes({ onRegistroExitoso }: FormularioRegistroVisitantesProps) {
  const [enviando, setEnviando] = useState(false)
  const [cantidadPersonas, setCantidadPersonas] = useState(1)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormularioVisitante>({
    resolver: zodResolver(esquemaVisitante),
    defaultValues: {
      nombre_grupo: '',
      nacionalidad: 'guatemalteco',
      tipo_recorrido: 'corto',
      cantidad_personas: 1,
      notas: '',
    },
  })

  const tipoRecorridoActual = watch('tipo_recorrido')

  const ajustarCantidad = (delta: number) => {
    const nuevaCantidad = Math.max(1, Math.min(100, cantidadPersonas + delta))
    setCantidadPersonas(nuevaCantidad)
    setValue('cantidad_personas', nuevaCantidad)
  }

  const onSubmit = async (datos: FormularioVisitante) => {
    setEnviando(true)
    
    // Simular envio al servidor
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const nuevoVisitante: Visitante = {
      id: `VIS-${Date.now()}`,
      nombre_grupo: datos.nombre_grupo,
      nacionalidad: datos.nacionalidad,
      cantidad_personas: datos.cantidad_personas,
      tipo_recorrido: datos.tipo_recorrido,
      fecha_registro: new Date(),
      notas: datos.notas,
    }
    
    toast.success('Visitante registrado exitosamente', {
      description: `${nuevoVisitante.nombre_grupo} - ${nuevoVisitante.cantidad_personas} personas`,
    })
    
    onRegistroExitoso?.(nuevoVisitante)
    
    // Resetear formulario
    reset()
    setCantidadPersonas(1)
    setEnviando(false)
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" />
          Registro de Nuevo Visitante
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nombre del visitante/grupo */}
          <div className="space-y-2">
            <Label htmlFor="nombre_grupo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre del Visitante / Grupo
            </Label>
            <Input
              id="nombre_grupo"
              placeholder="Ej. Familia Rodriguez"
              className="bg-muted/50 border-border/50 h-12"
              {...register('nombre_grupo')}
            />
            {errors.nombre_grupo && (
              <p className="text-sm text-destructive">{errors.nombre_grupo.message}</p>
            )}
          </div>

          {/* Nacionalidad */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Nacionalidad
            </Label>
            <Select
              defaultValue="guatemalteco"
              onValueChange={(valor) => setValue('nacionalidad', valor as Nacionalidad)}
            >
              <SelectTrigger className="bg-muted/50 border-border/50 h-12">
                <SelectValue placeholder="Seleccionar nacionalidad" />
              </SelectTrigger>
              <SelectContent>
                {NACIONALIDADES.map((nac) => (
                  <SelectItem key={nac.valor} value={nac.valor}>
                    {nac.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.nacionalidad && (
              <p className="text-sm text-destructive">{errors.nacionalidad.message}</p>
            )}
          </div>

          {/* Tipo de recorrido */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de Recorrido
            </Label>
            <RadioGroup
              defaultValue="corto"
              onValueChange={(valor) => setValue('tipo_recorrido', valor as TipoRecorrido)}
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
                    className={`
                      flex flex-col gap-1 p-4 rounded-lg border-2 cursor-pointer transition-all
                      peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2
                      ${tipoRecorridoActual === tipo.valor 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border/50 bg-muted/30 hover:border-primary/50'
                      }
                    `}
                  >
                    <span className="font-medium">{tipo.etiqueta}</span>
                    <span className="text-xs text-muted-foreground">{tipo.descripcion}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Cantidad de personas */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Cantidad de Personas
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 border-border/50"
                onClick={() => ajustarCantidad(-1)}
                disabled={cantidadPersonas <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold">{cantidadPersonas}</span>
                <span className="text-muted-foreground ml-2">personas</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 border-border/50"
                onClick={() => ajustarCantidad(1)}
                disabled={cantidadPersonas >= 100}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <input type="hidden" {...register('cantidad_personas', { valueAsNumber: true })} value={cantidadPersonas} />
          </div>

          {/* Notas adicionales */}
          <div className="space-y-2">
            <Label htmlFor="notas" className="text-xs uppercase tracking-wider text-muted-foreground">
              Notas Adicionales (Opcional)
            </Label>
            <Textarea
              id="notas"
              placeholder="Ej. Grupo escolar, requiere accesibilidad, etc."
              className="bg-muted/50 border-border/50 min-h-[80px]"
              {...register('notas')}
            />
          </div>

          {/* Boton de envio */}
          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
            disabled={enviando}
          >
            {enviando ? (
              <>
                <Spinner className="mr-2 h-5 w-5" />
                Registrando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" />
                Registrar Visitante
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
