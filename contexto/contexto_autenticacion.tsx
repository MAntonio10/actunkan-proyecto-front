'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  type UsuarioBackend,
  type RegistroAuditoria,
  type ModuloMenu,
  PermisoBackend,
} from '@/tipos'
import {
  api,
  avisoDeSesion,
  conexionActual,
  esErrorDeRed,
  esSoloSincronizacion,
  guardarTokens,
  limpiarSesionLocal,
  obtenerRefreshToken,
  suscribirConexion,
} from '@/lib/api'
import { normalizarNombreModulo } from '@/lib/utils'
import { db, solicitarAlmacenamientoPersistente } from '@/lib/db_tickets'
import {
  actualizarModulosCache,
  iniciarSesionOffline as validarCredencialOffline,
  olvidarLlave,
  registrarCredencialOffline,
  restaurarSesionDeMemoria,
} from '@/lib/sesion_offline'
import {
  iniciarSincronizacionAutomatica,
  suscribirSincronizacion,
} from '@/lib/sincronizador_tickets'

interface ContextoAutenticacion {
  usuario: UsuarioBackend | null
  token: string | null
  estaAutenticado: boolean
  cargando: boolean
  iniciarSesion: (correo: string, contrasena: string, recordarme?: boolean) => Promise<UsuarioBackend>
  /** Valida la contraseña contra el verificador guardado en el dispositivo y
   *  restaura la sesión cacheada. No toca la red. */
  iniciarSesionSinConexion: (correo: string, contrasena: string) => Promise<UsuarioBackend>
  /** La sesión en curso se restauró sin conexión: los datos son los del último
   *  inicio con internet y pueden estar desactualizados. */
  sesionSinConexion: boolean
  /** Señal del navegador, útil para la interfaz. No garantiza salida real. */
  enLinea: boolean
  /** El usuario fue dado de baja mientras operaba sin conexión. La sesión solo
   *  sirve para subir y conciliar lo ya vendido (endpoints 18.6). */
  soloSincronizacion: boolean
  avisoSesion: string | null
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
  const [sesionSinConexion, setSesionSinConexion] = useState<boolean>(false)
  const [enLinea, setEnLinea] = useState<boolean>(true)
  const [soloSincronizacion, setSoloSincronizacion] = useState<boolean>(false)
  const [avisoSesion, setAvisoSesion] = useState<string | null>(null)

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
      .catch(async (error) => {
        // Sin red no se puede saber si el token sigue siendo válido. Borrar la
        // sesión acá dejaba al taquillero sin poder entrar justo cuando no hay
        // internet para iniciar sesión de nuevo, y se llevaba por delante el
        // refresh token que hace falta para subir las ventas al reconectar.
        if (esErrorDeRed(error)) {
          // La llave sobrevive a la recarga en sessionStorage, así que se puede
          // retomar la sesión sin volver a pedir la contraseña. Solo cuando no
          // hay respaldo —aplicación cerrada y reabierta— se manda al login.
          const cacheada = await restaurarSesionDeMemoria()
          if (cacheada) {
            setUsuario(cacheada.usuario)
            setModulosPermitidos(cacheada.modulosPermitidos)
            setCargandoModulos(false)
            setSesionSinConexion(true)
            return
          }
          setToken(null)
          setUsuario(null)
          return
        }

        setToken(null)
        setUsuario(null)
        limpiarSesionLocal()
      })
      .finally(() => {
        setCargando(false)
      })
  }, [])

  // Estado de conexión y arranque del sincronizador de ventas offline.
  useEffect(() => {
    // Conexión observada, no `navigator.onLine`: con el wifi conectado pero sin
    // salida a internet, el navegador informa que hay red y la barra mentía.
    setEnLinea(conexionActual())
    const dejarDeEscucharConexion = suscribirConexion(setEnLinea)

    // Se relee en cada tick del sincronizador porque el modo restringido puede
    // aparecer a mitad de sesión: lo activa el refresh, no el login.
    const leerRestriccion = () => {
      setSoloSincronizacion(esSoloSincronizacion())
      setAvisoSesion(avisoDeSesion())
    }
    leerRestriccion()
    const dejarDeEscuchar = suscribirSincronizacion(leerRestriccion)
    const detenerSincronizacion = iniciarSincronizacionAutomatica()

    // Sin esto el navegador puede descartar IndexedDB por falta de espacio, y
    // en iOS lo hace tras unos días sin abrir la aplicación. Ahí viven los
    // folios pre-firmados y las ventas cobradas sin subir.
    void solicitarAlmacenamientoPersistente()

    return () => {
      dejarDeEscucharConexion()
      dejarDeEscuchar()
      detenerSincronizacion()
    }
  }, [])

  const iniciarSesion = useCallback(async (correo: string, contrasena: string, recordarme: boolean = false): Promise<UsuarioBackend> => {
    const respuesta = await api.auth.login(correo, contrasena, recordarme)
    guardarTokens(respuesta)
    setToken(respuesta.access_token)
    setUsuario(respuesta.usuario)
    setSesionSinConexion(false)

    // Único momento en que el navegador tiene la contraseña en claro: se
    // aprovecha para dejar listo el verificador del acceso sin conexión y la
    // llave que descifra los folios pre-firmados. La contraseña no se guarda.
    try {
      await registrarCredencialOffline({
        correo,
        contrasena,
        usuario: respuesta.usuario,
        refreshToken: respuesta.refresh_token,
      })
    } catch (error) {
      // Sin acceso offline se puede seguir vendiendo con red; no se bloquea el
      // inicio de sesión por esto.
      console.warn('No se pudo preparar el acceso sin conexión:', error)
    }

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

  const iniciarSesionSinConexion = useCallback(
    async (correo: string, contrasena: string): Promise<UsuarioBackend> => {
      const sesion = await validarCredencialOffline(correo, contrasena)

      // El refresh token cifrado es el respaldo: si el almacenamiento del
      // navegador se limpió, es lo único que permite volver a hablar con el
      // backend al reconectar sin pedir un nuevo inicio de sesión.
      if (sesion.refreshToken && !obtenerRefreshToken()) {
        localStorage.setItem('refresh_token', sesion.refreshToken)
      }
      localStorage.setItem('usuario', JSON.stringify(sesion.usuario))

      setUsuario(sesion.usuario)
      setModulosPermitidos(sesion.modulosPermitidos)
      setCargandoModulos(false)
      setSesionSinConexion(true)

      const registro: RegistroAuditoria = {
        id: `audit-${Date.now()}`,
        usuario_id: String(sesion.usuario.id),
        usuario_nombre: sesion.usuario.nombre,
        tipo_actividad: 'login',
        descripcion: 'Inicio de sesión sin conexión',
        fecha_hora: new Date(),
      }
      setHistorialAuditoria((prev) => [registro, ...prev])

      return sesion.usuario
    },
    [],
  )

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
    // La llave en memoria se descarta: los folios pre-firmados quedan cifrados
    // hasta el próximo inicio de sesión. El verificador offline sobrevive a
    // propósito, o cerrar sesión dejaría al taquillero sin poder volver a
    // entrar cuando no hay internet.
    olvidarLlave()
    setToken(null)
    setUsuario(null)
    setSesionSinConexion(false)
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
      const modulos = Array.isArray(res) ? res : []
      setModulosPermitidos(modulos)

      // Se cachean para poder navegar sin red en la próxima sesión.
      await db.modulos.put({
        clave: 'actual',
        idUsuario: usuario?.id ?? 0,
        modulos,
        fechaDescarga: new Date().toISOString(),
      })
      if (usuario?.correo) {
        await actualizarModulosCache(usuario.correo, modulos)
      }
    } catch {
      // Dejar la lista vacía hacía que RutaProtegida mostrara "sin módulos
      // asignados" apenas se caía la red: sesión válida, taquillero encerrado.
      // Se cae al último listado conocido de este usuario.
      const cache = await db.modulos.get('actual')
      if (cache && (!usuario || cache.idUsuario === usuario.id)) {
        setModulosPermitidos(cache.modulos)
      } else {
        setModulosPermitidos([])
      }
    } finally {
      setCargandoModulos(false)
    }
  }, [usuario])

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
        iniciarSesionSinConexion,
        sesionSinConexion,
        enLinea,
        soloSincronizacion,
        avisoSesion,
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
