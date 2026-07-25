import {
  UsuarioBackend,
  PuestoBackend,
  ModuloBackend,
  AccionBackend,
  ModuloAccionBackend,
  RespuestaLogin,
  BitacoraBackend,
  FiltrosBitacora,
} from '@/tipos'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  // Endpoints públicos que no requieren token
  const esEndpointPublico = endpoint.startsWith('/auth/')

  // Si no hay token y el endpoint requiere autenticación, redirigir al login silenciosamente
  if (!token && !esEndpointPublico && typeof window !== 'undefined') {
    window.location.href = '/login'
    // Lanzar error silencioso para cortar la ejecución sin mostrar toast
    throw new ApiError('Sesión no activa', 401)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

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

    // Si el backend responde 401, limpiar sesión y redirigir
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
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
    getModulos: (incluirAnulados: boolean = true) =>
      request<ModuloBackend[]>(`/modulos${incluirAnulados ? '?incluirAnulados=true' : ''}`),

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
}
