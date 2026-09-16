'use client'

import { useMemo, useState } from 'react'

import type { MonoPoint } from '@/components/mono-charts/mono-chart-base'
import {
  GraficaMono,
  SelectorTipoGrafica,
  TIPOS_GRAFICA,
  type TipoGrafica,
} from '@/componentes/grafica_mono'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  esColumnaNumerica,
  esColumnaTemporal,
  formatearCelda,
  formateadorDeColumna,
  valorNumerico,
} from '@/lib/formato_reporte'
import type { ColumnaReporte, SeccionReporte } from '@/tipos'

/**
 * Gráfica de una sección de reporte.
 *
 * Como la tabla, no conoce ningún reporte en concreto: mira `seccion.columnas`
 * y deduce qué se puede dibujar. Esa es la única forma de que los 18 reportes
 * —y los que se agreguen— tengan gráfica sin tocar esta pantalla.
 *
 * Reglas de la deducción:
 *  - **Categoría**: la primera columna no numérica. Sin ella no hay gráfica.
 *  - **Serie**: las columnas numéricas; el usuario elige cuál si hay varias.
 *    Se prefiere la de dinero, que es lo que casi siempre se quiere ver.
 *  - **Tipo por omisión**: línea si la categoría es una fecha (es una serie en
 *    el tiempo), dona si hay pocas categorías, barras en el resto.
 *  - Con valores negativos —la diferencia de un arqueo— se ocultan dona y
 *    embudo: un anillo de partes de un todo con un trozo negativo no significa
 *    nada.
 */

const MAX_PUNTOS_LINEA = 60
const MAX_BARRAS = 14
const MAX_PORCIONES = 6
const MAX_ETAPAS = 8

/** Ordena las candidatas a serie: primero el dinero, luego el resto. */
function ordenarNumericas(columnas: ColumnaReporte[]): ColumnaReporte[] {
  const peso = (columna: ColumnaReporte) =>
    columna.formato === 'moneda' ? 0 : columna.formato === 'porcentaje' ? 2 : 1
  return [...columnas].sort((a, b) => peso(a) - peso(b))
}

export function GraficasReporte({ seccion }: { seccion: SeccionReporte }) {
  const columnaCategoria = seccion.columnas.find((columna) => !esColumnaNumerica(columna))
  const numericas = useMemo(
    () => ordenarNumericas(seccion.columnas.filter(esColumnaNumerica)),
    [seccion.columnas],
  )

  const [claveSerie, setClaveSerie] = useState<string | null>(null)
  const [tipoElegido, setTipoElegido] = useState<TipoGrafica | null>(null)

  const columnaSerie =
    numericas.find((columna) => columna.clave === claveSerie) ?? numericas[0]

  const puntos = useMemo<MonoPoint[]>(() => {
    if (!columnaCategoria || !columnaSerie) return []
    return seccion.filas
      .map((fila) => ({
        label: formatearCelda(fila[columnaCategoria.clave], columnaCategoria),
        valor: valorNumerico(fila[columnaSerie.clave], columnaSerie),
      }))
      .filter((punto): punto is { label: string; valor: number } => punto.valor !== null)
      .map((punto) => ({ label: punto.label, value: punto.valor }))
  }, [seccion.filas, columnaCategoria, columnaSerie])

  const hayNegativos = puntos.some((punto) => punto.value < 0)
  const esTemporal = Boolean(columnaCategoria && esColumnaTemporal(columnaCategoria))

  const tiposDisponibles = useMemo(
    () =>
      TIPOS_GRAFICA.filter((opcion) =>
        hayNegativos ? opcion.tipo === 'linea' || opcion.tipo === 'barra' : true,
      ),
    [hayNegativos],
  )

  const tipoPorOmision: TipoGrafica = esTemporal
    ? 'linea'
    : !hayNegativos && puntos.length <= MAX_PORCIONES
      ? 'dona'
      : 'barra'

  const tipo =
    tipoElegido && tiposDisponibles.some((opcion) => opcion.tipo === tipoElegido)
      ? tipoElegido
      : tipoPorOmision

  /**
   * Recorte por tipo. Una serie en el tiempo conserva su orden —reordenarla por
   * valor la vuelve ilegible— y el resto se ordena de mayor a menor, que es
   * como se lee un ranking. En la dona lo que sobra se agrupa en «Otros» en vez
   * de desaparecer, o los porcentajes no sumarían el total.
   */
  const datos = useMemo<MonoPoint[]>(() => {
    if (puntos.length === 0) return []

    if (tipo === 'linea') {
      return esTemporal ? puntos.slice(-MAX_PUNTOS_LINEA) : puntos.slice(0, MAX_PUNTOS_LINEA)
    }

    const ordenados = esTemporal && tipo === 'barra'
      ? puntos
      : [...puntos].sort((a, b) => b.value - a.value)

    if (tipo === 'barra') return ordenados.slice(0, MAX_BARRAS)
    if (tipo === 'embudo') return ordenados.slice(0, MAX_ETAPAS)

    if (ordenados.length <= MAX_PORCIONES) return ordenados
    const visibles = ordenados.slice(0, MAX_PORCIONES - 1)
    const resto = ordenados.slice(MAX_PORCIONES - 1)
    return [
      ...visibles,
      {
        label: `Otros (${resto.length})`,
        value: resto.reduce((acumulado, punto) => acumulado + punto.value, 0),
      },
    ]
  }, [puntos, tipo, esTemporal])

  // Una sola fila no es una gráfica, es un número: eso ya lo dicen los KPIs.
  if (!columnaCategoria || !columnaSerie || puntos.length < 2) return null

  const formatear = formateadorDeColumna(columnaSerie)
  const total = puntos.reduce((acumulado, punto) => acumulado + punto.value, 0)
  const titulo = seccion.titulo ?? columnaSerie.titulo
  const pie =
    datos.length < puntos.length
      ? `${datos.length} de ${puntos.length} ${columnaCategoria.titulo.toLowerCase()}`
      : `${puntos.length} ${columnaCategoria.titulo.toLowerCase()}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {numericas.length > 1 && (
          <Select
            value={columnaSerie.clave}
            onValueChange={(valor) => setClaveSerie(valor)}
          >
            <SelectTrigger className="h-8 w-[11rem] text-xs" aria-label="Serie a graficar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {numericas.map((columna) => (
                <SelectItem key={columna.clave} value={columna.clave} className="text-xs">
                  {columna.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <SelectorTipoGrafica
          tipos={tiposDisponibles}
          valor={tipo}
          onCambio={setTipoElegido}
        />
      </div>

      <GraficaMono
        tipo={tipo}
        datos={datos}
        titulo={titulo}
        nombreSerie={columnaSerie.titulo}
        formatear={formatear}
        resumen={tipo === 'dona' || tipo === 'embudo' ? undefined : formatear(total)}
        detalleResumen={tipo === 'dona' || tipo === 'embudo' ? undefined : 'acumulado'}
        pie={pie}
      />
    </div>
  )
}
