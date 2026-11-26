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
  /** Ya no se usa: el conteo propio es continuo. Se conserva en filas viejas. */
  anioCorrelativo: number
  /**
   * Último número oficial que conoce esta taquilla por serie:
   * `{ ERC: 4, NRC: 10, 'TCK-2026': 45 }`. Con esto imprime sin conexión el que
   * sigue. Se actualiza con lo que dice el servidor y con cada número que emite.
   */
  correlativos?: Record<string, number>
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

  const delServidor = dispositivo.ultimoCorrelativo ?? 0
  const local = identidad.ultimoCorrelativo

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
    // Igual que el conteo propio: el mayor de los dos. Lo local va adelante
    // mientras haya ventas sin subir.
    correlativos: fusionarCorrelativos(identidad.correlativos, dispositivo.correlativos),
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

/** Prefijo de los folios fuera de las cuevas. Lo fija el backend en `TICKET_SERIE`. */
const PREFIJO_FOLIO = 'TCK'

/**
 * Serie oficial de un ticket, la misma que usa el servidor:
 * visitante de las cuevas → `ERC`/`ERL`/`NRC`/`NRL` (Extranjero/Nacional +
 * Recorrido Corto/Largo); todo lo demás y el guía → `TCK-AAAA`.
 *
 * El año sale de `anioEnGuatemala()`, no de `getFullYear()`: una tablet con otra
 * zona horaria numeraría con el año equivocado la noche del 31 de diciembre.
 */
export function serieOficial(datos: {
  esGuia: boolean
  codigoAtraccion?: string
  codigoOrigen?: string
  codigoRecorrido?: string
}): string {
  if (!datos.esGuia && datos.codigoAtraccion === 'cuevas' && datos.codigoRecorrido) {
    const origen = datos.codigoOrigen === 'extranjero' ? 'E' : 'N'
    const recorrido = datos.codigoRecorrido === 'largo' ? 'L' : 'C'
    return `${origen}R${recorrido}`
  }
  return `${PREFIJO_FOLIO}-${anioEnGuatemala()}`
}

/** `ERC` + 5 → `ERC-0005`; `TCK-2026` + 45 → `TCK-2026-000045`. */
function formatearFolio(serie: string, numero: number): string {
  const digitos = serie.startsWith(`${PREFIJO_FOLIO}-`) ? 6 : 4
  return `${serie}-${String(numero).padStart(digitos, '0')}`
}

/** `ERC-0005` → `['ERC', 5]`; `TCK-2026-000045` → `['TCK-2026', 45]`. */
function leerFolio(numeroTicket: string): [string, number] | null {
  const m = /^([A-Z]+(?:-[0-9]{4})?)-([0-9]+)$/.exec(numeroTicket)
  return m ? [m[1], Number(m[2])] : null
}

function fusionarCorrelativos(
  a: Record<string, number> = {},
  b: Record<string, number> = {},
): Record<string, number> {
  const fusion = { ...a }
  for (const [serie, numero] of Object.entries(b)) {
    fusion[serie] = Math.max(fusion[serie] ?? 0, numero)
  }
  return fusion
}

/**
 * Anota números oficiales ya emitidos (en línea o al sincronizar) para que el
 * próximo pase sin conexión no imprima uno que ya existe. Nunca baja un contador.
 */
export async function registrarFoliosOficiales(numeros: string[]): Promise<void> {
  const vistos: Record<string, number> = {}
  for (const numero of numeros) {
    const leido = leerFolio(numero)
    if (leido) vistos[leido[0]] = Math.max(vistos[leido[0]] ?? 0, leido[1])
  }
  if (Object.keys(vistos).length === 0) return

  try {
    await db.transaction('rw', db.identidadDispositivo, async () => {
      const identidad = await db.identidadDispositivo.get('actual')
      if (!identidad) return
      await db.identidadDispositivo.put({
        ...identidad,
        correlativos: fusionarCorrelativos(identidad.correlativos, vistos),
      })
    })
  } catch {
    // Es una mejora de la adivinanza, no puede hacer fallar una venta ya cobrada:
    // si el número choca, el servidor le asigna el siguiente al sincronizar.
  }
}

/**
 * Reserva un número oficial por cada serie pedida (una por pase) y los devuelve
 * junto con el conteo propio de la taquilla.
 *
 * El número es el siguiente al último que conoce esta taquilla. Si mientras tanto
 * otro equipo usó el mismo, el servidor lo resuelve al sincronizar: el primero
 * que llega se lo queda y al otro le da el siguiente.
 *
 * Todo pasa dentro de una transacción de escritura a propósito: dos emisiones
 * que se solapen —el taquillero cobrando rápido, o una recarga a mitad de
 * venta— podrían leer el mismo número y numerar dos ventas igual en este equipo,
 * y eso llega al servidor como `FOLIO_YA_EMITIDO`.
 */
export async function reservarFoliosLocales(
  series: string[],
): Promise<{ numeroTicket: string; secuencia: number }[]> {
  if (series.length === 0) return []

  return db.transaction('rw', db.identidadDispositivo, async () => {
    const identidad = await db.identidadDispositivo.get('actual')
    if (!identidad?.serie || identidad.revocado) {
      throw new Error(
        'Esta taquilla todavía no está registrada. Conéctese una vez para darla de alta.',
      )
    }

    const correlativos = { ...(identidad.correlativos ?? {}) }
    const folios = series.map((serie, i) => {
      correlativos[serie] = (correlativos[serie] ?? 0) + 1
      return {
        numeroTicket: formatearFolio(serie, correlativos[serie]),
        secuencia: identidad.ultimoCorrelativo + i + 1,
      }
    })

    await db.identidadDispositivo.put({
      ...identidad,
      ultimoCorrelativo: identidad.ultimoCorrelativo + series.length,
      correlativos,
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
