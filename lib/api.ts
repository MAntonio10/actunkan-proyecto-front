import {
  UsuarioBackend,
  RespuestaUsuarios,
  PuestoBackend,
  ModuloBackend,
  ModuloMenu,
  AccionBackend,
  ModuloAccionBackend,
  RespuestaLogin,
  RespuestaTokens,
  SesionBackend,
  BitacoraBackend,
  RespuestaBitacora,
  FiltrosBitacora,
  CatalogosTickets,
  PayloadEmisionTicket,
  RespuestaEmisionTicket,
  RespuestaHistorialTickets,
  RespuestaValidacionTicket,
  TicketBackend,
  FiltrosTickets,
  TarifaBackend,
  RespuestaHistorialTarifas,
  GuiaBackend,
  RespuestaGuias,
  AperturaCajaBackend,
  RespuestaAperturasCajas,
  RespuestaCajaActual,
  ArqueoCaja,
  RespuestaCierreCaja,
  FiltrosCajas,
  FiltrosCierres,
  RespuestaHistorialCierres,
  GastoBackend,
  TipoGastoBackend,
  DonacionBackend,
  FiltrosDonaciones,
  RespuestaHistorialDonaciones,
  ActividadParqueBackend,
  PayloadActividad,
  FiltrosActividades,
  RespuestaHistorialActividades,
  ImagenActividad,
  SectorParqueBackend,
  RespuestaConfirmacionPago,
  RespuestaPagoTicket,
  LoteOfflineBackend,
  RespuestaLoteActivo,
  VentaOffline,
  RespuestaEmisionOffline,
  RespuestaConciliacionLote,
  RespuestaCatalogoReportes,
  ResultadoReporte,
  RespuestaInterpretacionReporte,
  Dashboard,
} from '@/tipos'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

/** El xlsx que devuelven las rutas de reportes. */
const TIPO_EXCEL =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Rutas que el backend expone sin token. El resto de /auth/* (logout-todas,
// sesiones) sí exige sesión, por eso no basta con mirar el prefijo /auth/.
const ENDPOINTS_PUBLICOS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/solicitar-codigo-restablecimiento',
  '/auth/validar-codigo-restablecimiento',
  '/auth/restablecer-contrasena',
]

// Endpoints donde un 401 es una respuesta de negocio, no una sesión expirada.
// En /tickets/validar el 401 significa "firma del QR inválida o alterada": si se
// tratara como expiración, escanear un pase falso expulsaría al usuario al login.
const ENDPOINTS_401_DE_NEGOCIO = ['/tickets/validar']

function rutaDe(endpoint: string): string {
  return endpoint.split('?')[0]
}

function esEndpointPublico(endpoint: string): boolean {
  const ruta = rutaDe(endpoint)
  if (ENDPOINTS_PUBLICOS.includes(ruta)) return true
  // Ruta pública para confirmación de cobro desde pasarela Recurrente (sin sesión de usuario)
  if (/^\/pagos\/checkout\/[^/]+\/confirmar$/.test(ruta)) return true
  return false
}

function el401EsDeNegocio(endpoint: string): boolean {
  return ENDPOINTS_401_DE_NEGOCIO.includes(rutaDe(endpoint))
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * La petición nunca llegó al servidor. Es una categoría aparte de ApiError a
 * propósito: el sincronizador offline reintenta ante ErrorDeRed y se detiene
 * ante un rechazo del backend. Sin esa distinción, una venta que el servidor
 * rechaza se reintentaría para siempre.
 */
export class ErrorDeRed extends Error {
  constructor(mensaje = 'Sin conexión con el servidor') {
    super(mensaje)
    this.name = 'ErrorDeRed'
  }
}

export function esErrorDeRed(error: unknown): boolean {
  return error instanceof ErrorDeRed
}

/** Pista del navegador, no garantía: `true` puede significar wifi conectado sin
 *  salida a internet. Sirve para decidir si vale la pena intentar, no para dar
 *  por buena una conexión. */
export function hayConexion(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

/**
 * Conexión *observada*: la que se deduce de si las peticiones al backend llegan
 * o no.
 *
 * `navigator.onLine` solo mira la interfaz de red, así que da `true` con el
 * wifi conectado aunque no haya salida a internet o el servidor esté caído. Por
 * eso la barra decía "En línea" sin conexión real. Acá se marca `false` en
 * cuanto una petición falla por red y `true` en cuanto una responde.
 *
 * Es solo para mostrar estado. Para decidir si vale la pena *intentar* una
 * petición se sigue usando `hayConexion()`: si un fallo apagara los intentos,
 * nunca se descubriría que la conexión volvió.
 */
let conexionObservada = true
const oyentesConexion = new Set<(enLinea: boolean) => void>()

function marcarConexion(enLinea: boolean): void {
  if (conexionObservada === enLinea) return
  conexionObservada = enLinea
  oyentesConexion.forEach((oyente) => oyente(enLinea))
}

export function conexionActual(): boolean {
  return hayConexion() && conexionObservada
}

export function suscribirConexion(oyente: (enLinea: boolean) => void): () => void {
  oyentesConexion.add(oyente)
  return () => {
    oyentesConexion.delete(oyente)
  }
}

if (typeof window !== 'undefined') {
  // Al reconectar la interfaz se vuelve a dar el beneficio de la duda: la
  // próxima petición confirmará o desmentirá.
  window.addEventListener('online', () => marcarConexion(true))
  window.addEventListener('offline', () => marcarConexion(false))
}

export function obtenerToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null
}

export function obtenerRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
}

export function guardarTokens(tokens: RespuestaTokens): void {
  localStorage.setItem('token', tokens.access_token)
  localStorage.setItem('refresh_token', tokens.refresh_token)
  if (tokens.solo_sincronizacion) {
    localStorage.setItem('solo_sincronizacion', '1')
    if (tokens.aviso) localStorage.setItem('aviso_sesion', tokens.aviso)
  } else {
    localStorage.removeItem('solo_sincronizacion')
    localStorage.removeItem('aviso_sesion')
  }
}

/**
 * El usuario fue dado de baja mientras su dispositivo estaba sin conexión y el
 * backend le renovó la sesión únicamente para liquidar lo ya vendido
 * (DOCUMENTACION_ENDPOINTS.md 18.6). Todo lo demás responde 401 por diseño.
 */
export function esSoloSincronizacion(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem('solo_sincronizacion') === '1'
}

export function avisoDeSesion(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('aviso_sesion') : null
}

export function limpiarSesionLocal(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('usuario')
  localStorage.removeItem('solo_sincronizacion')
  localStorage.removeItem('aviso_sesion')
}

// Un solo refresh en vuelo: si varias peticiones reciben 401 a la vez, todas
// esperan la misma renovación en lugar de gastar (y rotar) el refresh token
// varias veces, lo que el backend interpretaría como robo de token.
let refrescoEnCurso: Promise<string | null> | null = null

async function refrescarTokens(): Promise<string | null> {
  const refreshToken = obtenerRefreshToken()
  if (!refreshToken) return null

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    // Si el refresco no llegó al servidor, la sesión no está vencida: está
    // incomunicada. Devolver null acá haría que el llamador la borrara y
    // expulsara al taquillero al login justo cuando no puede iniciar sesión.
    marcarConexion(false)
    throw new ErrorDeRed()
  }

  if (!response.ok) return null

  const tokens: RespuestaTokens = await response.json()
  guardarTokens(tokens)
  return tokens.access_token
}

function refrescarTokensUnaVez(): Promise<string | null> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = refrescarTokens()
      .catch((error) => {
        if (error instanceof ErrorDeRed) throw error
        return null
      })
      .finally(() => {
        refrescoEnCurso = null
      })
  }
  return refrescoEnCurso
}

async function ejecutar(
  endpoint: string,
  options: RequestInit,
  token: string | null
): Promise<Response> {
  // Con FormData no se fija Content-Type: el navegador debe ponerlo junto con
  // el boundary del multipart. Fijarlo a mano rompe la subida de archivos.
  const esFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers: Record<string, string> = {
    ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const respuesta = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
    marcarConexion(true)
    return respuesta
  } catch {
    // fetch solo lanza cuando la petición no llegó a completarse (sin red, DNS
    // caído, servidor inalcanzable). Se traduce a un error propio para que
    // quien llama no lo confunda con una respuesta de error del backend.
    marcarConexion(false)
    throw new ErrorDeRed()
  }
}

/**
 * Ejecuta la petición con token, refresco ante 401 y manejo de error, y
 * devuelve la Response cruda. Lo usan tanto `request` (JSON) como
 * `solicitarBlob` (PDF), para que ninguna ruta se salte el refresco de sesión.
 */
async function ejecutarConAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const esPublico = esEndpointPublico(endpoint)
  // Un 401 de negocio se propaga como error normal, sin refrescar ni redirigir
  const trata401ComoSesion = !esPublico && !el401EsDeNegocio(endpoint)
  let token = obtenerToken()

  // Si no hay token y el endpoint requiere autenticación, redirigir al login silenciosamente
  if (!token && !esPublico && typeof window !== 'undefined') {
    // Sin conexión no se redirige: una sesión restaurada sin internet puede no
    // tener access token todavía, y mandarla al login la sacaría de una
    // pantalla donde sí puede seguir vendiendo contra el almacenamiento local.
    if (!hayConexion()) {
      throw new ErrorDeRed()
    }
    window.location.replace('/login')
    // Lanzar error silencioso para cortar la ejecución sin mostrar toast
    throw new ApiError('Sesión no activa', 401)
  }

  let response = await ejecutar(endpoint, options, token)

  // El access token dura ~30 min: ante un 401 se intenta renovar con el refresh
  // token y se reintenta la petición una sola vez antes de expulsar al usuario.
  if (response.status === 401 && trata401ComoSesion && typeof window !== 'undefined') {
    const nuevoToken = await refrescarTokensUnaVez()
    if (nuevoToken) {
      token = nuevoToken
      response = await ejecutar(endpoint, options, token)
    }
  }

  if (!response.ok) {
    let errorMessage = `Error HTTP ${response.status}`
    try {
      const errorData = await response.json()
      if (Array.isArray(errorData.message)) {
        errorMessage = errorData.message.join(', ')
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Ignorar si no es JSON
    }

    // 401 tras haber agotado el intento de refresco: la sesión ya no se recupera
    if (response.status === 401 && trata401ComoSesion && typeof window !== 'undefined') {
      // Salvo en la sesión de solo sincronización, donde el 401 es lo esperado:
      // el backend habilita únicamente subir y conciliar las ventas offline, y
      // devuelve 401 en todo lo demás. Borrar la sesión acá dejaría el dinero
      // ya cobrado sin forma de llegar nunca al sistema.
      if (!esSoloSincronizacion()) {
        limpiarSesionLocal()
        window.location.replace('/login')
      }
    }

    throw new ApiError(errorMessage, response.status)
  }

  return response
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await ejecutarConAuth(endpoint, options)

  // Para respuestas vacías o 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

/**
 * Descarga una respuesta binaria (PDF) pasando por la misma capa de auth.
 * No se puede abrir la URL directa en una pestaña nueva: el endpoint exige
 * `Authorization: Bearer`, y una navegación del navegador no envía esa cabecera.
 */
async function solicitarBlob(endpoint: string, accept = 'application/pdf'): Promise<Blob> {
  const response = await ejecutarConAuth(endpoint, {
    headers: { Accept: accept },
  })
  return response.blob()
}

/** Archivo binario junto al nombre que propuso el servidor. */
export interface ArchivoDescargado {
  blob: Blob
  /** De `Content-Disposition`. Null si la cabecera no llegó (ver abajo). */
  nombreArchivo: string | null
}

/**
 * Igual que `solicitarBlob`, pero conservando el nombre de archivo.
 *
 * Lo usa el Excel de reportes, que viaja como `attachment` y necesita un nombre
 * al guardarse. Entre dominios la cabecera solo se lee si el backend la publica
 * con `Access-Control-Expose-Headers`; por eso el llamador siempre tiene que
 * traer un nombre de respaldo en vez de confiar en que venga.
 */
async function solicitarArchivo(
  endpoint: string,
  accept: string,
): Promise<ArchivoDescargado> {
  const response = await ejecutarConAuth(endpoint, { headers: { Accept: accept } })
  const disposicion = response.headers.get('content-disposition') ?? ''
  const coincidencia = disposicion.match(/filename="?([^";]+)"?/i)
  return { blob: await response.blob(), nombreArchivo: coincidencia?.[1] ?? null }
}

export const api = {
  // 1. Autenticación
  auth: {
    login: (correo: string, contrasena: string, recordarme: boolean = false) =>
      request<RespuestaLogin>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo, contrasena, recordarme }),
      }),

    getMe: () => request<UsuarioBackend>('/auth/me'),

    refresh: (refresh_token: string) =>
      request<RespuestaTokens>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      }),

    logout: (refresh_token: string) =>
      request<{ mensaje?: string }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      }),

    logoutTodas: () =>
      request<{ mensaje?: string }>('/auth/logout-todas', {
        method: 'POST',
      }),

    getSesiones: () => request<SesionBackend[]>('/auth/sesiones'),

    eliminarSesion: (id: number) =>
      request<{ mensaje?: string }>(`/auth/sesiones/${id}`, {
        method: 'DELETE',
      }),

    solicitarCodigoRestablecimiento: (correo: string) =>
      request<{ mensaje: string; expiracionMinutos: number }>('/auth/solicitar-codigo-restablecimiento', {
        method: 'POST',
        body: JSON.stringify({ correo }),
      }),

    validarCodigoRestablecimiento: (correo: string, codigo: string) =>
      request<{ valido: boolean; mensaje: string }>('/auth/validar-codigo-restablecimiento', {
        method: 'POST',
        body: JSON.stringify({ correo, codigo }),
      }),

    restablecerContrasena: (correo: string, codigo: string, nuevaContrasena: string) =>
      request<{ mensaje: string }>('/auth/restablecer-contrasena', {
        method: 'POST',
        body: JSON.stringify({ correo, codigo, nuevaContrasena }),
      }),
  },

  // 2. Usuarios
  usuarios: {
    // Paginado. `/usuarios` valida su query con un DTO (`forbidNonWhitelisted`):
    // los únicos parámetros aceptados son `incluirAnulados`, `pagina` y
    // `limite`; cualquier otro responde 400.
    getUsuarios: (incluirAnulados: boolean = true, params?: { pagina?: number; limite?: number }) => {
      const queryParams = new URLSearchParams()
      if (incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaUsuarios>(`/usuarios${queryStr ? `?${queryStr}` : ''}`)
    },

    getUsuarioById: (id: number) => request<UsuarioBackend>(`/usuarios/${id}`),

    crearUsuario: (data: {
      nombre: string
      correo: string
      contrasena: string
      idPuesto: number
      telefono: string
    }) =>
      request<UsuarioBackend>('/usuarios', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    actualizarUsuario: (
      id: number,
      data: { nombre?: string; telefono?: string; idPuesto?: number }
    ) =>
      request<UsuarioBackend>(`/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    anularUsuario: (id: number) =>
      request<UsuarioBackend>(`/usuarios/${id}`, {
        method: 'DELETE',
      }),

    activarUsuario: (id: number) =>
      request<UsuarioBackend>(`/usuarios/${id}/activar`, {
        method: 'PATCH',
      }),

    asignarPermisos: (id: number, idsModuloAccion: number[]) =>
      request<UsuarioBackend>(`/usuarios/${id}/permisos`, {
        method: 'POST',
        body: JSON.stringify({ idsModuloAccion }),
      }),
  },

  // 3. Puestos
  puestos: {
    getPuestos: (incluirAnulados: boolean = true) =>
      request<PuestoBackend[]>(`/puestos${incluirAnulados ? '?incluirAnulados=true' : ''}`),

    getPuestoById: (id: number) => request<PuestoBackend>(`/puestos/${id}`),

    crearPuesto: (data: { nombre: string; descripcion: string }) =>
      request<PuestoBackend>('/puestos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    actualizarPuesto: (id: number, data: { nombre?: string; descripcion?: string }) =>
      request<PuestoBackend>(`/puestos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    anularPuesto: (id: number) =>
      request<PuestoBackend>(`/puestos/${id}`, {
        method: 'DELETE',
      }),

    activarPuesto: (id: number) =>
      request<PuestoBackend>(`/puestos/${id}/activar`, {
        method: 'PATCH',
      }),
  },

  // 4. Módulos
  modulos: {
    getModulos: (incluirAnulados: boolean = true, soloAsignables: boolean = false) => {
      const params = new URLSearchParams()
      if (incluirAnulados) params.append('incluirAnulados', 'true')
      if (soloAsignables) params.append('soloAsignables', 'true')
      const queryStr = params.toString()
      return request<ModuloBackend[]>(`/modulos${queryStr ? `?${queryStr}` : ''}`)
    },

    // Módulos accesibles para el usuario de la sesión (alimenta el menú).
    // No exige permiso, solo token válido.
    misModulos: () => request<ModuloMenu[]>('/modulos/mis-modulos'),

    getModuloById: (id: number) => request<ModuloBackend>(`/modulos/${id}`),

    crearModulo: (data: { nombre: string }) =>
      request<ModuloBackend>('/modulos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    actualizarModulo: (id: number, data: { nombre: string }) =>
      request<ModuloBackend>(`/modulos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    anularModulo: (id: number) =>
      request<ModuloBackend>(`/modulos/${id}`, {
        method: 'DELETE',
      }),

    activarModulo: (id: number) =>
      request<ModuloBackend>(`/modulos/${id}/activar`, {
        method: 'PATCH',
      }),
  },

  // 5. Acciones
  acciones: {
    getAcciones: () => request<AccionBackend[]>('/acciones'),

    getAccionById: (id: number) => request<AccionBackend>(`/acciones/${id}`),

    crearAccion: (data: { nombre: string }) =>
      request<AccionBackend>('/acciones', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    actualizarAccion: (id: number, data: { nombre: string }) =>
      request<AccionBackend>(`/acciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    eliminarAccion: (id: number) =>
      request<AccionBackend>(`/acciones/${id}`, {
        method: 'DELETE',
      }),
  },

  // 6. Módulo-Acciones
  moduloAcciones: {
    getModuloAcciones: () => request<ModuloAccionBackend[]>('/modulo-acciones'),

    getModuloAccionesPorModulo: (idModulo: number) =>
      request<ModuloAccionBackend[]>(`/modulo-acciones/modulo/${idModulo}`),

    getModuloAccionById: (id: number) => request<ModuloAccionBackend>(`/modulo-acciones/${id}`),

    vincularModuloAccion: (data: { idModulo: number; idAccion: number }) =>
      request<ModuloAccionBackend>('/modulo-acciones', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    eliminarModuloAccion: (id: number) =>
      request<ModuloAccionBackend>(`/modulo-acciones/${id}`, {
        method: 'DELETE',
      }),
  },

  // 7. Bitácora
  bitacora: {
    getBitacora: (params?: FiltrosBitacora) => {
      const queryParams = new URLSearchParams()
      if (params?.idUsuario) queryParams.append('idUsuario', String(params.idUsuario))
      if (params?.modulo) queryParams.append('modulo', params.modulo)
      if (params?.accion) queryParams.append('accion', params.accion)
      if (params?.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
      if (params?.fechaFin) queryParams.append('fechaFin', params.fechaFin)
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaBitacora>(`/bitacora${queryStr ? `?${queryStr}` : ''}`)
    },

    getBitacoraById: (id: number) => request<BitacoraBackend>(`/bitacora/${id}`),
  },

  // 8. Tickets (módulo EmisionTickets)
  tickets: {
    // Todos los catálogos del formulario de emisión en una sola llamada.
    getCatalogos: () => request<CatalogosTickets>('/tickets/catalogos'),

    // El servidor resuelve precios y folio: el payload solo lleva selecciones.
    emitir: (data: PayloadEmisionTicket) =>
      request<RespuestaEmisionTicket>('/tickets/emitir', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getTickets: (params?: FiltrosTickets) => {
      const queryParams = new URLSearchParams()
      if (params?.buscar) queryParams.append('buscar', params.buscar)
      if (params?.idAtraccion) queryParams.append('idAtraccion', String(params.idAtraccion))
      if (params?.idOpcionPago) queryParams.append('idOpcionPago', String(params.idOpcionPago))
      if (params?.idOrigen) queryParams.append('idOrigen', String(params.idOrigen))
      if (params?.idPais) queryParams.append('idPais', String(params.idPais))
      if (params?.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
      if (params?.fechaFin) queryParams.append('fechaFin', params.fechaFin)
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaHistorialTickets>(`/tickets${queryStr ? `?${queryStr}` : ''}`)
    },

    getTicketById: (id: number) => request<TicketBackend>(`/tickets/${id}`),

    // El backend arma el pase en PDF (Content-Disposition: inline) para
    // previsualizar, imprimir o descargar desde el visor del navegador.
    getPdf: (id: number) => solicitarBlob(`/tickets/${id}/pdf`),

    /**
     * Manda al cliente su enlace de pago por correo.
     *
     * Solo viaja la dirección: el enlace lo pone el servidor leyéndolo del pago
     * guardado, así que este endpoint no sirve para mandar una URL cualquiera a
     * nombre del parque. Responde 400 si el ticket está anulado, ya pagado o
     * fue en efectivo.
     */
    enviarEnlacePago: (id: number, correo: string) =>
      request<{ mensaje: string; numeroTicket: string; correo: string }>(
        `/tickets/${id}/enviar-enlace-pago`,
        { method: 'POST', body: JSON.stringify({ correo }) },
      ),

    anular: (id: number) =>
      request<TicketBackend>(`/tickets/${id}`, {
        method: 'DELETE',
      }),

    // Control de acceso en taquilla: recibe el contenido decodificado del QR.
    validar: (data: { numeroTicket: string; firma?: string }) =>
      request<RespuestaValidacionTicket>('/tickets/validar', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // ---- Emisión sin conexión. Contrato en ESPECIFICACION_OFFLINE.md ----

    // Folios pre-firmados para vender sin red. El servidor toma la caja abierta
    // actual; el cliente no la elige.
    reservarLoteOffline: (data: { cantidad: number; idDispositivo: string }) =>
      request<LoteOfflineBackend>('/tickets/lotes-offline', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Recupera el lote vigente tras reinstalar la app o perder el almacenamiento
    // local; sin esto los folios quedan inservibles hasta que expiren.
    loteOfflineActivo: (idDispositivo: string) =>
      request<RespuestaLoteActivo>(
        `/tickets/lotes-offline/activo?idDispositivo=${encodeURIComponent(idDispositivo)}`,
      ),

    // Sube la cola. Responde éxito parcial por venta: una rechazada no arrastra
    // a las demás del lote.
    emitirOffline: (data: { idLote: number; ventas: VentaOffline[] }) =>
      request<RespuestaEmisionOffline>('/tickets/emitir-offline', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Cierra el lote: los folios sin usar pasan a NO_UTILIZADO para que la
    // auditoría no vea huecos en la secuencia. Requisito para cerrar la caja.
    conciliarLoteOffline: (
      idLote: number,
      data: { foliosUtilizados: string[]; foliosNoUtilizados: string[] },
    ) =>
      request<RespuestaConciliacionLote>(`/tickets/lotes-offline/${idLote}/conciliar`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Solo para dispositivo perdido: destruye las ventas offline no subidas.
    invalidarLoteOffline: (idLote: number) =>
      request<{ mensaje?: string }>(`/tickets/lotes-offline/${idLote}`, {
        method: 'DELETE',
      }),
  },

  // 9. Guías (módulo EmisionTickets)
  // Sin alta propia: el guía nuevo se crea dentro de POST /tickets/emitir.
  guias: {
    // Paginado. Igual que `/usuarios`, valida la query con un DTO: solo acepta
    // `buscar`, `incluirAnulados`, `pagina` y `limite`.
    listar: (params?: {
      buscar?: string
      incluirAnulados?: boolean
      pagina?: number
      /** Tope del backend: 200. */
      limite?: number
    }) => {
      const queryParams = new URLSearchParams()
      if (params?.buscar) queryParams.append('buscar', params.buscar)
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaGuias>(`/guias${queryStr ? `?${queryStr}` : ''}`)
    },

    getById: (id: number) => request<GuiaBackend>(`/guias/${id}`),

    // numeroCarnet es obligatorio si tieneCarnet es true (400 si falta); al
    // pasar tieneCarnet false el backend limpia el número.
    actualizar: (
      id: number,
      data: { nombre?: string; tieneCarnet?: boolean; numeroCarnet?: string | null }
    ) =>
      request<GuiaBackend>(`/guias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    activar: (id: number) =>
      request<GuiaBackend>(`/guias/${id}/activar`, {
        method: 'PATCH',
      }),

    anular: (id: number) =>
      request<GuiaBackend>(`/guias/${id}`, {
        method: 'DELETE',
      }),
  },

  // 10. Tarifas (módulo EmisionTickets)
  // Editar un precio no sobrescribe la fila: cierra la vigencia actual y crea
  // una nueva, por eso los tickets ya vendidos conservan su precio original.
  tarifas: {
    getTarifas: () => request<TarifaBackend[]>('/tarifas'),

    // Paginado. `getTarifas` (las vigentes) NO lo está: sigue siendo arreglo
    // plano. Valida la query con un DTO: solo `idAtraccion`, `idOrigen`,
    // `pagina` y `limite`.
    getHistorico: (params?: {
      idAtraccion?: number
      idOrigen?: number
      pagina?: number
      /** Tope del backend: 200. */
      limite?: number
    }) => {
      const queryParams = new URLSearchParams()
      if (params?.idAtraccion) queryParams.append('idAtraccion', String(params.idAtraccion))
      if (params?.idOrigen) queryParams.append('idOrigen', String(params.idOrigen))
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaHistorialTarifas>(
        `/tarifas/historico${queryStr ? `?${queryStr}` : ''}`
      )
    },

    getTarifaGuia: () => request<{ precio: string }>('/tarifas/guia'),

    actualizarTarifa: (data: {
      idAtraccion: number
      idOrigen: number
      idTipoVisitante: number
      precio: number
    }) =>
      request<TarifaBackend>('/tarifas', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    actualizarTarifaGuia: (precio: number) =>
      request<{ precio: string }>('/tarifas/guia', {
        method: 'PATCH',
        body: JSON.stringify({ precio }),
      }),
  },

  // 11. Cajas (apertura, arqueo y cierre)
  // Solo puede existir una caja abierta a la vez en todo el sistema.
  // Apertura y cierre son inmutables: solo se pueden anular.
  cajas: {
    abrir: (data: { montoInicial: number; observaciones?: string }) =>
      request<AperturaCajaBackend>('/cajas/apertura', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listar: (params?: FiltrosCajas) => {
      const queryParams = new URLSearchParams()
      if (params?.estado) queryParams.append('estado', params.estado)
      if (params?.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
      if (params?.fechaFin) queryParams.append('fechaFin', params.fechaFin)
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaAperturasCajas>(`/cajas${queryStr ? `?${queryStr}` : ''}`)
    },

    // Historial de cierres. Vista de supervisión: exige Cajas/Editar, no Ver.
    // En el backend la ruta va antes de /cajas/:id para que el parámetro
    // numérico no capture "cierres".
    getCierres: (params?: FiltrosCierres) => {
      const queryParams = new URLSearchParams()
      if (params?.idUsuario) queryParams.append('idUsuario', String(params.idUsuario))
      if (params?.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
      if (params?.fechaFin) queryParams.append('fechaFin', params.fechaFin)
      if (params?.soloAnulados) queryParams.append('soloAnulados', 'true')
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaHistorialCierres>(`/cajas/cierres${queryStr ? `?${queryStr}` : ''}`)
    },

    // Devuelve null si no hay ninguna caja abierta
    // El backend responde un envoltorio { hayCajaAbierta, caja }, nunca null
    // directo. Leerlo sin desenvolver da un objeto siempre truthy: se veía una
    // "caja abierta" fantasma con montoInicial undefined (Q0.00).
    getActual: async (): Promise<AperturaCajaBackend | null> => {
      const res = await request<RespuestaCajaActual>('/cajas/actual')
      return res?.caja ?? null
    },

    getById: (id: number) => request<AperturaCajaBackend>(`/cajas/${id}`),

    // Previsualiza el monto esperado sin cerrar la caja.
    // Exige Cajas/Editar: es supervisión, no lectura. Quien cuenta el efectivo
    // no debe ver esta cifra antes de contar, o el arqueo pierde sentido.
    getArqueo: (id: number) => request<ArqueoCaja>(`/cajas/${id}/arqueo`),

    cerrar: (id: number, data: { montoContado: number; observaciones?: string }) =>
      request<RespuestaCierreCaja>(`/cajas/${id}/cierre`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Exige Cajas/Editar: es supervisión. Si el cajero pudiera anular su propio
    // cierre, cerraría, vería la diferencia, anularía y volvería a cerrar
    // cuadrado. Un cierre anulado no se reactiva: se emite uno nuevo.
    anularCierre: (id: number) =>
      request<AperturaCajaBackend>(`/cajas/${id}/cierre/anular`, {
        method: 'PATCH',
      }),

    anular: (id: number) =>
      request<AperturaCajaBackend>(`/cajas/${id}`, {
        method: 'DELETE',
      }),
  },

  // 12. Gastos (sub-módulo de Cajas)
  // Se asocian automáticamente a la caja abierta actual; solo se pueden tocar
  // mientras esa caja siga abierta.
  gastos: {
    crear: (data: { idTipoGasto: number; descripcion: string; monto: number }) =>
      request<GastoBackend>('/gastos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listar: (params?: { idAperturaCaja?: number; incluirAnulados?: boolean }) => {
      const queryParams = new URLSearchParams()
      if (params?.idAperturaCaja) queryParams.append('idAperturaCaja', String(params.idAperturaCaja))
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      const queryStr = queryParams.toString()
      return request<GastoBackend[]>(`/gastos${queryStr ? `?${queryStr}` : ''}`)
    },

    getById: (id: number) => request<GastoBackend>(`/gastos/${id}`),

    actualizar: (id: number, data: { descripcion?: string; monto?: number; idTipoGasto?: number }) =>
      request<GastoBackend>(`/gastos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    anular: (id: number) =>
      request<GastoBackend>(`/gastos/${id}`, {
        method: 'DELETE',
      }),
  },

  // 13. Tipos de Gasto (catálogo del sub-módulo Gastos)
  tiposGasto: {
    listar: (incluirAnulados: boolean = false) =>
      request<TipoGastoBackend[]>(`/tipos-gasto${incluirAnulados ? '?incluirAnulados=true' : ''}`),

    getById: (id: number) => request<TipoGastoBackend>(`/tipos-gasto/${id}`),

    crear: (data: { nombre: string }) =>
      request<TipoGastoBackend>('/tipos-gasto', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    actualizar: (id: number, data: { nombre: string }) =>
      request<TipoGastoBackend>(`/tipos-gasto/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    activar: (id: number) =>
      request<TipoGastoBackend>(`/tipos-gasto/${id}/activar`, {
        method: 'PATCH',
      }),

    anular: (id: number) =>
      request<TipoGastoBackend>(`/tipos-gasto/${id}`, {
        method: 'DELETE',
      }),
  },

  // 14. Pasarela de Pagos (Recurrente / Tarjeta)
  pagos: {
    // Confirmación pública invocada por la página de éxito tras el checkout de Recurrente.
    // Consulta a Recurrente y marca el cobro como PAGADO si status === "paid".
    confirmar: (idCheckout: string) =>
      request<RespuestaConfirmacionPago>(`/pagos/checkout/${idCheckout}/confirmar`, {
        method: 'POST',
      }),

    // Consulta interna del estado de cobro de un ticket y su link de checkout.
    getPorTicket: (idTicket: number) =>
      request<RespuestaPagoTicket>(`/pagos/ticket/${idTicket}`),
  },

  // 15. Donaciones
  // Solo efectivo y exigen caja abierta: el dinero entra al mismo cajón que las
  // ventas, así que suma al arqueo. El recibo no se edita, solo se anula.
  donaciones: {
    // Solo `monto` es obligatorio; sin nombre sale como "Donante anónimo".
    crear: (data: { monto: number; nombreDonante?: string; observaciones?: string }) =>
      request<DonacionBackend>('/donaciones', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listar: (params?: FiltrosDonaciones) => {
      const queryParams = new URLSearchParams()
      if (params?.buscar) queryParams.append('buscar', params.buscar)
      if (params?.idUsuario) queryParams.append('idUsuario', String(params.idUsuario))
      if (params?.idAperturaCaja)
        queryParams.append('idAperturaCaja', String(params.idAperturaCaja))
      if (params?.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
      if (params?.fechaFin) queryParams.append('fechaFin', params.fechaFin)
      if (params?.incluirAnulados) queryParams.append('incluirAnulados', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaHistorialDonaciones>(
        `/donaciones${queryStr ? `?${queryStr}` : ''}`,
      )
    },

    getById: (id: number) => request<DonacionBackend>(`/donaciones/${id}`),

    // Recibo no contable, 80 mm, sin QR. Anulado sale en rojo con sello.
    getPdf: (id: number) => solicitarBlob(`/donaciones/${id}/pdf`),

    // Falla con 400 si ya estaba anulado o si la caja de origen ya se cerró.
    anular: (id: number, motivo?: string) =>
      request<DonacionBackend>(`/donaciones/${id}`, {
        method: 'DELETE',
        body: JSON.stringify(motivo ? { motivo } : {}),
      }),
  },

  // 16. Actividades del Parque
  // La autoría manda sobre el permiso: editar, anular y administrar imágenes
  // solo los puede hacer el autor, aunque otro tenga la acción concedida.
  actividades: {
    // El autor se toma del token: enviar idUsuarioAutor devuelve 400.
    crear: (data: PayloadActividad) =>
      request<ActividadParqueBackend>('/actividades', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listar: (params?: FiltrosActividades) => {
      const queryParams = new URLSearchParams()
      if (params?.buscar) queryParams.append('buscar', params.buscar)
      if (params?.idSectorParque)
        queryParams.append('idSectorParque', String(params.idSectorParque))
      if (params?.idUsuarioAutor)
        queryParams.append('idUsuarioAutor', String(params.idUsuarioAutor))
      if (params?.soloMias) queryParams.append('soloMias', 'true')
      if (params?.incluirExpiradas) queryParams.append('incluirExpiradas', 'true')
      if (params?.incluirAnuladas) queryParams.append('incluirAnuladas', 'true')
      if (params?.soloAnuladas) queryParams.append('soloAnuladas', 'true')
      if (params?.pagina) queryParams.append('pagina', String(params.pagina))
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<RespuestaHistorialActividades>(
        `/actividades${queryStr ? `?${queryStr}` : ''}`,
      )
    },

    // 404 (no 403) si está fuera de su ventana y quien consulta no es el autor:
    // para un tercero, una publicación fuera de ventana simplemente no existe.
    getById: (id: number) => request<ActividadParqueBackend>(`/actividades/${id}`),

    // `fechaFin: null` quita la expiración; omitirla la deja como está.
    actualizar: (id: number, data: Partial<PayloadActividad>) =>
      request<ActividadParqueBackend>(`/actividades/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    anular: (id: number) =>
      request<ActividadParqueBackend>(`/actividades/${id}`, {
        method: 'DELETE',
      }),

    // Devuelve la publicación a la vista. Como anular, solo puede el autor, y
    // exige `Editar` (no `Anular`), igual que el resto de reactivaciones del
    // sistema. 400 si ya estaba activa. La ventana no se toca: una publicación
    // expirada vuelve expirada.
    activar: (id: number) =>
      request<ActividadParqueBackend>(`/actividades/${id}/activar`, {
        method: 'PATCH',
      }),

    // multipart/form-data con el archivo en el campo `imagen`
    subirImagen: (id: number, archivo: File) => {
      const fd = new FormData()
      fd.append('imagen', archivo)
      return request<ImagenActividad>(`/actividades/${id}/imagenes`, {
        method: 'POST',
        body: fd,
      })
    },

    // Va por endpoint y no como archivo estático para respetar permiso y
    // ventana de visibilidad. Como exige Authorization, un <img src> directo
    // no funciona: hay que pedirla como blob y usar un object URL.
    getImagen: (id: number, idImagen: number) =>
      solicitarBlob(`/actividades/${id}/imagenes/${idImagen}`, 'image/*'),

    // A diferencia del resto del sistema, esto sí borra fila y archivo.
    eliminarImagen: (id: number, idImagen: number) =>
      request<{ mensaje: string; id: number }>(`/actividades/${id}/imagenes/${idImagen}`, {
        method: 'DELETE',
      }),
  },

  // 17. Sectores del Parque
  // No es un módulo de permiso aparte: se gobierna con ActividadesParque, igual
  // que los catálogos de emisión viven bajo EmisionTickets.
  sectores: {
    // 409 si el nombre existe, incluso si ese sector está anulado: en ese caso
    // hay que reactivarlo, no crear un duplicado indistinguible en el selector.
    crear: (nombre: string) =>
      request<SectorParqueBackend>('/sectores', {
        method: 'POST',
        body: JSON.stringify({ nombre }),
      }),

    // Arreglo plano sin paginación: es un catálogo corto para un selector.
    listar: (incluirAnulados = false) =>
      request<SectorParqueBackend[]>(
        `/sectores${incluirAnulados ? '?incluirAnulados=true' : ''}`,
      ),

    getById: (id: number) => request<SectorParqueBackend>(`/sectores/${id}`),

    // Renombrar se refleja en todas las actividades: se guarda la referencia,
    // no una copia del nombre.
    actualizar: (id: number, nombre: string) =>
      request<SectorParqueBackend>(`/sectores/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre }),
      }),

    activar: (id: number) =>
      request<SectorParqueBackend>(`/sectores/${id}/activar`, {
        method: 'PATCH',
      }),

    // Baja lógica: sale del selector, el historial no se reescribe.
    anular: (id: number) =>
      request<SectorParqueBackend>(`/sectores/${id}`, {
        method: 'DELETE',
      }),
  },

  // 18. Reportes
  // Dos vías que no hay que confundir (REPORTES_FRONTEND.md § 1): el catálogo
  // —`catalogo` + `generar` + `descargar`— no sale a internet ni gasta cuota, y
  // es contra la que pegan todos los botones. `interpretar` es la única que
  // llama a la IA, y solo para elegir reporte y filtros.
  reportes: {
    /**
     * Catálogo ya filtrado por los permisos del usuario. Es la primera llamada
     * de la pantalla y la única fuente del menú: una lista escrita a mano
     * ofrecería reportes que responderían 403.
     */
    catalogo: () => request<RespuestaCatalogoReportes>('/reportes'),

    /**
     * Panel de gráficas: series listas para dibujar, sin pasar por un reporte.
     *
     * Solo acepta fechas. Los paneles cuyos datos el usuario no puede ver no
     * vienen vacíos: vienen declarados en `omitidos` con el motivo.
     */
    dashboard: (query = '') =>
      request<Dashboard>(`/reportes/dashboard${query ? `?${query}` : ''}`),

    /**
     * Ejecuta un reporte del catálogo. `query` ya viene armada con los
     * `parametros` que declara el catálogo — mandar uno que el reporte no
     * declara devuelve 400.
     */
    generar: (clave: string, query = '') =>
      request<ResultadoReporte>(`/reportes/${clave}${query ? `?${query}` : ''}`),

    /**
     * El mismo reporte como archivo. Exige `Reportes.Exportar`.
     *
     * Va por `fetch` y no por `window.open` ni un `<a href>`: la ruta pide
     * `Authorization: Bearer` y una navegación del navegador no manda esa
     * cabecera, así que esos dos atajos devuelven 401.
     */
    descargar: (clave: string, formato: 'pdf' | 'excel', query = '') =>
      solicitarArchivo(
        `/reportes/${clave}/${formato}${query ? `?${query}` : ''}`,
        formato === 'pdf' ? 'application/pdf' : TIPO_EXCEL,
      ),

    /** Descarga por URL ya armada. La usa la vía a medida con `urlDescarga`. */
    descargarPorUrl: (url: string) =>
      solicitarArchivo(url, url.includes('/excel') ? TIPO_EXCEL : 'application/pdf'),

    /**
     * Traduce una petición escrita. Única ruta con IA: 15 por minuto, y solo
     * debe dispararse desde un botón explícito, nunca al teclear.
     */
    interpretar: (instruccion: string) =>
      request<RespuestaInterpretacionReporte>('/reportes/interpretar', {
        method: 'POST',
        body: JSON.stringify({ instruccion }),
      }),
  },
}
