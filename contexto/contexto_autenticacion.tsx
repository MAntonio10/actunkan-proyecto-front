'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Usuario, type RegistroAuditoria, USUARIO_DEMO } from '@/tipos'

interface ContextoAutenticacion {
  usuario: Usuario | null
  estaAutenticado: boolean
  iniciarSesion: (usuario: Usuario) => void
  cerrarSesion: () => void
  registrarAuditoria: (actividad: RegistroAuditoria) => void
  historialAuditoria: RegistroAuditoria[]
}

const AuthContext = createContext<ContextoAutenticacion | undefined>(undefined)

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  // Para demo, iniciamos con el usuario de ejemplo
  const [usuario, setUsuario] = useState<Usuario | null>(USUARIO_DEMO)
  const [historialAuditoria, setHistorialAuditoria] = useState<RegistroAuditoria[]>([])

  const iniciarSesion = useCallback((nuevoUsuario: Usuario) => {
    setUsuario(nuevoUsuario)
    
    // Registrar en auditoria
    const registro: RegistroAuditoria = {
      id: `audit-${Date.now()}`,
      usuario_id: nuevoUsuario.id,
      usuario_nombre: nuevoUsuario.nombre,
      tipo_actividad: 'login',
      descripcion: `Inicio de sesion exitoso como ${nuevoUsuario.rol}`,
      fecha_hora: new Date(),
    }
    setHistorialAuditoria(prev => [registro, ...prev])
  }, [])

  const cerrarSesion = useCallback(() => {
    if (usuario) {
      // Registrar cierre de sesion
      const registro: RegistroAuditoria = {
        id: `audit-${Date.now()}`,
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        tipo_actividad: 'logout',
        descripcion: 'Cierre de sesion',
        fecha_hora: new Date(),
      }
      setHistorialAuditoria(prev => [registro, ...prev])
    }
    setUsuario(null)
  }, [usuario])

  const registrarAuditoria = useCallback((actividad: RegistroAuditoria) => {
    setHistorialAuditoria(prev => [actividad, ...prev])
  }, [])

  return (
    <AuthContext.Provider
      value={{
        usuario,
        estaAutenticado: !!usuario,
        iniciarSesion,
        cerrarSesion,
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
