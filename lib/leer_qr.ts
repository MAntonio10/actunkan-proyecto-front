/**
 * Contenido del QR de un pase: el JSON `{ numeroTicket, firma }` y, si lo firmó
 * una taquilla con su propia llave, además `{ dispositivo }`. Si viniera texto
 * plano, se asume que es el número.
 */
export interface DatosQrPase {
  numeroTicket: string
  firma?: string
  dispositivo?: string
}

export function leerQrPase(texto: string): DatosQrPase {
  try {
    const datos = JSON.parse(texto)
    if (datos?.numeroTicket) {
      return {
        numeroTicket: String(datos.numeroTicket),
        firma: typeof datos.firma === 'string' ? datos.firma : undefined,
        dispositivo: typeof datos.dispositivo === 'string' ? datos.dispositivo : undefined,
      }
    }
  } catch {
    // No es JSON: el contenido es el número tal cual.
  }
  return { numeroTicket: texto.trim() }
}
