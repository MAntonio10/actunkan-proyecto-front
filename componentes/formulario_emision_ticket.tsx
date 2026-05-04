'use client'

import { ChevronRight, Minus, Plus, TreePine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { type TipoAcceso, PRECIO_APORTE_REFORESTACION } from '@/tipos'
import { type DatosTicket } from './panel_emision'

interface FormularioEmisionTicketProps {
  datos: DatosTicket
  tiposAcceso: TipoAcceso[]
  tipoSeleccionado: TipoAcceso
  calculos: {
    montoBase: number
    montoAporte: number
    montoTotal: number
  }
  onActualizar: (datos: Partial<DatosTicket>) => void
  onEmitir: () => void
}

export function FormularioEmisionTicket({
  datos,
  tiposAcceso,
  tipoSeleccionado,
  calculos,
  onActualizar,
  onEmitir,
}: FormularioEmisionTicketProps) {
  const incrementarCantidad = () => {
    onActualizar({ cantidad: Math.min(datos.cantidad + 1, 50) })
  }

  const decrementarCantidad = () => {
    onActualizar({ cantidad: Math.max(datos.cantidad - 1, 1) })
  }

  return (
    <div className="space-y-6">
      {/* Campo: Nombre del visitante / grupo */}
      <div className="space-y-2">
        <Label
          htmlFor="nombre_visitante"
          className="text-xs uppercase tracking-wider text-muted-foreground"
        >
          Nombre del Visitante / Grupo
        </Label>
        <Input
          id="nombre_visitante"
          placeholder="Ej. Familia Rodriguez"
          value={datos.nombre_visitante_grupo}
          onChange={(e) => onActualizar({ nombre_visitante_grupo: e.target.value })}
          className="bg-background/50 border-border/50 h-12 text-base"
        />
      </div>

      {/* Fila: Tipo de acceso + Cantidad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo de acceso */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Tipo de Acceso
          </Label>
          <Select
            value={datos.tipo_acceso_id}
            onValueChange={(value) => onActualizar({ tipo_acceso_id: value })}
          >
            <SelectTrigger className="bg-background/50 border-border/50 h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposAcceso.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nombre} (${tipo.precio})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cantidad */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Cantidad
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={decrementarCantidad}
              disabled={datos.cantidad <= 1}
              className="h-12 w-12 border-border/50"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="flex-1 h-12 flex items-center justify-center bg-background/50 border border-border/50 rounded-md text-xl font-semibold">
              {datos.cantidad}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={incrementarCantidad}
              disabled={datos.cantidad >= 50}
              className="h-12 w-12 border-border/50"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Checkbox: Aporte para reforestacion */}
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border transition-colors',
          datos.aporte_reforestacion
            ? 'border-primary/50 bg-primary/5'
            : 'border-border/50 bg-background/30'
        )}
      >
        <Checkbox
          id="aporte_reforestacion"
          checked={datos.aporte_reforestacion}
          onCheckedChange={(checked) =>
            onActualizar({ aporte_reforestacion: checked === true })
          }
          className="mt-0.5"
        />
        <div className="flex-1">
          <Label
            htmlFor="aporte_reforestacion"
            className="font-medium cursor-pointer flex items-center gap-2"
          >
            <TreePine className="h-4 w-4 text-primary" />
            Aporte para Reforestacion (+${PRECIO_APORTE_REFORESTACION} por ticket)
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Colabora con la siembra de arboles nativos en las zonas afectadas.
          </p>
        </div>
      </div>

      {/* Boton de emitir */}
      <Button
        onClick={onEmitir}
        className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        EMITIR TICKET
        <ChevronRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  )
}
