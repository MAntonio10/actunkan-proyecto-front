import Dexie, { type Table } from 'dexie'
import type {
  CatalogosTickets,
  CredencialOffline,
  GuiaBackend,
  ModuloMenu,
  SecretoCifrado,
  TicketBackend,
  VentaPendienteLocal,
} from '@/tipos'

/**
 * Almacenamiento local de la taquilla, exclusivo del módulo EmisionTickets.
 *
 * Se limita a lo que hace falta para vender sin conexión y subir después. No es
 * un espejo del backend: los módulos que sí exigen red (usuarios, cajas,
 * bitácora) no tienen tabla acá a propósito.
 *
 * Contrato del lado servidor en ESPECIFICACION_OFFLINE.md.
 */

/**
 * Folio reservado guardado localmente.
 *
 * `firma` y `qr` viajan cifrados con AES-GCM bajo la llave derivada de la
 * contraseña (ver lib/sesion_offline.ts): un dispositivo robado no entrega
 * pases utilizables. El `numeroTicket` queda en claro porque sin firma no vale
 * nada y hace falta para indexar.
 */
export interface FolioLocal {
  numeroTicket: string
  idLote: number
  /** 0/1, no booleano: IndexedDB no admite booleanos como clave de índice. */
  consumido: 0 | 1
  /** JSON cifrado de `{ firma, qr }`. */
  iv: string
  datos: string
}

/** Estado del lote de folios vigente en este dispositivo. Una sola fila. */
export interface LoteLocal {
  clave: 'actual'
  idLote: number
  idAperturaCaja: number
  idUsuario: number
  idDispositivo: string
  fechaCreacion: string
  expiraEn: string
}

/** Catálogos de emisión cacheados. Sin esto el formulario no abre sin red. */
export interface CatalogosLocal {
  clave: 'actual'
  datos: CatalogosTickets
  fechaDescarga: string
}

/** Módulos concedidos, cacheados desde /modulos/mis-modulos. Sin esto
 *  RutaProtegida muestra "sin módulos asignados" apenas se cae la red. */
export interface ModulosLocal {
  clave: 'actual'
  idUsuario: number
  modulos: ModuloMenu[]
  fechaDescarga: string
}

class BaseTickets extends Dexie {
  folios!: Table<FolioLocal, string>
  lote!: Table<LoteLocal, string>
  ventasPendientes!: Table<VentaPendienteLocal, string>
  ticketsLocales!: Table<TicketBackend, number>
  catalogos!: Table<CatalogosLocal, string>
  modulos!: Table<ModulosLocal, string>
  guias!: Table<GuiaBackend, number>
  credenciales!: Table<CredencialOffline, string>
  secretos!: Table<SecretoCifrado, string>

  constructor() {
    super('actunkan_tickets')

    this.version(1).stores({
      folios: 'numeroTicket, idLote, consumido',
      lote: 'clave',
      // `estado` indexado: el sincronizador barre la cola filtrando por él.
      ventasPendientes: 'idLocal, estado, fechaCreacion',
      ticketsLocales: 'id, numeroTicket, fechaCreacion',
      catalogos: 'clave',
      modulos: 'clave',
      credenciales: 'correo',
      secretos: 'clave',
    })

    // v2: catálogo de guías. Sin él, "guía existente" quedaba vacío sin red y
    // el taquillero no podía asignarle guía a la venta.
    this.version(2).stores({
      guias: 'id, nombre',
    })
  }
}

export const db = new BaseTickets()

/**
 * Identificador estable de este dispositivo. El backend lo usa para atar el
 * lote de folios a la tablet y para devolverlo tras una reinstalación.
 *
 * Vive en localStorage, no en Dexie: hace falta de forma síncrona y antes de
 * que la base esté abierta.
 */
const CLAVE_DISPOSITIVO = 'id_dispositivo'

export function obtenerIdDispositivo(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(CLAVE_DISPOSITIVO)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLAVE_DISPOSITIVO, id)
  }
  return id
}

/**
 * Pide al navegador que no descarte este almacenamiento.
 *
 * Por defecto IndexedDB es "best effort": ante presión de espacio el navegador
 * lo borra sin avisar, y en iOS se descarta tras unos días sin abrir la
 * aplicación. Acá dentro viven los folios pre-firmados y las ventas cobradas
 * que todavía no subieron, así que perderlos es perder dinero.
 *
 * Cada navegador decide distinto: Chrome lo concede solo si la aplicación está
 * instalada o tiene uso frecuente, Firefox pregunta al usuario y Safari lo
 * ignora en buena medida. Por eso devuelve el resultado en vez de darlo por
 * hecho — el panel de Sincronización lo muestra tal cual.
 */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    // Preguntar primero evita volver a pedirlo en cada arranque, que en Firefox
    // significaría un diálogo repetido.
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function almacenamientoEsPersistente(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/** Espacio usado y disponible, para el diagnóstico. */
export async function usoDeAlmacenamiento(): Promise<{ usado: number; total: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usado: usage ?? 0, total: quota ?? 0 }
  } catch {
    return null
  }
}

/** Limpia lo operativo del turno. Deja intactas las credenciales offline: si se
 *  borraran, cerrar sesión dejaría al taquillero sin poder entrar sin red. */
export async function limpiarDatosOperativos(): Promise<void> {
  await db.transaction(
    'rw',
    [db.folios, db.lote, db.ventasPendientes, db.ticketsLocales],
    async () => {
      await Promise.all([
        db.folios.clear(),
        db.lote.clear(),
        db.ventasPendientes.clear(),
        db.ticketsLocales.clear(),
      ])
    },
  )
}
