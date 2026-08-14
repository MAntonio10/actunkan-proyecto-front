'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  type UsuarioBackend,
  type RegistroAuditoria,
  type ModuloMenu,
  PermisoBackend,
} from '@/tipos'
import { api, guardarTokens, limpiarSesionLocal, obtenerRefreshToken } from '@/lib/api'
import { normalizarNombreModulo } from '@/lib/utils'

interface ContextoAutenticacion {
  usuario: UsuarioBackend | null
  token: string | null
  estaAutenticado: boolean
  cargando: boolean
  iniciarSesion: (correo: string, contrasena: string, recordarme?: boolean) => Promise<UsuarioBackend>
  cerrarSesion: () => void
  cerrarTodasLasSesiones: () => Promise<void>
  tienePermiso: (modulo: string, accion: string) => boolean
  tieneAccesoModulo: (modulo: string) => boolean
  tieneAlgunPermiso: () => boolean
  /** Módulos concedidos con sus acciones, desde GET /modulos/mis-modulos. */
  modulosPermitidos: ModuloMenu[]
  cargandoModulos: boolean
  /** Fuente autoritativa para habilitar botones dentro de una pantalla. */
  puedeAccion: (modulo: string, accion: string) => boolean
  refrescarUsuario: () => Promise<void>
  refrescarModulos: () => Promise<void>
  registrarAuditoria: (actividad: RegistroAuditoria) => void
  historialAuditoria: RegistroAuditoria[]
}

const AuthContext = createContext<ContextoAutenticacion | undefined>(undefined)

// =========================================================================
// ACCESO TEMPORAL DEV (DESARROLLO)
// Cambiar a 'false' o borrar este valor para revertir la seguridad a normal.
// =========================================================================
export const ACCESO_TEMPORAL_DEV = false

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioBackend | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cargando, setCargando] = useState<boolean>(true)
  const [historialAuditoria, setHistorialAuditoria] = useState<RegistroAuditoria[]>([])
  const [modulosPermitidos, setModulosPermitidos] = useState<ModuloMenu[]>([])
  const [cargandoModulos, setCargandoModulos] = useState<boolean>(true)

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
        // Token inválido o expirado y sin refresh válido
        limpiarSesionLocal()
        setToken(null)
        setUsuario(null)
      })
      .finally(() => {
        setCargando(false)
      })
  }, [])

  const iniciarSesion = useCallback(async (correo: string, contrasena: string, recordarme: boolean = false): Promise<UsuarioBackend> => {
    const respuesta = await api.auth.login(correo, contrasena, recordarme)
    guardarTokens(respuesta)
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

    // Revocar el refresh token en el servidor; la sesión local se cierra igual
    // aunque la llamada falle (red caída, token ya expirado).
    const refreshToken = obtenerRefreshToken()
    if (refreshToken) {
      api.auth.logout(refreshToken).catch(() => {})
    }

    limpiarSesionLocal()
    setToken(null)
    setUsuario(null)
    router.replace('/login')
  }, [usuario, router])

  const cerrarTodasLasSesiones = useCallback(async () => {
    await api.auth.logoutTodas()
    limpiarSesionLocal()
    setToken(null)
    setUsuario(null)
    router.replace('/login')
  }, [router])



  const refrescarModulos = useCallback(async () => {
    setCargandoModulos(true)
    try {
      const res = await api.modulos.misModulos()
      setModulosPermitidos(Array.isArray(res) ? res : [])
    } catch {
      setModulosPermitidos([])
    } finally {
      setCargandoModulos(false)
    }
  }, [])

  // Los módulos concedidos se cargan una sola vez por sesión y se comparten:
  // antes cada barra de navegación hacía su propia llamada.
  useEffect(() => {
    if (!usuario) {
      setModulosPermitidos([])
      setCargandoModulos(false)
      return
    }
    refrescarModulos()
  }, [usuario, refrescarModulos])

  /**
   * Habilita acciones dentro de una pantalla usando `acciones` de
   * /modulos/mis-modulos, que es la lista efectivamente concedida al usuario.
   * No se usa `usuario.permiso` porque /auth/me no garantiza traerlo expandido
   * (la documentación lo muestra vacío), lo que hacía que un botón como
   * "Abrir Caja" apareciera para alguien con permiso de solo lectura.
   */
  const puedeAccion = useCallback(
    (modulo: string, accion: string): boolean => {
      if (ACCESO_TEMPORAL_DEV) return true
      const objetivo = normalizarNombreModulo(modulo)
      const mod = modulosPermitidos.find((m) => normalizarNombreModulo(m.nombre) === objetivo)
      if (!mod || !Array.isArray(mod.acciones)) return false
      return mod.acciones.some((a) => normalizarNombreModulo(a) === normalizarNombreModulo(accion))
    },
    [modulosPermitidos]
  )

  const tieneAlgunPermiso = useCallback((): boolean => {
    if (ACCESO_TEMPORAL_DEV) return true
    if (!usuario) return false
    if (modulosPermitidos.length > 0) return true
    const listaPermisos = usuario.permiso || (usuario as unknown as { permisos?: PermisoBackend[] }).permisos
    if (Array.isArray(listaPermisos)) {
      return listaPermisos.length > 0
    }
    return false
  }, [usuario, modulosPermitidos])

  const tienePermiso = useCallback(
    (modulo: string, accion: string): boolean => {
      if (ACCESO_TEMPORAL_DEV) return true
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
          return (
            normalizarNombreModulo(m) === normalizarNombreModulo(modulo) &&
            normalizarNombreModulo(a) === normalizarNombreModulo(accion)
          )
        })
      }
      return false
    },
    [usuario]
  )

  const tieneAccesoModulo = useCallback(
    (modulo: string): boolean => {
      if (ACCESO_TEMPORAL_DEV) return true
      if (!usuario) return false

      // mis-modulos es la fuente autoritativa; se consulta primero. Se mantiene
      // el respaldo sobre usuario.permiso para no dejar sin navegación a nadie
      // si esa llamada falla (aquí un falso negativo bloquea la app entera,
      // a diferencia de puedeAccion, que solo oculta un botón).
      const objetivo = normalizarNombreModulo(modulo)
      if (modulosPermitidos.some((m) => normalizarNombreModulo(m.nombre) === objetivo)) {
        return true
      }

      const listaPermisos = usuario.permiso || (usuario as unknown as { permisos?: PermisoBackend[] }).permisos
      if (Array.isArray(listaPermisos)) {
        if (listaPermisos.length === 0) return false
        return listaPermisos.some((p: any) => {
          const modObj = p.moduloAccion?.modulo || p.modulo
          if (modObj && modObj.anulado) return false
          const m = modObj?.nombre
          return Boolean(m) && normalizarNombreModulo(m) === normalizarNombreModulo(modulo)
        })
      }
      return false
    },
    [usuario, modulosPermitidos]
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
        cerrarTodasLasSesiones,
        tienePermiso,
        tieneAccesoModulo,
        tieneAlgunPermiso,
        modulosPermitidos,
        cargandoModulos,
        puedeAccion,
        refrescarUsuario,
        refrescarModulos,
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
