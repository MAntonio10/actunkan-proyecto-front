'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Minus, Plus, Ticket, Trees } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'

import {
  NACIONALIDADES,
  TIPOS_RECORRIDO,
  type Nacionalidad,
  type TipoRecorrido,
  type TipoAcceso,
} from '@/tipos'

// Precios base por tipo de recorrido + tipo de visitante
const PRECIOS = {
  corto: { nacional: 15, extranjero: 30 },
  largo: { nacional: 25, extranjero: 50 },
}
const PRECIO_APORTE_REFORESTACION = 2

const NACIONALIDADES_EXTRANJERAS: Nacionalidad[] = [
  'estadounidense',
  'europeo',
  'sudamericano',
  'otro',
]

const esquema = z.object({
  nombre_grupo: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  nacionalidad: z.enum(
    ['guatemalteco', 'mexicano', 'estadounidense', 'europeo', 'centroamericano', 'sudamericano', 'otro'] as const
  ),
  tipo_recorrido: z.enum(['corto', 'largo'] as const),
  cantidad_personas: z.number().min(1).max(100),
  aporte_reforestacion: z.boolean(),
  notas: z.string().optional(),
})

type FormValues = z.infer<typeof esquema>

export interface DatosTicketPreview {
  nombreVisitante: string
  tipoAcceso: TipoAcceso
  cantidadPersonas: number
  montoTotal: number
}

interface Props {
  onDatosChange?: (datos: DatosTicketPreview) => void
}

export function FormularioVisitanteCompleto({ onDatosChange }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [cantidad, setCantidad] = useState(1)
  const [aporte, setAporte] = useState(false)

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
      nombre_grupo: '',
      nacionalidad: 'guatemalteco',
      tipo_recorrido: 'corto',
      cantidad_personas: 1,
      aporte_reforestacion: false,
      notas: '',
    },
  })

  const nombreGrupo = watch('nombre_grupo')
  const nacionalidad = watch('nacionalidad')
  const tipoRecorrido = watch('tipo_recorrido')

  // Calculo de precios reactivo
  const calculos = useMemo(() => {
    const esExtranjero = NACIONALIDADES_EXTRANJERAS.includes(nacionalidad)
    const categoria: 'nacional' | 'extranjero' = esExtranjero ? 'extranjero' : 'nacional'
    const precioUnitario = PRECIOS[tipoRecorrido][categoria]
    const montoBase = precioUnitario * cantidad
    const montoAporte = aporte ? PRECIO_APORTE_REFORESTACION * cantidad : 0
    const montoTotal = montoBase + montoAporte

    const nombreTipo =
      tipoRecorrido === 'corto'
        ? esExtranjero
          ? 'Entrada Corta Extranjero'
          : 'Entrada Corta'
        : esExtranjero
          ? 'Entrada Completa Extranjero'
          : 'Entrada Completa'

    const tipoAcceso: TipoAcceso = {
      id: `${categoria}-${tipoRecorrido}`,
      nombre: nombreTipo,
      precio: precioUnitario,
      descripcion: tipoRecorrido === 'corto' ? 'Recorrido 45 min' : 'Recorrido 2 horas',
    }

    return { precioUnitario, montoBase, montoAporte, montoTotal, tipoAcceso, esExtranjero }
  }, [nacionalidad, tipoRecorrido, cantidad, aporte])

  // Propagar cambios para el preview en tiempo real
  useEffect(() => {
    onDatosChange?.({
      nombreVisitante: nombreGrupo,
      tipoAcceso: calculos.tipoAcceso,
      cantidadPersonas: cantidad,
      montoTotal: calculos.montoTotal,
    })
  }, [nombreGrupo, cantidad, calculos.montoTotal, calculos.tipoAcceso, onDatosChange])

  const ajustarCantidad = (delta: number) => {
    const nueva = Math.max(1, Math.min(100, cantidad + delta))
    setCantidad(nueva)
    setValue('cantidad_personas', nueva)
  }

  const alternarAporte = (valor: boolean) => {
    setAporte(valor)
    setValue('aporte_reforestacion', valor)
  }

  const onSubmit = async (datos: FormValues) => {
    setEnviando(true)
    await new Promise((r) => setTimeout(r, 800))

    toast.success('Ticket emitido y visitante registrado', {
      description: `${datos.nombre_grupo} · ${datos.cantidad_personas} personas · $${calculos.montoTotal.toFixed(2)}`,
    })

    reset()
    setCantidad(1)
    setAporte(false)
    setEnviando(false)
  }

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
            <Label htmlFor="nombre_grupo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre del Visitante / Grupo
            </Label>
            <Input
              id="nombre_grupo"
              placeholder="Ej. Familia Rodriguez"
              className="bg-muted/50 border-border/50 h-11"
              {...register('nombre_grupo')}
            />
            {errors.nombre_grupo && (
              <p className="text-sm text-destructive">{errors.nombre_grupo.message}</p>
            )}
          </div>

          {/* Nacionalidad + Tipo recorrido en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Nacionalidad
              </Label>
              <Select
                defaultValue="guatemalteco"
                onValueChange={(v) => setValue('nacionalidad', v as Nacionalidad)}
              >
                <SelectTrigger className="bg-muted/50 border-border/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NACIONALIDADES.map((n) => (
                    <SelectItem key={n.valor} value={n.valor}>
                      {n.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Cantidad de Personas
              </Label>
              <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-md h-11 px-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={() => ajustarCantidad(-1)}
                  disabled={cantidad <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-lg font-bold">{cantidad}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={() => ajustarCantidad(1)}
                  disabled={cantidad >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tipo de recorrido */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de Recorrido
            </Label>
            <RadioGroup
              defaultValue="corto"
              onValueChange={(v) => setValue('tipo_recorrido', v as TipoRecorrido)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {TIPOS_RECORRIDO.map((tipo) => (
                <div key={tipo.valor} className="relative">
                  <RadioGroupItem value={tipo.valor} id={tipo.valor} className="peer sr-only" />
                  <Label
                    htmlFor={tipo.valor}
                    className={`flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      tipoRecorrido === tipo.valor
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 bg-muted/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tipo.etiqueta}</span>
                      <span className="text-sm font-bold">
                        ${PRECIOS[tipo.valor][calculos.esExtranjero ? 'extranjero' : 'nacional']}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{tipo.descripcion}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Aporte reforestacion */}
          <div
            className={`flex items-start gap-3 rounded-lg border-2 p-3 transition-all ${
              aporte ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/20'
            }`}
          >
            <Checkbox
              id="aporte_reforestacion"
              checked={aporte}
              onCheckedChange={(v) => alternarAporte(Boolean(v))}
              className="mt-0.5"
            />
            <label htmlFor="aporte_reforestacion" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <Trees className="h-4 w-4 text-primary" />
                Aporte para Reforestacion (+${PRECIO_APORTE_REFORESTACION} por ticket)
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Colabora con la siembra de arboles nativos en las zonas afectadas.
              </p>
            </label>
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
              {...register('notas')}
            />
          </div>

          <Separator />

          {/* Resumen de total */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total a pagar</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ${calculos.precioUnitario}
                {aporte ? ` + $${PRECIO_APORTE_REFORESTACION}` : ''} x {cantidad}{' '}
                {cantidad === 1 ? 'persona' : 'personas'}
              </p>
            </div>
            <p className="text-3xl font-bold text-primary">${calculos.montoTotal.toFixed(2)}</p>
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
  )
}
