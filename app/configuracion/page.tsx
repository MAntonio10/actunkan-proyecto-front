'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Hash } from 'lucide-react'
import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type { CorrelativoSerie } from '@/tipos'

const NOMBRE_SERIE: Record<CorrelativoSerie['serie'], string> = {
  ERC: 'Extranjero · Recorrido corto',
  ERL: 'Extranjero · Recorrido largo',
  NRC: 'Nacional · Recorrido corto',
  NRL: 'Nacional · Recorrido largo',
}

const folio = (serie: string, numero: number) => `${serie}-${String(numero).padStart(4, '0')}`

export default function ConfiguracionPage() {
  const { puedeAccion } = useAutenticacion()
  const puedeEditar = puedeAccion('Configuracion', 'Editar')
  const [series, setSeries] = useState<CorrelativoSerie[] | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setSeries(await api.configuracion.getCorrelativos())
    } catch (err: unknown) {
      toast.error('No se pudieron cargar los correlativos', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async (s: CorrelativoSerie) => {
    const inicio = Number(valores[s.serie])
    // El backend también lo rechaza; aquí solo se evita el viaje.
    if (!Number.isInteger(inicio) || inicio < s.siguiente) {
      toast.error('Número no válido', {
        description: `Debe ser un entero igual o mayor a ${s.siguiente}: no se puede volver a un número menor.`,
      })
      return
    }
    // Irreversible: después no se podrá volver a un número menor.
    if (!window.confirm(`¿Fijar ${folio(s.serie, inicio)} como próximo ticket? No se podrá volver a un número menor.`)) return
    setGuardando(s.serie)
    try {
      await api.configuracion.fijarCorrelativo({ serie: s.serie, inicio })
      toast.success(`Serie ${s.serie} actualizada`, {
        description: `El próximo ticket será ${folio(s.serie, inicio)}.`,
      })
      setValores((prev) => ({ ...prev, [s.serie]: '' }))
      await cargar()
    } catch (err: unknown) {
      toast.error('No se pudo guardar', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setGuardando(null)
    }
  }

  return (
    <RutaProtegida moduloRequerido="Configuracion">
      <div className="min-h-screen flex flex-col">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-3xl">
          <div className="mb-6">
            <div className="titulo-seccion">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Configuración y Ajustes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Parámetros del sistema que el personal puede ajustar
              </p>
            </div>
          </div>

          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Hash className="h-5 w-5 text-primary" />
                Correlativos de tickets (Cuevas)
              </CardTitle>
              <CardDescription>
                Defina desde qué número continúa cada serie. Una vez fijado, no se puede volver a un
                número menor: eso repetiría folios ya emitidos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!series ? (
                <div className="flex justify-center py-8">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {series.map((s) => (
                    <div
                      key={s.serie}
                      className="py-4 flex flex-col sm:flex-row sm:items-end gap-3 justify-between"
                    >
                      <div>
                        <p className="font-semibold">
                          {s.serie} <span className="font-normal text-muted-foreground">· {NOMBRE_SERIE[s.serie]}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Próximo ticket:{' '}
                          <span className="font-mono font-semibold text-foreground">
                            {folio(s.serie, s.siguiente)}
                          </span>
                        </p>
                      </div>
                      {puedeEditar && (
                        <div className="flex items-end gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`inicio-${s.serie}`} className="text-xs text-muted-foreground">
                              Nuevo número inicial
                            </Label>
                            <Input
                              id={`inicio-${s.serie}`}
                              type="number"
                              inputMode="numeric"
                              min={s.siguiente}
                              step={1}
                              placeholder={String(s.siguiente)}
                              value={valores[s.serie] ?? ''}
                              onChange={(e) => setValores((prev) => ({ ...prev, [s.serie]: e.target.value }))}
                              className="w-32"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => guardar(s)}
                            disabled={!valores[s.serie] || guardando !== null}
                            className="cursor-pointer"
                          >
                            {guardando === s.serie && <Spinner className="mr-1.5 h-4 w-4" />}
                            Guardar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </RutaProtegida>
  )
}
