'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { claseAlineacion, formatearCelda } from '@/lib/formato_reporte'
import type { SeccionReporte } from '@/tipos'

/**
 * Tabla de una sección de reporte.
 *
 * Un solo componente sirve para los 18 reportes porque **ninguna clave de
 * columna está escrita a mano**: se recorre `seccion.columnas` y se lee
 * `fila[columna.clave]`. Eso no es elegancia, es obligatorio — las columnas de
 * arqueo desaparecen de la respuesta para quien no tiene `Cajas.Editar`, y las
 * de la matriz de permisos se generan de la base (`modulo_3`, `modulo_7`…), así
 * que cualquier clave fija se rompería sola.
 *
 * `Table` ya trae su propio contenedor con scroll horizontal, que es lo que
 * pide un reporte con `orientacion: 'horizontal'`.
 */
export function TablaReporte({ seccion }: { seccion: SeccionReporte }) {
  const hayTotales =
    Boolean(seccion.totales) &&
    seccion.columnas.some((columna) => seccion.totales?.[columna.clave] !== undefined)

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {seccion.columnas.map((columna) => (
            <TableHead
              key={columna.clave}
              className={cn('whitespace-nowrap', claseAlineacion(columna))}
              // `ancho` es fracción del ancho útil; se deja como pista y el
              // navegador reparte el resto.
              style={columna.ancho ? { width: `${Math.round(columna.ancho * 100)}%` } : undefined}
            >
              {columna.titulo}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {seccion.filas.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={seccion.columnas.length}
              className="py-8 text-center text-sm text-muted-foreground"
            >
              Sin datos para los filtros aplicados.
            </TableCell>
          </TableRow>
        ) : (
          seccion.filas.map((fila, indice) => (
            <TableRow key={indice}>
              {seccion.columnas.map((columna) => (
                <TableCell
                  key={columna.clave}
                  className={cn(
                    claseAlineacion(columna),
                    columna.formato === 'texto' ? 'max-w-[22rem]' : 'whitespace-nowrap tabular-nums',
                  )}
                >
                  {formatearCelda(fila[columna.clave], columna)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>

      {/* `totales` solo trae las claves de las columnas que lo declaran, y en
          algunos reportes no viene: entonces no se pinta la fila. */}
      {hayTotales && (
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            {seccion.columnas.map((columna, indice) => (
              <TableCell
                key={columna.clave}
                className={cn('font-semibold', claseAlineacion(columna), 'whitespace-nowrap tabular-nums')}
              >
                {seccion.totales?.[columna.clave] !== undefined
                  ? formatearCelda(seccion.totales[columna.clave], columna)
                  : indice === 0
                    ? 'TOTAL'
                    : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  )
}
