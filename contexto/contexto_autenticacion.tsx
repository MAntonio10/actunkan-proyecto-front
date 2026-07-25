'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { type UsuarioBackend, type RegistroAuditoria, PermisoBackend } from '@/tipos'
import { api } from '@/lib/api'

interface ContextoAutenticacion {
  usuario: UsuarioBackend | null
  token: string | null
  estaAutenticado: boolean
  cargando: boolean
  iniciarSesion: (correo: string, contrasena: string, recordarme?: boolean) => Promise<UsuarioBackend>
  cerrarSesion: () => void
  tienePermiso: (modulo: string, accion: string) => boolean
  tieneAccesoModulo: (modulo: string) => boolean
  tieneAlgunPermiso: () => boolean
  refrescarUsuario: () => Promise<void>
  registrarAuditoria: (actividad: RegistroAuditoria) => void
  historialAuditoria: RegistroAuditoria[]
}

const AuthContext = createContext<ContextoAutenticacion | undefined>(undefined)

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioBackend | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState<boolean>(true)
  const [historialAuditoria, setHistorialAuditoria] = useState<RegistroAuditoria[]>([])

  // Cargar usuario autenticado al iniciar desde token guardado
  useEffect(() => {
    const tokenGuardado = localStorage.getItem('token')
    if (!tokenGuardado) {
      setCargando(false)
      return
    }

    setToken(tokenGuardado)
    api.auth
      .getMe()
      .then((u) => {
        setUsuario(u)
      })
      .catch(() => {
        // Token inválido o expirado
        localStorage.removeItem('token')
        setToken(null)
        setUsuario(null)
      })
      .finally(() => {
        setCargando(false)
      })
  }, [])

  const iniciarSesion = useCallback(async (correo: string, contrasena: string, recordarme: boolean = false): Promise<UsuarioBackend> => {
    const respuesta = await api.auth.login(correo, contrasena, recordarme)
    localStorage.setItem('token', respuesta.access_token)
    setToken(respuesta.access_token)
    setUsuario(respuesta.usuario)

    // Registrar en auditoría local
    const registro: RegistroAuditoria = {
      id: `audit-${Date.now()}`,
      usuario_id: String(respuesta.usuario.id),
      usuario_nombre: respuesta.usuario.nombre,
      tipo_actividad: 'login',
      descripcion: `Inicio de sesión exitoso como ${respuesta.usuario.puesto?.nombre || 'Usuario'}`,
      fecha_hora: new Date(),
    }
    setHistorialAuditoria((prev) => [registro, ...prev])

    return respuesta.usuario
  }, [])

  const cerrarSesion = useCallback(() => {
    if (usuario) {
      const registro: RegistroAuditoria = {
        id: `audit-${Date.now()}`,
        usuario_id: String(usuario.id),
        usuario_nombre: usuario.nombre,
        tipo_actividad: 'logout',
        descripcion: 'Cierre de sesión',
        fecha_hora: new Date(),
      }
      setHistorialAuditoria((prev) => [registro, ...prev])
    }
    localStorage.removeItem('token')
    setToken(null)
    setUsuario(null)
    router.replace('/login')
  }, [usuario, router])

  const tieneAlgunPermiso = useCallback((): boolean => {
    if (!usuario) return false
    const listaPermisos = usuario.permiso || (usuario as unknown as { permisos?: PermisoBackend[] }).permisos
    if (Array.isArray(listaPermisos)) {
      return listaPermisos.length > 0
    }
    return false
  }, [usuario])

  const tienePermiso = useCallback(
    (modulo: string, accion: string): boolean => {
      if (!usuario) return false
      const listaPermisos = usuario.permiso || (usuario as unknown as { permisos?: PermisoBackend[] }).permisos
      if (Array.isArray(listaPermisos)) {
        if (listaPermisos.length === 0) return false
        return listaPermisos.some((p: any) => {
          const modObj = p.moduloAccion?.modulo || p.modulo
          if (modObj && modObj.anulado) return false
          const m = modObj?.nombre
          const a = p.moduloAccion?.accion?.nombre || p.accion?.nombre
          if (!m || !a) return false
          return m.toLowerCase().trim() === modulo.toLowerCase().trim() && a.toLowerCase().trim() === accion.toLowerCase().trim()
        })
      }
      return false
    },
    [usuario]
  )

  const tieneAccesoModulo = useCallback(
    (modulo: string): boolean => {
      if (!usuario) return false
      const listaPermisos = usuario.permiso || (usuario as unknown as { permisos?: PermisoBackend[] }).permisos
      if (Array.isArray(listaPermisos)) {
        if (listaPermisos.length === 0) return false
        return listaPermisos.some((p: any) => {
          const modObj = p.moduloAccion?.modulo || p.modulo
          if (modObj && modObj.anulado) return false
          const m = modObj?.nombre
          return m && m.toLowerCase().trim() === modulo.toLowerCase().trim()
        })
      }
      return false
    },
    [usuario]
  )

  const refrescarUsuario = useCallback(async () => {
    try {
      const tokenGuardado = localStorage.getItem('token')
      if (!tokenGuardado) return
      const u = await api.auth.getMe()
      setUsuario(u)
    } catch {
      // Ignorar si falla
    }
  }, [])

  const registrarAuditoria = useCallback((actividad: RegistroAuditoria) => {
    setHistorialAuditoria((prev) => [actividad, ...prev])
  }, [])

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        estaAutenticado: !!usuario,
        cargando,
        iniciarSesion,
        cerrarSesion,
        tienePermiso,
        tieneAccesoModulo,
        tieneAlgunPermiso,
        refrescarUsuario,
        registrarAuditoria,
        historialAuditoria,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAutenticacion() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion')
  }
  return context
}
