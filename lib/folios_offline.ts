import { api, ApiError, esErrorDeRed, hayConexion } from '@/lib/api'
import { db, obtenerIdDispositivo, type FolioLocal } from '@/lib/db_tickets'
import { cifrar, descifrar } from '@/lib/cripto_offline'
import { llaveActual } from '@/lib/sesion_offline'
import type { FolioReservado, LoteOfflineBackend } from '@/tipos'

/**
 * Inventario local de folios pre-firmados.
 *
 * El servidor los reserva mientras hay red; la taquilla los consume sin
 * conexión. Cada venta gasta un folio, o dos si lleva guía sin carnet (el guía
 * genera su propio ticket).
 *
 * Contrato en ESPECIFICACION_OFFLINE.md § 3, 4 y 6.
 */

/** Lotes chicos: si se pierde el dispositivo, es lo máximo que queda expuesto. */
export const TAMANO_LOTE = 100

/** Por debajo de esto se avisa al taquillero y se repone en cuanto haya red.
 *  Avisar tarde equivale a no avisar: quedarse en cero corta la venta. */
export const UMBRAL_AVISO = 15

/**
 * Quedan ventas cobradas sin subir. Es la única razón por la que el frontend
 * debe frenar un cierre de caja por su cuenta: cerrar dejaría dinero en el
 * cajón sin ticket que lo respalde. Se distingue de un fallo de la API porque
 * ante eso la autoridad es el backend, no esta comprobación local.
 */
export class ErrorVentasPendientes extends Error {
  pendientes: number
  constructor(pendientes: number) {
    super(
      `Quedan ${pendientes} ventas sin subir. Sincronice antes de cerrar el lote de folios.`,
    )
    this.name = 'ErrorVentasPendientes'
    this.pendientes = pendientes
  }
}

export interface EstadoFolios {
  idLote: number | null
  disponibles: number
  consumidos: number
  expiraEn: string | null
  /** El lote pasó su vencimiento. Los folios siguen siendo utilizables (el
   *  backend los mantiene en RESERVADO), pero hay que reponer en cuanto haya
   *  red: un lote vencido ya no bloquea reservar uno nuevo. */
  vencido: boolean
  bajoUmbral: boolean
  bloqueado: boolean
}

function exigirLlave(): CryptoKey {
  const llave = llaveActual()
  if (!llave) {
    throw new Error(
      'Los folios están bloqueados. Vuelva a iniciar sesión para desbloquear la venta sin conexión.',
    )
  }
  return llave
}

async function guardarFolios(idLote: number, folios: FolioReservado[]): Promise<void> {
  const llave = exigirLlave()
  const filas: FolioLocal[] = []
  for (const folio of folios) {
    const { iv, datos } = await cifrar(llave, JSON.stringify({ firma: folio.firma, qr: folio.qr }))
    filas.push({ numeroTicket: folio.numeroTicket, idLote, consumido: 0, iv, datos })
  }
  await db.folios.bulkPut(filas)
}

async function descifrarFolio(fila: FolioLocal): Promise<FolioReservado | null> {
  const llave = exigirLlave()
  const plano = await descifrar(llave, fila.iv, fila.datos)
  if (!plano) return null
  const { firma, qr } = JSON.parse(plano) as { firma: string; qr: string }
  return { numeroTicket: fila.numeroTicket, firma, qr }
}

async function persistirLote(lote: LoteOfflineBackend): Promise<void> {
  // Al cambiar de lote hay que sacar del inventario los folios sin consumir de
  // lotes anteriores: pertenecen a otro lote y el backend los rechazaría con
  // FOLIO_DE_OTRO_LOTE al subir la venta, después de haberla cobrado.
  // Los ya consumidos se conservan: hacen falta para declararlos al conciliar.
  await db.folios
    .filter((f) => f.idLote !== lote.idLote && f.consumido === 0)
    .delete()

  await db.lote.put({
    clave: 'actual',
    idLote: lote.idLote,
    idAperturaCaja: lote.idAperturaCaja,
    idUsuario: lote.idUsuario,
    idDispositivo: lote.idDispositivo,
    fechaCreacion: lote.fechaCreacion,
    expiraEn: lote.expiraEn,
  })
  await guardarFolios(lote.idLote, lote.folios)
}

export async function estadoFolios(): Promise<EstadoFolios> {
  const lote = await db.lote.get('actual')
  const disponibles = await db.folios.where('consumido').equals(0).count()
  const consumidos = await db.folios.where('consumido').equals(1).count()

  return {
    idLote: lote?.idLote ?? null,
    disponibles,
    consumidos,
    expiraEn: lote?.expiraEn ?? null,
    vencido: lote ? new Date(lote.expiraEn).getTime() < Date.now() : false,
    bajoUmbral: disponibles < UMBRAL_AVISO,
    bloqueado: llaveActual() === null,
  }
}

/**
 * Deja el dispositivo listo para vender sin red. Solo tiene efecto con conexión.
 *
 * Tres caminos: no hay lote y se reserva uno; hay lote local con pocos folios y
 * se concilia para pedir uno nuevo; el almacenamiento local se perdió y el
 * servidor todavía tiene un lote activo, que se recupera.
 */
export async function asegurarFolios(
  cantidad: number = TAMANO_LOTE,
): Promise<EstadoFolios> {
  if (!hayConexion() || llaveActual() === null) return estadoFolios()

  const idDispositivo = obtenerIdDispositivo()

  try {
    const estadoPrevio = await estadoFolios()

    // El servidor manda: si acá no hay lote pero allá sí, se recupera antes de
    // pedir otro. Pedirlo daría 409 y dejaría los folios reservados colgados.
    if (estadoPrevio.idLote === null) {
      const activo = await api.tickets.loteOfflineActivo(idDispositivo)
      if (activo.hayLoteActivo && activo.lote) {
        await persistirLote(activo.lote)
        return estadoFolios()
      }
      await reservarLote(cantidad, idDispositivo)
      return estadoFolios()
    }

    // Un lote vencido ya no bloquea reservar el siguiente (18.1), así que no
    // hace falta conciliarlo primero. Sus folios siguen siendo válidos y las
    // ventas que queden en la cola todavía pueden subirse.
    if (estadoPrevio.vencido) {
      await reservarLote(cantidad, idDispositivo)
      return estadoFolios()
    }

    if (estadoPrevio.bajoUmbral) {
      // Con el lote vigente hay que conciliarlo: el backend rechaza un segundo
      // lote activo para el mismo dispositivo.
      await conciliarLoteActual()
      await reservarLote(cantidad, idDispositivo)
    }

    return estadoFolios()
  } catch (error) {
    // Sin red no es un fallo: se sigue con lo que haya en el inventario local.
    if (esErrorDeRed(error)) return estadoFolios()
    throw error
  }
}

/**
 * Reserva un lote nuevo, recuperando el existente si el backend responde
 * `409 LOTE_ACTIVO_EXISTENTE`. Ese caso aparece cuando el dispositivo perdió su
 * copia local pero el servidor todavía tiene el lote abierto: sin esta
 * recuperación, la taquilla quedaría sin poder vender ni reservar.
 */
async function reservarLote(cantidad: number, idDispositivo: string): Promise<void> {
  try {
    await persistirLote(await api.tickets.reservarLoteOffline({ cantidad, idDispositivo }))
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) throw error
    const activo = await api.tickets.loteOfflineActivo(idDispositivo)
    if (!activo.hayLoteActivo || !activo.lote) throw error
    await persistirLote(activo.lote)
  }
}

/**
 * Toma `cantidad` folios y los marca consumidos en una sola transacción, para
 * que dos ventas simultáneas (dos pestañas abiertas) no reciban el mismo.
 *
 * Devuelve null si no alcanzan: quien llama debe abortar la venta, no vender a
 * medias.
 */
export async function consumirFolios(cantidad: number): Promise<FolioReservado[] | null> {
  exigirLlave()

  const filas = await db.transaction('rw', db.folios, async () => {
    const candidatas = await db.folios
      .where('consumido')
      .equals(0)
      .limit(cantidad)
      .toArray()

    if (candidatas.length < cantidad) return null

    await db.folios.bulkPut(candidatas.map((f) => ({ ...f, consumido: 1 as const })))
    return candidatas
  })

  if (!filas) return null

  const folios: FolioReservado[] = []
  for (const fila of filas) {
    const folio = await descifrarFolio(fila)
    // Un folio ilegible es basura irrecuperable: se descarta consumido para que
    // no vuelva a entregarse, y la venta se aborta.
    if (!folio) return null
    folios.push(folio)
  }
  return folios
}

/** Devuelve al inventario folios tomados para una venta que no llegó a
 *  guardarse. Sin esto, un error a mitad de camino los pierde. */
export async function devolverFolios(numerosTicket: string[]): Promise<void> {
  await db.transaction('rw', db.folios, async () => {
    for (const numeroTicket of numerosTicket) {
      const fila = await db.folios.get(numeroTicket)
      if (fila) await db.folios.put({ ...fila, consumido: 0 })
    }
  })
}

/**
 * Cierra el lote contra el servidor. Requisito para poder cerrar la caja
 * (ESPECIFICACION_OFFLINE.md § 9).
 *
 * Solo declara como utilizados los folios de ventas ya sincronizadas: declarar
 * una venta que sigue en la cola la convertiría en advertencia de "venta
 * perdida" cuando en realidad está por subir.
 */
export async function conciliarLoteActual(): Promise<void> {
  const lote = await db.lote.get('actual')
  if (!lote) return

  // Las retenidas cuentan: el operador eligió no subirlas, pero el dinero está
  // cobrado igual y sigue fuera del sistema. Las anuladas no, porque ahí no hay
  // nada que liquidar: no entró ni salió dinero.
  const pendientes = await db.ventasPendientes
    .where('estado')
    .anyOf('pendiente', 'retenida', 'enviando')
    .count()

  if (pendientes > 0) throw new ErrorVentasPendientes(pendientes)

  // El folio de una venta anulada se consumió, pero nunca llegó a ser ticket.
  // Va declarado como NO utilizado: así el backend lo cierra en lugar de
  // marcarlo como una venta perdida, y el pase impreso deja de validar.
  const ventasAnuladas = await db.ventasPendientes.where('estado').equals('anulada').toArray()
  const anulados = new Set(
    ventasAnuladas.flatMap((v) => v.folios.map((f) => f.numeroTicket)),
  )

  const todos = await db.folios.where('idLote').equals(lote.idLote).toArray()
  const foliosUtilizados = todos
    .filter((f) => f.consumido === 1 && !anulados.has(f.numeroTicket))
    .map((f) => f.numeroTicket)
  const foliosNoUtilizados = todos
    .filter((f) => f.consumido === 0 || anulados.has(f.numeroTicket))
    .map((f) => f.numeroTicket)

  await api.tickets.conciliarLoteOffline(lote.idLote, { foliosUtilizados, foliosNoUtilizados })

  await descartarLoteLocal()
}

/**
 * Borra el inventario local de folios. Se usa después de cerrar la caja: el
 * backend concilia solo los lotes vencidos de esa caja (18.4), así que el lote
 * que quede acá ya no existe del otro lado. Si se conservara, la próxima venta
 * gastaría folios de un lote conciliado y el backend la rechazaría con
 * FOLIO_NO_RESERVADO, después de haberla cobrado.
 *
 * Solo es seguro llamarlo sin ventas en la cola; el cierre ya lo garantiza.
 */
export async function descartarLoteLocal(): Promise<void> {
  await db.transaction('rw', [db.folios, db.lote], async () => {
    await db.folios.clear()
    await db.lote.delete('actual')
  })
}
