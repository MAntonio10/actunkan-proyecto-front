import { api, ApiError } from '@/lib/api'
import { aBase64, hayCriptoDisponible, CriptoNoDisponibleError } from '@/lib/cripto_offline'
import { db } from '@/lib/db_tickets'
import { anioEnGuatemala } from '@/lib/fecha_guatemala'
import type { DispositivoTaquilla } from '@/tipos'

/**
 * Identidad criptográfica de esta taquilla.
 *
 * Reemplaza al modelo de folios pre-firmados. Antes el QR era
 * `HMAC(numeroTicket, secreto-del-servidor)`: solo el servidor podía firmar, así
 * que para vender sin red había que reservar folios firmados por adelantado, con
 * todo lo que arrastraba — lotes, conciliación, folios que se quemaban al
 * anular. Con un par de llaves propio, la taquilla firma sus pases sola.
 *
 * Reglas que sostienen el modelo:
 *
 * - **La llave privada se genera NO extraíble.** `crypto.subtle` nunca la
 *   entrega, ni siquiera a este código: se guarda el objeto `CryptoKey` en
 *   IndexedDB y solo se lo puede usar para firmar. Un atacante con acceso al
 *   almacenamiento del navegador puede firmar mientras tenga el dispositivo,
 *   pero no puede copiarse la llave a otro lado.
 * - **Se firma el folio y nada más**: la cadena `numeroTicket` en UTF-8, no el
 *   JSON del payload. Es lo que verifica el servidor.
 * - **La firma que produce WebCrypto es `r||s` cruda de 64 bytes**, no DER. El
 *   backend ya está configurado con `dsaEncoding: 'ieee-p1363'` para aceptarla.
 *   Si alguna vez se firma con otra librería, esto es lo primero a revisar: el
 *   síntoma de equivocarse es que todo parece bien y ninguna firma valida.
 *
 * Todo esto necesita contexto seguro (HTTPS o localhost), igual que el resto del
 * modo sin conexión: `crypto.subtle` no existe sobre `http://` en una IP de red.
 */

const ALGORITMO = { name: 'ECDSA', namedCurve: 'P-256' } as const
const FIRMA = { name: 'ECDSA', hash: 'SHA-256' } as const

/** Fila única con la identidad del dispositivo. */
export interface IdentidadDispositivo {
  clave: 'actual'
  /** Lo genera el propio dispositivo la primera vez y no cambia más. */
  idDispositivo: string
  /** No extraíble: se guarda el objeto, no el material de la llave. */
  llavePrivada: CryptoKey
  /** SPKI en base64, lo mismo que se mandó al servidor. */
  llavePublica: string
  /** Serie que asignó el backend ('D01'...). Null hasta registrarse. */
  serie: string | null
  /**
   * Último correlativo usado por esta taquilla EN `anioCorrelativo`.
   *
   * El servidor lleva el suyo con único `[serie, anio]` y solo lo hace subir; el
   * local es el que permite numerar sin consultarlo. Arranca en 0, así que el
   * primer folio del año es `000001`.
   */
  ultimoCorrelativo: number
  /** Año al que corresponde `ultimoCorrelativo`. Al cambiar de año se reinicia. */
  anioCorrelativo: number
  /**
   * La taquilla fue dada de baja. Sus pases dejan de validar, así que no debe
   * seguir firmando: vuelve al modelo de folios reservados, que el servidor
   * permite justamente para un equipo revocado que todavía tiene que vender
   * mientras se resuelve su situación.
   */
  revocado: boolean
  fechaCreacion: string
}

/**
 * Si esta taquilla firma sus propios pases o sigue necesitando folios del
 * servidor.
 *
 * Es el único predicado que decide entre los dos modelos, y vive en un solo
 * lugar a propósito: lo consultan la emisión, el formulario y el sincronizador,
 * y que uno de los tres opine distinto deja al equipo reservando folios que no
 * usa —que bloquean el cierre de caja— o firmando con una llave revocada
 * —cuyas ventas se rechazan todas al subir—.
 */
export async function taquillaFirmaSusPases(): Promise<boolean> {
  const identidad = await identidadActual()
  return !!identidad?.serie && !identidad.revocado
}

/** Genera el identificador del dispositivo. No es un secreto: identifica, no
 *  autentica. Quien autentica es la llave. */
function nuevoIdDispositivo(): string {
  return crypto.randomUUID()
}

/**
 * La identidad guardada, o null si esta taquilla todavía no tiene una.
 *
 * No la crea: crearla implica registrarla contra el servidor, y eso tiene que
 * ser una decisión explícita, no un efecto de leer.
 */
export async function identidadActual(): Promise<IdentidadDispositivo | null> {
  try {
    return (await db.identidadDispositivo.get('actual')) ?? null
  } catch {
    return null
  }
}

/**
 * Deja esta taquilla registrada y lista para firmar.
 *
 * Idempotente: si ya hay identidad local la devuelve tal cual. Si la hay pero
 * nunca se registró —se generó el par y falló la red antes de enviarlo— vuelve a
 * intentar el registro con la misma llave, sin generar otra: cambiar de llave
 * dejaría sin validar cualquier pase ya emitido con la anterior.
 *
 * Necesita conexión: el alta es contra el servidor. Es la contracara de que el
 * arranque en frío exija al menos una conexión.
 */
/** Lo que devuelve el alta: la identidad del equipo y la caja del turno. */
export interface AltaDispositivo {
  identidad: IdentidadDispositivo
  /** Null solo si el servidor no la mandó; con caja cerrada el alta falla antes. */
  caja: { id: number; fechaCreacion: string } | null
}

export async function asegurarDispositivoRegistrado(
  nombre?: string,
): Promise<AltaDispositivo> {
  if (!hayCriptoDisponible()) throw new CriptoNoDisponibleError()

  const guardada = await identidadActual()
  const identidad: IdentidadDispositivo =
    guardada ?? (await generarIdentidadLocal())

  // Se vuelve a pedir el alta aunque ya esté registrada. El endpoint es
  // idempotente por `idDispositivo`, y la respuesta trae el estado actual: es la
  // forma mas barata de enterarse de que la taquilla fue revocada, sin pedir
  // `GET /dispositivos`, que exige un permiso que el taquillero no suele tener.
  const dispositivo = await api.dispositivos.registrar({
    idDispositivo: identidad.idDispositivo,
    nombre,
    llavePublica: identidad.llavePublica,
  })

  const anio = anioEnGuatemala()
  const delServidor = dispositivo.ultimoCorrelativo ?? 0
  const local = identidad.anioCorrelativo === anio ? identidad.ultimoCorrelativo : 0

  /*
   * El correlativo se queda con el MAYOR de los dos, nunca con el del servidor a
   * secas.
   *
   * El local puede ir legítimamente adelante: son las ventas emitidas sin
   * conexion que todavia no subieron, que el servidor aún no contó. Pisarlo con
   * el suyo haria que la proxima venta repita un numero ya impreso, y eso llega
   * como `FOLIO_YA_EMITIDO` — dinero cobrado dos veces con un solo ticket
   * posible.
   *
   * Al revés también sirve: si a la tablet le borraron el almacenamiento, el del
   * servidor la devuelve a donde estaba en lugar de reiniciar en 1 y chocar con
   * todo lo ya emitido.
   *
   * Esto se apoya en una invariante del backend: `ultimoCorrelativo` **solo
   * sube**. Hay una única ruta de escritura —la emisión, guardada por
   * `correlativo > ultimoCorrelativo`—, y ni el re-registro ni la revocación lo
   * tocan; del lado del servidor hay pruebas que lo fijan. Si algún día pudiera
   * bajar, este `Math.max` deja de alcanzar y hay que repensarlo acá.
   */
  const confirmada: IdentidadDispositivo = {
    ...identidad,
    serie: dispositivo.serie,
    ultimoCorrelativo: Math.max(local, delServidor),
    anioCorrelativo: anio,
    revocado: !!dispositivo.revocado,
  }
  await db.identidadDispositivo.put(confirmada)

  // La caja viaja aparte y NO se guarda en la identidad: la identidad es
  // permanente y la caja cambia cada turno. Mezclarlas dejaría una caja vieja
  // pegada al dispositivo después de cerrar el turno.
  return { identidad: confirmada, caja: dispositivo.caja ?? null }
}

/**
 * Si el alta falló porque no hay caja abierta.
 *
 * El servidor responde `409` con `codigo: 'SIN_CAJA_ABIERTA'` y lo hace a
 * propósito en el alta y no al sincronizar: el alta es el único momento en que
 * hay red y todavía no hay dinero cobrado. Antes el equipo se armaba sin caja,
 * el taquillero cobraba el turno entero y el rechazo llegaba al subir la cola,
 * con el dinero ya en el cajón.
 *
 * Se lee del cuerpo y no del mensaje: el texto puede cambiar, el código no.
 */
export function esSinCajaAbierta(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false
  const cuerpo = error.cuerpo
  return (
    typeof cuerpo === 'object' &&
    cuerpo !== null &&
    (cuerpo as { codigo?: unknown }).codigo === 'SIN_CAJA_ABIERTA'
  )
}

/**
 * Crea el par de llaves y lo deja guardado, todavía sin registrar.
 *
 * Se guarda antes de salir a la red a propósito: si el alta falla, la próxima
 * vez se reintenta con esta misma llave en vez de generar una nueva.
 */
async function generarIdentidadLocal(): Promise<IdentidadDispositivo> {
  const par = await crypto.subtle.generateKey(ALGORITMO, false, ['sign', 'verify'])

  // La pública sí se exporta —es la que va al servidor—; la privada se generó
  // con `extractable: false`, así que exportarla lanzaría.
  const spki = await crypto.subtle.exportKey('spki', par.publicKey)

  const identidad: IdentidadDispositivo = {
    clave: 'actual',
    idDispositivo: nuevoIdDispositivo(),
    llavePrivada: par.privateKey,
    llavePublica: aBase64(spki),
    serie: null,
    ultimoCorrelativo: 0,
    anioCorrelativo: anioEnGuatemala(),
    revocado: false,
    fechaCreacion: new Date().toISOString(),
  }

  await db.identidadDispositivo.put(identidad)
  return identidad
}

/** Prefijo de los folios. Lo fija el backend en `TICKET_SERIE`. */
const PREFIJO_FOLIO = 'TCK'

/**
 * Arma el folio con el formato exacto que valida el servidor:
 * `TCK-{SERIE}-{AAAA}-{NNNNNN}`, con el correlativo a seis dígitos.
 *
 * Cualquier otra forma se rechaza con `FOLIO_DE_OTRA_SERIE`, así que el formato
 * no es cosmético.
 */
function formatearFolio(serie: string, anio: number, correlativo: number): string {
  return [
    PREFIJO_FOLIO,
    serie,
    String(anio),
    String(correlativo).padStart(6, '0'),
  ].join('-')
}

/**
 * Reserva `cantidad` folios consecutivos para esta taquilla y los devuelve.
 *
 * Todo pasa dentro de una transacción de escritura a propósito: dos emisiones
 * que se solapen —el taquillero cobrando rápido, o una recarga a mitad de
 * venta— podrían leer el mismo correlativo y numerar dos ventas igual. Eso
 * llega al servidor como `FOLIO_YA_EMITIDO`, que es el rechazo más grave que
 * hay: dinero cobrado dos veces con un solo ticket posible.
 *
 * El correlativo se reinicia al cambiar de año, igual que el del servidor, que
 * lo lleva con único `[serie, anio]`.
 *
 * El año sale de `anioEnGuatemala()`, **no** de `getFullYear()`. El servidor lo
 * calcula en `America/Guatemala`, y si acá se leyera la zona del aparato los dos
 * dejarían de coincidir en la franja en que no cae el mismo día: el 31 de
 * diciembre a las 20:00 en Guatemala, una tablet con zona de Tokio numeraría con
 * el año siguiente. El servidor solo acepta el año en curso o el anterior — el
 * anterior porque una venta del 31 de diciembre puede subirse el 1 de enero —,
 * así que ese folio se rechaza con `FOLIO_DE_OTRA_SERIE`, y para entonces el
 * pase ya se imprimió y se cobró.
 *
 * Lo que esto **no** arregla: una tablet con la hora de verdad mal puesta sigue
 * numerando fuera de rango. La zona ya no importa; el instante sí.
 */
export async function reservarFoliosLocales(cantidad: number): Promise<string[]> {
  if (cantidad < 1) return []

  return db.transaction('rw', db.identidadDispositivo, async () => {
    const identidad = await db.identidadDispositivo.get('actual')
    if (!identidad?.serie || identidad.revocado) {
      throw new Error(
        'Esta taquilla todavía no está registrada. Conéctese una vez para darla de alta.',
      )
    }

    const anio = anioEnGuatemala()
    const base = identidad.anioCorrelativo === anio ? identidad.ultimoCorrelativo : 0

    const folios: string[] = []
    for (let i = 1; i <= cantidad; i++) {
      folios.push(formatearFolio(identidad.serie, anio, base + i))
    }

    await db.identidadDispositivo.put({
      ...identidad,
      ultimoCorrelativo: base + cantidad,
      anioCorrelativo: anio,
    })

    return folios
  })
}

/**
 * Firma un folio con la llave de esta taquilla.
 *
 * Devuelve la firma en base64, lista para el campo `firma` del QR. Lo que se
 * firma es exactamente la cadena del folio, sin envolver en JSON ni agregarle
 * nada: el servidor recalcula sobre ese mismo texto.
 */
export async function firmarFolio(numeroTicket: string): Promise<string> {
  if (!hayCriptoDisponible()) throw new CriptoNoDisponibleError()

  const identidad = await identidadActual()
  if (!identidad) {
    throw new Error('Esta taquilla todavía no está registrada. Conéctese una vez para darla de alta.')
  }

  const firma = await crypto.subtle.sign(
    FIRMA,
    identidad.llavePrivada,
    new TextEncoder().encode(numeroTicket),
  )
  return aBase64(firma)
}

/**
 * El contenido del QR de un pase firmado por la taquilla.
 *
 * Lleva `dispositivo` además del folio y la firma; el pase que emite el servidor
 * sigue yendo sin ese campo, de modo que lo ya impreso y los lectores viejos no
 * se rompen.
 */
export async function armarQrFirmadoLocalmente(numeroTicket: string): Promise<string> {
  const identidad = await identidadActual()
  if (!identidad) {
    throw new Error('Esta taquilla todavía no está registrada. Conéctese una vez para darla de alta.')
  }

  return JSON.stringify({
    numeroTicket,
    firma: await firmarFolio(numeroTicket),
    dispositivo: identidad.idDispositivo,
  })
}

/** Solo para diagnóstico en la pantalla de sincronización. */
export type { DispositivoTaquilla }
