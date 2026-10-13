import { fechaApiParaExcel, fechaIsoEnGuatemala, ZONA_PARQUE } from '@/lib/fecha_guatemala'
import type { BitacoraBackend } from '@/tipos'

/**
 * Exporta la bitácora a un `.xlsx` de verdad.
 *
 * Antes era un CSV armado a mano, y traía dos problemas. El de los acentos:
 * Excel abre un `.csv` con la codificación del sistema, no UTF-8, así que
 * "Módulo" llegaba como "MÃ³dulo" salvo que el archivo empiece con BOM. Y el de
 * la presentación: un CSV no tiene formato, así que no hay encabezado, ni
 * anchos, ni ajuste de texto para descripciones largas.
 *
 * `exceljs` se carga con `import()` dinámico dentro de la función: pesa lo suyo
 * y solo hace falta cuando alguien pulsa Exportar, así que no entra en el
 * paquete de ninguna pantalla — incluidas las que tienen que funcionar sin
 * conexión.
 */

/** Paleta del sistema, para que el archivo se vea de la misma familia que la
 *  aplicación y que el PDF de reportes. ARGB, que es lo que pide exceljs. */
const COLOR = {
  encabezado: 'FF286F2F', // primary
  textoEncabezado: 'FFFFFFFF',
  cebra: 'FFFAF3E9', // fondo cálido muy claro
  borde: 'FFDCCAB2', // border
  titulo: 'FF2D1E0F', // foreground
  apagado: 'FF6B5741', // muted-foreground
} as const

interface Columna {
  titulo: string
  ancho: number
  ajustarTexto?: boolean
}

const COLUMNAS: Columna[] = [
  { titulo: 'ID', ancho: 8 },
  { titulo: 'Fecha y hora (UTC-6)', ancho: 21 },
  { titulo: 'Usuario', ancho: 24 },
  { titulo: 'Correo', ancho: 28 },
  { titulo: 'Puesto', ancho: 18 },
  { titulo: 'Módulo', ancho: 18 },
  { titulo: 'Acción', ancho: 26 },
  { titulo: 'Descripción', ancho: 70, ajustarTexto: true },
]

/**
 * La fecha como objeto, no como texto, para que en Excel se pueda ordenar y
 * filtrar por rango.
 *
 * No lleva ninguna conversión de zona, y eso es lo correcto: exceljs arma el
 * serial de Excel con los componentes **UTC** del `Date`, y ahí es justo donde
 * la fecha de la API ya trae la hora de pared de Guatemala. La celda muestra
 * entonces la misma hora que la pantalla, sin depender de en qué zona esté la
 * computadora que abre el archivo.
 *
 * Acá hubo una conversión a `America/Guatemala` que restaba seis horas de más.
 * Ver `lib/fecha_guatemala.ts` para por qué una fecha de la API no se convierte.
 */

export interface OpcionesExportacion {
  registros: BitacoraBackend[]
  /** Qué filtros estaban puestos, para dejarlo escrito en la hoja. */
  descripcionFiltros: string
}

export async function exportarBitacoraAExcel({
  registros,
  descripcionFiltros,
}: OpcionesExportacion): Promise<string> {
  const ExcelJS = await import('exceljs')

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Parque Regional Municipal Actún Kan'
  libro.created = new Date()

  const hoja = libro.addWorksheet('Bitácora', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  hoja.columns = COLUMNAS.map((c) => ({ width: c.ancho }))

  // --- Título y contexto, antes de la tabla ---
  const filaTitulo = hoja.addRow(['Bitácora de auditoría'])
  filaTitulo.font = { bold: true, size: 14, color: { argb: COLOR.titulo } }
  hoja.mergeCells(filaTitulo.number, 1, filaTitulo.number, COLUMNAS.length)

  const generado = new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: ZONA_PARQUE,
  }).format(new Date())
  const filaContexto = hoja.addRow([
    `${descripcionFiltros} · ${registros.length} registros · generado el ${generado}`,
  ])
  filaContexto.font = { size: 10, color: { argb: COLOR.apagado } }
  hoja.mergeCells(filaContexto.number, 1, filaContexto.number, COLUMNAS.length)

  hoja.addRow([])

  // --- Encabezado de la tabla ---
  const encabezado = hoja.addRow(COLUMNAS.map((c) => c.titulo))
  encabezado.height = 22
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: COLOR.textoEncabezado } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.encabezado } }
    celda.alignment = { vertical: 'middle', horizontal: 'left' }
  })

  // --- Los datos ---
  registros.forEach((registro, indice) => {
    const fila = hoja.addRow([
      registro.id,
      fechaApiParaExcel(registro.fecha),
      registro.usuarioNombre || '',
      registro.usuario?.correo || '',
      registro.usuario?.puesto?.nombre || '',
      registro.modulo || '',
      registro.accion || '',
      registro.descripcion || '',
    ])

    fila.alignment = { vertical: 'top' }
    fila.getCell(2).numFmt = 'dd/mm/yyyy hh:mm:ss'
    // Solo la descripción ajusta texto: si se activara en toda la fila, un
    // correo largo también partiría y las filas quedarían de alturas dispares.
    COLUMNAS.forEach((columna, i) => {
      if (columna.ajustarTexto) fila.getCell(i + 1).alignment = { vertical: 'top', wrapText: true }
    })

    // Cebra en las filas pares: con descripciones de varias líneas es lo que
    // deja seguir un renglón de lado a lado sin perderse.
    if (indice % 2 === 1) {
      fila.eachCell((celda) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cebra } }
      })
    }
  })

  // --- Bordes finos en toda la tabla, encabezado incluido ---
  const borde = { style: 'thin' as const, color: { argb: COLOR.borde } }
  for (let n = encabezado.number; n <= hoja.rowCount; n++) {
    hoja.getRow(n).eachCell((celda) => {
      celda.border = { top: borde, left: borde, bottom: borde, right: borde }
    })
  }

  // Filtros de Excel sobre el encabezado: es la primera cosa que alguien va a
  // querer hacer con una bitácora de miles de filas.
  if (registros.length > 0) {
    hoja.autoFilter = {
      from: { row: encabezado.number, column: 1 },
      to: { row: hoja.rowCount, column: COLUMNAS.length },
    }
  }

  const buffer = await libro.xlsx.writeBuffer()
  const nombre = `bitacora_${fechaIsoEnGuatemala()}.xlsx`

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  // Sin esto el blob queda retenido hasta recargar la página; con varias
  // exportaciones seguidas se acumulan megas en memoria.
  URL.revokeObjectURL(url)

  return nombre
}
