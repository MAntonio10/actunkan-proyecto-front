import {
  UsuarioBackend,
  PuestoBackend,
  ModuloBackend,
  ModuloMenu,
  AccionBackend,
  ModuloAccionBackend,
  RespuestaLogin,
  RespuestaTokens,
  SesionBackend,
  BitacoraBackend,
  FiltrosBitacora,
  CatalogosTickets,
  PayloadEmisionTicket,
  RespuestaEmisionTicket,
  RespuestaHistorialTickets,
  RespuestaValidacionTicket,
  TicketBackend,
  FiltrosTickets,
  TarifaBackend,
  AperturaCajaBackend,
  RespuestaCajaActual,
  ArqueoCaja,
  RespuestaCierreCaja,
  FiltrosCajas,
  GastoBackend,
  TipoGastoBackend,
} from '@/tipos'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

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
  return ENDPOINTS_PUBLICOS.includes(rutaDe(endpoint))
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

export function obtenerToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null
}

export function obtenerRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
}

export function guardarTokens(tokens: RespuestaTokens): void {
  localStorage.setItem('token', tokens.access_token)
  localStorage.setItem('refresh_token', tokens.refresh_token)
}

export function limpiarSesionLocal(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('usuario')
}

// Un solo refresh en vuelo: si varias peticiones reciben 401 a la vez, todas
// esperan la misma renovación en lugar de gastar (y rotar) el refresh token
// varias veces, lo que el backend interpretaría como robo de token.
let refrescoEnCurso: Promise<string | null> | null = null

async function refrescarTokens(): Promise<string | null> {
  const refreshToken = obtenerRefreshToken()
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) return null

  const tokens: RespuestaTokens = await response.json()
  guardarTokens(tokens)
  return tokens.access_token
}

function refrescarTokensUnaVez(): Promise<string | null> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = refrescarTokens()
      .catch(() => null)
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const esPublico = esEndpointPublico(endpoint)
  // Un 401 de negocio se propaga como error normal, sin refrescar ni redirigir
  const trata401ComoSesion = !esPublico && !el401EsDeNegocio(endpoint)
  let token = obtenerToken()

  // Si no hay token y el endpoint requiere autenticación, redirigir al login silenciosamente
  if (!token && !esPublico && typeof window !== 'undefined') {
    window.location.href = '/login'
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
      limpiarSesionLocal()
      window.location.href = '/login'
    }

    throw new ApiError(errorMessage, response.status)
  }

  // Para respuestas vacías o 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
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
    getUsuarios: (incluirAnulados: boolean = true) =>
      request<UsuarioBackend[]>(`/usuarios${incluirAnulados ? '?incluirAnulados=true' : ''}`),

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
      if (params?.limite) queryParams.append('limite', String(params.limite))
      const queryStr = queryParams.toString()
      return request<BitacoraBackend[]>(`/bitacora${queryStr ? `?${queryStr}` : ''}`)
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
  },

  // 9. Tarifas (módulo EmisionTickets)
  // Editar un precio no sobrescribe la fila: cierra la vigencia actual y crea
  // una nueva, por eso los tickets ya vendidos conservan su precio original.
  tarifas: {
    getTarifas: () => request<TarifaBackend[]>('/tarifas'),

    getHistorico: (params?: { idAtraccion?: number; idOrigen?: number }) => {
      const queryParams = new URLSearchParams()
      if (params?.idAtraccion) queryParams.append('idAtraccion', String(params.idAtraccion))
      if (params?.idOrigen) queryParams.append('idOrigen', String(params.idOrigen))
      const queryStr = queryParams.toString()
      return request<TarifaBackend[]>(`/tarifas/historico${queryStr ? `?${queryStr}` : ''}`)
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

  // 10. Cajas (apertura, arqueo y cierre)
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
      const queryStr = queryParams.toString()
      return request<AperturaCajaBackend[]>(`/cajas${queryStr ? `?${queryStr}` : ''}`)
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

    // Previsualiza el monto esperado sin cerrar la caja
    getArqueo: (id: number) => request<ArqueoCaja>(`/cajas/${id}/arqueo`),

    cerrar: (id: number, data: { montoContado: number; observaciones?: string }) =>
      request<RespuestaCierreCaja>(`/cajas/${id}/cierre`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    anularCierre: (id: number) =>
      request<AperturaCajaBackend>(`/cajas/${id}/cierre/anular`, {
        method: 'PATCH',
      }),

    anular: (id: number) =>
      request<AperturaCajaBackend>(`/cajas/${id}`, {
        method: 'DELETE',
      }),
  },

  // 11. Gastos (sub-módulo de Cajas)
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

  // 12. Tipos de Gasto (catálogo del sub-módulo Gastos)
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
}
