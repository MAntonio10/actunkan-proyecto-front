'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Users,
  Briefcase,
  ShieldCheck,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Lock,
  Key,
  FolderPlus,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'

import { api } from '@/lib/api'
import { useAutenticacion, ACCESO_TEMPORAL_DEV } from '@/contexto/contexto_autenticacion'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import {
  UsuarioBackend,
  PuestoBackend,
  ModuloBackend,
  AccionBackend,
  ModuloAccionBackend,
} from '@/tipos'

// --- ESQUEMAS ZOD ---
const esquemaCrearUsuario = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  correo: z.string().email('Ingrese un correo electrónico válido'),
  contrasena: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  telefono: z.string().min(8, 'Ingrese un teléfono válido (mínimo 8 dígitos)'),
  idPuesto: z.coerce.number().min(1, 'Seleccione un puesto de trabajo'),
})

const esquemaEditarUsuario = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  correo: z.string().email('Ingrese un correo electrónico válido'),
  telefono: z.string().min(8, 'Ingrese un teléfono válido'),
  idPuesto: z.coerce.number().min(1, 'Seleccione un puesto de trabajo'),
})

const esquemaPuesto = z.object({
  nombre: z.string().min(2, 'Nombre de puesto requerido'),
  descripcion: z.string().min(3, 'Descripción requerida'),
})

const esquemaModulo = z.object({
  nombre: z.string().min(2, 'Nombre de módulo requerido'),
})

const esquemaAccion = z.object({
  nombre: z.string().min(2, 'Nombre de acción requerido'),
})

type FormCrearUsuario = z.infer<typeof esquemaCrearUsuario>
type FormEditarUsuario = z.infer<typeof esquemaEditarUsuario>
type FormPuesto = z.infer<typeof esquemaPuesto>
type FormModulo = z.infer<typeof esquemaModulo>
type FormAccion = z.infer<typeof esquemaAccion>

function obtenerIniciales(nombre: string) {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatoFecha(fechaIso?: string) {
  if (!fechaIso) return 'N/A'
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fechaIso))
}

export default function ModuloUsuariosHubPage() {
  const { usuario, tienePermiso, tieneAccesoModulo, refrescarUsuario } = useAutenticacion()

  const [modulos, setModulos] = useState<ModuloBackend[]>([])

  const esModuloDeshabilitadoBD = useCallback(
    (nombre: string) => {
      if (ACCESO_TEMPORAL_DEV) return false
      const m = modulos.find((mod) => mod.nombre.toLowerCase().trim() === nombre.toLowerCase().trim())
      return m ? m.anulado : false
    },
    [modulos]
  )

  // PERMISOS DE USUARIOS
  const puedeVerUsuarios = !esModuloDeshabilitadoBD('Usuarios') && (tieneAccesoModulo('Usuarios') || tienePermiso('Usuarios', 'Ver'))
  const puedeCrearUsuarios = !esModuloDeshabilitadoBD('Usuarios') && tienePermiso('Usuarios', 'Crear')
  const puedeEditarUsuarios = !esModuloDeshabilitadoBD('Usuarios') && tienePermiso('Usuarios', 'Editar')
  const puedeAnularUsuarios = !esModuloDeshabilitadoBD('Usuarios') && tienePermiso('Usuarios', 'Anular')

  // PERMISOS DE PUESTOS
  const puedeVerPuestos = !esModuloDeshabilitadoBD('Puestos') && (tieneAccesoModulo('Puestos') || tienePermiso('Puestos', 'Ver'))
  const puedeCrearPuestos = !esModuloDeshabilitadoBD('Puestos') && tienePermiso('Puestos', 'Crear')
  const puedeEditarPuestos = !esModuloDeshabilitadoBD('Puestos') && tienePermiso('Puestos', 'Editar')
  const puedeAnularPuestos = !esModuloDeshabilitadoBD('Puestos') && tienePermiso('Puestos', 'Anular')

  // PERMISOS DE MÓDULOS Y ACCIONES
  const puedeVerModulos = !esModuloDeshabilitadoBD('Modulos') && (tieneAccesoModulo('Modulos') || tienePermiso('Modulos', 'Ver'))
  const puedeCrearModulos = !esModuloDeshabilitadoBD('Modulos') && tienePermiso('Modulos', 'Crear')
  const puedeEditarModulos = !esModuloDeshabilitadoBD('Modulos') && tienePermiso('Modulos', 'Editar')
  const puedeAnularModulos = !esModuloDeshabilitadoBD('Modulos') && tienePermiso('Modulos', 'Anular')

  const puedeVerAcciones = tieneAccesoModulo('Acciones') || tienePermiso('Acciones', 'Ver')
  const puedeCrearAcciones = tienePermiso('Acciones', 'Crear')
  const puedeEditarAcciones = tienePermiso('Acciones', 'Editar')
  const puedeEliminarAcciones = tienePermiso('Acciones', 'Anular')

  const puedeVerPermisos = puedeVerModulos || puedeVerAcciones
  const [pestanaActiva, setPestanaActiva] = useState<string>('usuarios')

  const [usuarios, setUsuarios] = useState<UsuarioBackend[]>([])
  const [puestos, setPuestos] = useState<PuestoBackend[]>([])
  const [acciones, setAcciones] = useState<AccionBackend[]>([])
  const [moduloAcciones, setModuloAcciones] = useState<ModuloAccionBackend[]>([])

  const [cargandoDatos, setCargandoDatos] = useState(true)

  // --- FILTROS DE USUARIOS ---
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [filtroEstadoUsuario, setFiltroEstadoUsuario] = useState<'activos' | 'anulados' | 'todos'>('activos')
  const [filtroPuestoUsuario, setFiltroPuestoUsuario] = useState<string>('todos')

  // --- FILTROS DE PUESTOS ---
  const [busquedaPuesto, setBusquedaPuesto] = useState('')
  const [filtroEstadoPuesto, setFiltroEstadoPuesto] = useState<'activos' | 'anulados' | 'todos'>('activos')

  // --- MODALES USUARIO ---
  const [modalCrearUsuarioAbierto, setModalCrearUsuarioAbierto] = useState(false)
  const [mostrarContrasenaCrear, setMostrarContrasenaCrear] = useState(false)
  const [modalEditarUsuarioAbierto, setModalEditarUsuarioAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioBackend | null>(null)
  const [usuarioAnular, setUsuarioAnular] = useState<UsuarioBackend | null>(null)

  // --- MODAL PERMISOS DE USUARIO ---
  const [modalPermisosAbierto, setModalPermisosAbierto] = useState(false)
  const [usuarioPermisos, setUsuarioPermisos] = useState<UsuarioBackend | null>(null)
  const [idsPermisosSeleccionados, setIdsPermisosSeleccionados] = useState<number[]>([])
  const [guardandoPermisos, setGuardandoPermisos] = useState(false)

  // --- MODALES PUESTO ---
  const [modalPuestoAbierto, setModalPuestoAbierto] = useState(false)
  const [puestoEditando, setPuestoEditando] = useState<PuestoBackend | null>(null)
  const [puestoAnular, setPuestoAnular] = useState<PuestoBackend | null>(null)

  // --- MODALES MÓDULOS Y ACCIONES ---
  const [modalModuloAbierto, setModalModuloAbierto] = useState(false)
  const [moduloEditando, setModuloEditando] = useState<ModuloBackend | null>(null)
  const [moduloAnular, setModuloAnular] = useState<ModuloBackend | null>(null)

  const [modalAccionAbierto, setModalAccionAbierto] = useState(false)
  const [accionEditando, setAccionEditando] = useState<AccionBackend | null>(null)
  const [accionEliminar, setAccionEliminar] = useState<AccionBackend | null>(null)

  const [idModuloVincular, setIdModuloVincular] = useState<string>('')
  const [idAccionVincular, setIdAccionVincular] = useState<string>('')

  // --- CARGA INICIAL Y DE TAB SELECCIONADA ---
  const cargarDatos = useCallback(
    async (tabTarget?: string) => {
      const tab = tabTarget || pestanaActiva
      setCargandoDatos(true)
      try {
        const promesas: Promise<void>[] = []

        if (tab === 'usuarios' && puedeVerUsuarios) {
          promesas.push(
            api.usuarios
              .getUsuarios(true)
              .then((res) => setUsuarios(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
          promesas.push(
            api.puestos
              .getPuestos(true)
              .then((res) => setPuestos(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
          promesas.push(
            api.modulos
              .getModulos(true)
              .then((res) => setModulos(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
          promesas.push(
            api.moduloAcciones
              .getModuloAcciones()
              .then((res) => setModuloAcciones(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
        } else if (tab === 'puestos' && puedeVerPuestos) {
          promesas.push(
            api.puestos
              .getPuestos(true)
              .then((res) => setPuestos(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
        } else if (tab === 'permisos' && (puedeVerModulos || puedeVerAcciones)) {
          if (puedeVerModulos) {
            promesas.push(
              api.modulos
                .getModulos(true)
                .then((res) => setModulos(Array.isArray(res) ? res : []))
                .catch(() => {})
            )
          }
          if (puedeVerAcciones) {
            promesas.push(
              api.acciones
                .getAcciones()
                .then((res) => setAcciones(Array.isArray(res) ? res : []))
                .catch(() => {})
            )
          }
          promesas.push(
            api.moduloAcciones
              .getModuloAcciones()
              .then((res) => setModuloAcciones(Array.isArray(res) ? res : []))
              .catch(() => {})
          )
        } else {
          if (puedeVerUsuarios) {
            promesas.push(
              api.usuarios
                .getUsuarios(true)
                .then((res) => setUsuarios(Array.isArray(res) ? res : []))
                .catch(() => {})
            )
          }
          if (puedeVerPuestos) {
            promesas.push(
              api.puestos
                .getPuestos(true)
                .then((res) => setPuestos(Array.isArray(res) ? res : []))
                .catch(() => {})
            )
          }
        }

        await Promise.all(promesas)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error de comunicación'
        toast.error('Error al cargar datos del backend', { description: msg })
      } finally {
        setCargandoDatos(false)
      }
    },
    [pestanaActiva, puedeVerUsuarios, puedeVerPuestos, puedeVerModulos, puedeVerAcciones]
  )

  const usuarioId = usuario?.id
  const haCargadoInicialRef = useRef(false)

  useEffect(() => {
    if (usuarioId && !haCargadoInicialRef.current) {
      haCargadoInicialRef.current = true
      const tabDefecto = puedeVerUsuarios
        ? 'usuarios'
        : 'puestos'

      const tabValida =
        (pestanaActiva === 'usuarios' && puedeVerUsuarios) ||
        (pestanaActiva === 'puestos' && puedeVerPuestos)

      const target = tabValida ? pestanaActiva : tabDefecto
      if (!tabValida) {
        setPestanaActiva(tabDefecto)
      }
      cargarDatos(target)
    }
  }, [usuarioId, puedeVerUsuarios, puedeVerPuestos, pestanaActiva, cargarDatos])

  // --- FORMS ---
  const formCrearU = useForm<FormCrearUsuario>({ resolver: zodResolver(esquemaCrearUsuario) })
  const formEditarU = useForm<FormEditarUsuario>({ resolver: zodResolver(esquemaEditarUsuario) })
  const formPuesto = useForm<FormPuesto>({ resolver: zodResolver(esquemaPuesto) })
  const formModulo = useForm<FormModulo>({ resolver: zodResolver(esquemaModulo) })
  const formAccion = useForm<FormAccion>({ resolver: zodResolver(esquemaAccion) })

  // --- USUARIOS FILTRADOS ---
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      // Estado
      if (filtroEstadoUsuario === 'activos' && u.anulado) return false
      if (filtroEstadoUsuario === 'anulados' && !u.anulado) return false

      // Puesto
      if (filtroPuestoUsuario !== 'todos' && u.idPuesto !== Number(filtroPuestoUsuario)) {
        return false
      }

      // Búsqueda
      if (!busquedaUsuario.trim()) return true
      const q = busquedaUsuario.toLowerCase()
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q) ||
        u.telefono.includes(q)
      )
    })
  }, [usuarios, filtroEstadoUsuario, filtroPuestoUsuario, busquedaUsuario])

  // --- PUESTOS FILTRADOS ---
  const puestosFiltrados = useMemo(() => {
    return puestos.filter((p) => {
      if (filtroEstadoPuesto === 'activos' && p.anulado) return false
      if (filtroEstadoPuesto === 'anulados' && !p.anulado) return false
      if (!busquedaPuesto.trim()) return true
      const q = busquedaPuesto.toLowerCase()
      return p.nombre.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q)
    })
  }, [puestos, filtroEstadoPuesto, busquedaPuesto])

  // --- RECUENTOS Y ESTADÍSTICAS ---
  const statsUsuarios = useMemo(() => {
    const total = usuarios.length
    const activos = usuarios.filter((u) => !u.anulado).length
    const anulados = usuarios.filter((u) => u.anulado).length
    return { total, activos, anulados }
  }, [usuarios])

  const statsPuestos = useMemo(() => {
    const total = puestos.length
    const activos = puestos.filter((p) => !p.anulado).length
    const anulados = puestos.filter((p) => p.anulado).length
    return { total, activos, anulados }
  }, [puestos])

  // --- AGRUPACIÓN DE MÓDULO-ACCIÓN POR MÓDULO ---
  const moduloAccionesAgrupados = useMemo(() => {
    const mapa = new Map<number, { idModulo: number; moduloNombre: string; items: ModuloAccionBackend[] }>()

    moduloAcciones.forEach((ma) => {
      const idMod = ma.idModulo || ma.modulo?.id || 0
      const nomMod = ma.modulo?.nombre || modulos.find((m) => m.id === idMod)?.nombre || `Módulo ${idMod}`
      if (!mapa.has(idMod)) {
        mapa.set(idMod, { idModulo: idMod, moduloNombre: nomMod, items: [] })
      }
      mapa.get(idMod)!.items.push(ma)
    })

    return Array.from(mapa.values())
  }, [moduloAcciones, modulos])

  // ==========================================
  // MANEJADORES: USUARIOS
  // ==========================================
  const handleCrearUsuarioSubmit = async (data: FormCrearUsuario) => {
    try {
      const nuevo = await api.usuarios.crearUsuario(data)
      setUsuarios((prev) => [nuevo, ...prev])
      toast.success('Usuario registrado exitosamente', { description: nuevo.nombre })
      setModalCrearUsuarioAbierto(false)
      formCrearU.reset()
    } catch (err: unknown) {
      toast.error('Error al crear usuario', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  const handleAbrirEditarUsuario = (u: UsuarioBackend) => {
    setUsuarioEditando(u)
    formEditarU.setValue('nombre', u.nombre)
    formEditarU.setValue('correo', u.correo)
    formEditarU.setValue('telefono', u.telefono)
    formEditarU.setValue('idPuesto', u.idPuesto)
    setModalEditarUsuarioAbierto(true)
  }

  const handleEditarUsuarioSubmit = async (data: FormEditarUsuario) => {
    if (!usuarioEditando) return
    try {
      const actualizado = await api.usuarios.actualizarUsuario(usuarioEditando.id, data)
      setUsuarios((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)))
      toast.success('Usuario actualizado correctamente', { description: actualizado.nombre })
      setModalEditarUsuarioAbierto(false)
      setUsuarioEditando(null)
    } catch (err: unknown) {
      toast.error('Error al actualizar usuario', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  const handleAnularUsuario = async () => {
    if (!usuarioAnular) return
    try {
      const anulado = await api.usuarios.anularUsuario(usuarioAnular.id)
      setUsuarios((prev) => prev.map((u) => (u.id === usuarioAnular.id ? { ...u, anulado: true } : u)))
      toast.success('Usuario deshabilitado/anulado', { description: anulado.nombre })
      setUsuarioAnular(null)
    } catch (err: unknown) {
      toast.error('Error al anular usuario', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  const handleActivarUsuario = async (u: UsuarioBackend) => {
    try {
      const activado = await api.usuarios.activarUsuario(u.id)
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, anulado: false } : x)))
      toast.success('Usuario reactivado exitosamente', { description: activado.nombre })
    } catch (err: unknown) {
      toast.error('Error al reactivar usuario', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  // --- MANEJO DE PERMISOS ---
  const handleAbrirPermisosModal = async (u: UsuarioBackend) => {
    setUsuarioPermisos(u)
    const idsActuales = u.permiso?.map((p) => p.idModuloAccion) || []
    setIdsPermisosSeleccionados(idsActuales)
    setModalPermisosAbierto(true)

    if (modulos.length === 0 || moduloAcciones.length === 0) {
      try {
        const [resModulos, resAcciones, resModuloAcciones] = await Promise.all([
          api.modulos.getModulos(true).catch(() => []),
          api.acciones.getAcciones().catch(() => []),
          api.moduloAcciones.getModuloAcciones().catch(() => []),
        ])
        setModulos(Array.isArray(resModulos) ? resModulos : [])
        setAcciones(Array.isArray(resAcciones) ? resAcciones : [])
        setModuloAcciones(Array.isArray(resModuloAcciones) ? resModuloAcciones : [])
      } catch {}
    }
  }

  const togglePermiso = (maTarget: ModuloAccionBackend, checked: boolean) => {
    const esVer = maTarget.accion?.nombre?.toLowerCase().trim() === 'ver'
    const asociacionesModulo = moduloAcciones.filter((ma) => ma.idModulo === maTarget.idModulo)
    const permisoVer = asociacionesModulo.find(
      (ma) => ma.accion?.nombre?.toLowerCase().trim() === 'ver'
    )

    setIdsPermisosSeleccionados((prev) => {
      const set = new Set(prev)
      if (checked) {
        set.add(maTarget.id)
        if (!esVer && permisoVer) {
          set.add(permisoVer.id)
        }
      } else {
        set.delete(maTarget.id)
        if (esVer) {
          asociacionesModulo.forEach((ma) => set.delete(ma.id))
        }
      }
      return Array.from(set)
    })
  }

  const toggleTodosModulo = (idModulo: number, checked: boolean) => {
    const idsModulo = moduloAcciones
      .filter((ma) => ma.idModulo === idModulo)
      .map((ma) => ma.id)

    setIdsPermisosSeleccionados((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...idsModulo]))
      } else {
        return prev.filter((id) => !idsModulo.includes(id))
      }
    })
  }

  const handleGuardarPermisos = async () => {
    if (!usuarioPermisos) return
    setGuardandoPermisos(true)
    try {
      const usuarioActualizado = await api.usuarios.asignarPermisos(
        usuarioPermisos.id,
        idsPermisosSeleccionados
      )
      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuarioActualizado.id ? usuarioActualizado : u))
      )
      toast.success('Permisos asignados correctamente', {
        description: `Usuario: ${usuarioActualizado.nombre}`,
      })
      setModalPermisosAbierto(false)
      setUsuarioPermisos(null)
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al guardar permisos', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    } finally {
      setGuardandoPermisos(false)
    }
  }

  // ==========================================
  // MANEJADORES: PUESTOS
  // ==========================================
  const handleAbrirCrearPuesto = () => {
    setPuestoEditando(null)
    formPuesto.reset({ nombre: '', descripcion: '' })
    setModalPuestoAbierto(true)
  }

  const handleAbrirEditarPuesto = (p: PuestoBackend) => {
    setPuestoEditando(p)
    formPuesto.reset({ nombre: p.nombre, descripcion: p.descripcion })
    setModalPuestoAbierto(true)
  }

  const handlePuestoSubmit = async (data: FormPuesto) => {
    try {
      if (puestoEditando) {
        const act = await api.puestos.actualizarPuesto(puestoEditando.id, data)
        setPuestos((prev) => prev.map((p) => (p.id === act.id ? act : p)))
        toast.success('Puesto actualizado', { description: act.nombre })
      } else {
        const nuevo = await api.puestos.crearPuesto(data)
        setPuestos((prev) => [nuevo, ...prev])
        toast.success('Puesto registrado', { description: nuevo.nombre })
      }
      setModalPuestoAbierto(false)
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al guardar puesto', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  const handleAnularPuesto = async () => {
    if (!puestoAnular) return
    try {
      const act = await api.puestos.anularPuesto(puestoAnular.id)
      setPuestos((prev) => prev.map((p) => (p.id === puestoAnular.id ? { ...p, anulado: true } : p)))
      toast.success('Puesto anulado', { description: act.nombre })
      setPuestoAnular(null)
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al anular puesto', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  const handleActivarPuesto = async (p: PuestoBackend) => {
    try {
      const activado = await api.puestos.activarPuesto(p.id)
      setPuestos((prev) => prev.map((x) => (x.id === p.id ? { ...x, anulado: false } : x)))
      toast.success('Puesto reactivado exitosamente', { description: activado.nombre })
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al reactivar puesto', {
        description: err instanceof Error ? err.message : 'Error inesperado',
      })
    }
  }

  // ==========================================
  // MANEJADORES: MÓDULOS & ACCIONES
  // ==========================================
  const handleModuloSubmit = async (data: FormModulo) => {
    try {
      if (moduloEditando) {
        const act = await api.modulos.actualizarModulo(moduloEditando.id, data)
        setModulos((prev) => prev.map((m) => (m.id === act.id ? act : m)))
        toast.success('Módulo actualizado', { description: act.nombre })
      } else {
        const nuevo = await api.modulos.crearModulo(data)
        setModulos((prev) => [nuevo, ...prev])
        toast.success('Módulo creado', { description: nuevo.nombre })
      }
      setModalModuloAbierto(false)
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error con módulo', { description: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleAnularModulo = async () => {
    if (!moduloAnular) return
    try {
      const act = await api.modulos.anularModulo(moduloAnular.id)
      setModulos((prev) => prev.map((m) => (m.id === act.id ? { ...m, anulado: true } : m)))
      toast.success('Módulo anulado', { description: act.nombre })
      setModuloAnular(null)
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al anular módulo', { description: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleActivarModulo = async (m: ModuloBackend) => {
    try {
      const activado = await api.modulos.activarModulo(m.id)
      setModulos((prev) => prev.map((x) => (x.id === m.id ? { ...x, anulado: false } : x)))
      toast.success('Módulo reactivado exitosamente', { description: activado.nombre })
      await refrescarUsuario()
    } catch (err: unknown) {
      toast.error('Error al reactivar módulo', { description: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleAccionSubmit = async (data: FormAccion) => {
    try {
      if (accionEditando) {
        const act = await api.acciones.actualizarAccion(accionEditando.id, data)
        setAcciones((prev) => prev.map((a) => (a.id === act.id ? act : a)))
        toast.success('Acción actualizada', { description: act.nombre })
      } else {
        const nueva = await api.acciones.crearAccion(data)
        setAcciones((prev) => [...prev, nueva])
        toast.success('Acción creada', { description: nueva.nombre })
      }
      setModalAccionAbierto(false)
    } catch (err: unknown) {
      toast.error('Error con acción', { description: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleEliminarAccion = async () => {
    if (!accionEliminar) return
    try {
      await api.acciones.eliminarAccion(accionEliminar.id)
      setAcciones((prev) => prev.filter((a) => a.id !== accionEliminar.id))
      toast.success('Acción eliminada', { description: accionEliminar.nombre })
      setAccionEliminar(null)
    } catch (err: unknown) {
      toast.error('Error al eliminar acción', { description: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleVincularModuloAccion = async () => {
    if (!idModuloVincular || !idAccionVincular) {
      toast.error('Seleccione módulo y acción')
      return
    }
    try {
      const vinculacion = await api.moduloAcciones.vincularModuloAccion({
        idModulo: Number(idModuloVincular),
        idAccion: Number(idAccionVincular),
      })
      setModuloAcciones((prev) => [...prev, vinculacion])
      toast.success('Asociación realizada con éxito')
      setIdModuloVincular('')
      setIdAccionVincular('')
    } catch (err: unknown) {
      toast.error('Error al vincular módulo-acción', {
        description: err instanceof Error ? err.message : 'Error',
      })
    }
  }

  const handleEliminarModuloAccion = async (id: number) => {
    try {
      await api.moduloAcciones.eliminarModuloAccion(id)
      setModuloAcciones((prev) => prev.filter((ma) => ma.id !== id))
      toast.success('Vinculación eliminada')
    } catch (err: unknown) {
      toast.error('Error al eliminar vinculación', {
        description: err instanceof Error ? err.message : 'Error',
      })
    }
  }

  return (
    <RutaProtegida moduloRequerido="Usuarios">
      <div className="min-h-screen flex flex-col bg-background">
        <BarraNavegacionSuperior />

        <main className="flex-1 container mx-auto px-4 py-6 md:py-8 space-y-6">
          {/* ENCABEZADO PRINCIPAL */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                <Users className="h-7 w-7 text-primary" />
                Módulo de Personal y Accesos
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Administración integral de Usuarios, Puestos de trabajo, Módulos y Permisos
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refrescarUsuario()
                cargarDatos(pestanaActiva)
              }}
              disabled={cargandoDatos}
              className="w-fit"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${cargandoDatos ? 'animate-spin' : ''}`} />
              Actualizar datos
            </Button>
          </div>

          {/* PESTAÑAS PRINCIPALES DEL MÓDULO */}
          <Tabs
            value={pestanaActiva}
            onValueChange={(val) => {
              setPestanaActiva(val)
              cargarDatos(val)
            }}
            className="w-full space-y-6"
          >
            {/* TARJETAS ESTADÍSTICAS - Siempre arriba */}
            {pestanaActiva === 'usuarios' && puedeVerUsuarios && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Total Registrados</p>
                      <p className="text-2xl font-bold mt-1">{statsUsuarios.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Usuarios Activos</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{statsUsuarios.activos}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <UserCheck className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Usuarios Anulados</p>
                      <p className="text-2xl font-bold text-destructive mt-1">{statsUsuarios.anulados}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                      <UserX className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {pestanaActiva === 'puestos' && puedeVerPuestos && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Total Puestos</p>
                      <p className="text-2xl font-bold mt-1">{statsPuestos.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Briefcase className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Puestos Activos</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">{statsPuestos.activos}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Puestos Anulados</p>
                      <p className="text-2xl font-bold text-destructive mt-1">{statsPuestos.anulados}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                      <XCircle className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <TabsList className="inline-flex flex-wrap sm:flex-nowrap h-auto bg-muted/60 p-1.5 gap-2 rounded-xl border border-border/40 w-full sm:w-auto">
              {puedeVerUsuarios && (
                <TabsTrigger
                  value="usuarios"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap"
                >
                  <Users className="h-4 w-4" />
                  <span>Usuarios</span>
                </TabsTrigger>
              )}
              {puedeVerPuestos && (
                <TabsTrigger
                  value="puestos"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap"
                >
                  <Briefcase className="h-4 w-4" />
                  <span>Puestos</span>
                </TabsTrigger>
              )}
            </TabsList>

            {!puedeVerUsuarios && !puedeVerPuestos && (
              <Card className="p-8 text-center border-dashed">
                <CardTitle className="text-destructive">Sin Acceso a Submódulos</CardTitle>
                <CardDescription className="mt-2">
                  No cuenta con permisos asignados para visualizar Usuarios o Puestos. Contacte a su administrador.
                </CardDescription>
              </Card>
            )}

          {/* ============================================================ */}
          {/* TAB 1: USUARIOS                                               */}
          {/* ============================================================ */}
          {puedeVerUsuarios && (
            <TabsContent value="usuarios" className="space-y-6">
              {/* FILTROS Y BOTÓN CREAR USUARIO */}
              <Card className="border-border/60 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">Gestión de Usuarios</CardTitle>
                      <CardDescription>
                        Filtre entre usuarios activos y anulados, o cree nuevos miembros del personal
                      </CardDescription>
                    </div>
                    {puedeCrearUsuarios && (
                      <Button
                        onClick={() => {
                          formCrearU.reset()
                          setModalCrearUsuarioAbierto(true)
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Usuario
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                    {/* BUSCADOR */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre, correo o teléfono..."
                        value={busquedaUsuario}
                        onChange={(e) => setBusquedaUsuario(e.target.value)}
                        className="pl-9 bg-muted/30"
                      />
                    </div>

                    {/* FILTRO ESTADO (ACTIVOS / ANULADOS / TODOS) */}
                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                      <Button
                        type="button"
                        variant={filtroEstadoUsuario === 'activos' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoUsuario('activos')}
                        className="text-xs h-8"
                      >
                        Activos ({statsUsuarios.activos})
                      </Button>
                      <Button
                        type="button"
                        variant={filtroEstadoUsuario === 'anulados' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoUsuario('anulados')}
                        className="text-xs h-8"
                      >
                        Anulados ({statsUsuarios.anulados})
                      </Button>
                      <Button
                        type="button"
                        variant={filtroEstadoUsuario === 'todos' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoUsuario('todos')}
                        className="text-xs h-8"
                      >
                        Todos ({statsUsuarios.total})
                      </Button>
                    </div>

                    {/* FILTRO PUESTO */}
                    <Select value={filtroPuestoUsuario} onValueChange={setFiltroPuestoUsuario}>
                      <SelectTrigger className="w-full lg:w-[200px] bg-muted/30">
                        <SelectValue placeholder="Filtrar por puesto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los Puestos</SelectItem>
                        {puestos.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* LISTADO DE USUARIOS EN Malla / TARJETAS */}
                  {cargandoDatos ? (
                    <div className="py-12 flex items-center justify-center gap-3 text-muted-foreground">
                      <Spinner className="h-6 w-6" />
                      <span>Cargando usuarios...</span>
                    </div>
                  ) : usuariosFiltrados.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground space-y-2 border border-dashed rounded-lg">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
                      <p className="font-medium">No se encontraron usuarios</p>
                      <p className="text-xs">Pruebe cambiando los filtros de búsqueda</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                      {usuariosFiltrados.map((u) => (
                        <Card
                          key={u.id}
                          className={`transition-all hover:shadow-md border-border/60 ${
                            u.anulado ? 'bg-muted/40 opacity-75' : 'bg-card'
                          }`}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-11 w-11 border">
                                  <AvatarFallback
                                    className={
                                      u.anulado
                                        ? 'bg-muted text-muted-foreground'
                                        : 'bg-primary/10 text-primary font-bold'
                                    }
                                  >
                                    {obtenerIniciales(u.nombre)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h3 className="font-semibold text-sm leading-tight text-foreground">
                                    {u.nombre}
                                  </h3>
                                  <Badge
                                    variant="outline"
                                    className="mt-1 font-normal text-[11px] bg-muted/60"
                                  >
                                    {u.puesto?.nombre || 'Sin Puesto'}
                                  </Badge>
                                </div>
                              </div>

                              {/* MENÚ DE ACCIONES */}
                              {(puedeEditarUsuarios || puedeAnularUsuarios) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {puedeEditarUsuarios && (
                                      <>
                                        <DropdownMenuItem onClick={() => handleAbrirEditarUsuario(u)}>
                                          <Pencil className="mr-2 h-4 w-4 text-blue-500" />
                                          Editar Datos
                                        </DropdownMenuItem>

                                        <DropdownMenuItem onClick={() => handleAbrirPermisosModal(u)}>
                                          <Key className="mr-2 h-4 w-4 text-amber-500" />
                                          Gestionar Permisos
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {u.anulado ? (
                                      (puedeEditarUsuarios || puedeAnularUsuarios) && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => handleActivarUsuario(u)}
                                            className="text-emerald-600 focus:text-emerald-600 cursor-pointer"
                                          >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Reactivar Usuario
                                          </DropdownMenuItem>
                                        </>
                                      )
                                    ) : (
                                      puedeAnularUsuarios && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => setUsuarioAnular(u)}
                                            className="text-destructive focus:text-destructive cursor-pointer"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Anular / Deshabilitar
                                          </DropdownMenuItem>
                                        </>
                                      )
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground/70" />
                                <span className="truncate">{u.correo}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground/70" />
                                <span>{u.telefono}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                              <span className="text-muted-foreground">
                                Registro: {formatoFecha(u.fechaCreacion)}
                              </span>
                              {u.anulado ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  Anulado
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 px-1.5 py-0"
                                >
                                  Activo
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ============================================================ */}
          {/* TAB 2: PUESTOS                                               */}
          {/* ============================================================ */}
          {puedeVerPuestos && (
            <TabsContent value="puestos" className="space-y-6">
              {/* SECCIÓN ADMINISTRACIÓN PUESTOS */}
              <Card className="border-border/60 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">Administración de Puestos de Trabajo</CardTitle>
                      <CardDescription>
                        Defina los puestos para categorizar y organizar el personal del parque
                      </CardDescription>
                    </div>
                    {puedeCrearPuestos && (
                      <Button onClick={handleAbrirCrearPuesto} className="bg-primary hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Puesto
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar puesto..."
                        value={busquedaPuesto}
                        onChange={(e) => setBusquedaPuesto(e.target.value)}
                        className="pl-9 bg-muted/30"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-full md:w-auto">
                      <Button
                        type="button"
                        variant={filtroEstadoPuesto === 'activos' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoPuesto('activos')}
                        className="text-xs h-8 flex-1 md:flex-initial"
                      >
                        Activos
                      </Button>
                      <Button
                        type="button"
                        variant={filtroEstadoPuesto === 'anulados' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoPuesto('anulados')}
                        className="text-xs h-8 flex-1 md:flex-initial"
                      >
                        Anulados
                      </Button>
                      <Button
                        type="button"
                        variant={filtroEstadoPuesto === 'todos' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFiltroEstadoPuesto('todos')}
                        className="text-xs h-8 flex-1 md:flex-initial"
                      >
                        Todos
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {puestosFiltrados.map((p) => (
                      <Card
                        key={p.id}
                        className={`border-border/60 ${p.anulado ? 'bg-muted/40 opacity-75' : 'bg-card'}`}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-base flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                {p.nombre}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {p.descripcion || 'Sin descripción'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {puedeEditarPuestos && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAbrirEditarPuesto(p)}
                                  className="h-8 w-8 text-blue-500"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {p.anulado ? (
                                (puedeEditarPuestos || puedeAnularPuestos) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleActivarPuesto(p)}
                                    title="Reactivar puesto"
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )
                              ) : (
                                puedeAnularPuestos && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPuestoAnular(p)}
                                    title="Anular puesto"
                                    className="h-8 w-8 text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )
                              )}
                            </div>
                          </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                          <Badge variant="outline" className="bg-primary/5 text-primary">
                            {p._count?.usuarios ?? 0} personal asignado
                          </Badge>
                          {p.anulado ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Anulado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700">
                              Activo
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </main>

      {/* ============================================================ */}
      {/* MODALES: USUARIO (CREAR Y EDITAR)                             */}
      {/* ============================================================ */}
      <Dialog open={modalCrearUsuarioAbierto} onOpenChange={setModalCrearUsuarioAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Registrar Nuevo Usuario
            </DialogTitle>
            <DialogDescription>
              Ingrese la información básica del miembro del personal
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={formCrearU.handleSubmit(handleCrearUsuarioSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre Completo</Label>
              <Input id="nombre" placeholder="ej. Carlos Mendoza" {...formCrearU.register('nombre')} />
              {formCrearU.formState.errors.nombre && (
                <p className="text-xs text-destructive">{formCrearU.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="correo">Correo Electrónico</Label>
              <Input id="correo" type="email" placeholder="carlos.mendoza@aktunkan.com" {...formCrearU.register('correo')} />
              {formCrearU.formState.errors.correo && (
                <p className="text-xs text-destructive">{formCrearU.formState.errors.correo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrasena">Contraseña Inicial</Label>
              <div className="relative">
                <Input
                  id="contrasena"
                  type={mostrarContrasenaCrear ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-10"
                  {...formCrearU.register('contrasena')}
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasenaCrear(!mostrarContrasenaCrear)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={mostrarContrasenaCrear ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarContrasenaCrear ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {formCrearU.formState.errors.contrasena && (
                <p className="text-xs text-destructive">{formCrearU.formState.errors.contrasena.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="55554321" {...formCrearU.register('telefono')} />
                {formCrearU.formState.errors.telefono && (
                  <p className="text-xs text-destructive">{formCrearU.formState.errors.telefono.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="idPuesto">Puesto de Trabajo</Label>
                <Select
                  onValueChange={(val) => formCrearU.setValue('idPuesto', Number(val))}
                >
                  <SelectTrigger id="idPuesto">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {puestos
                      .filter((p) => !p.anulado)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formCrearU.formState.errors.idPuesto && (
                  <p className="text-xs text-destructive">{formCrearU.formState.errors.idPuesto.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalCrearUsuarioAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Usuario</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modalEditarUsuarioAbierto} onOpenChange={setModalEditarUsuarioAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Editar Datos de Usuario
            </DialogTitle>
            <DialogDescription>
              Modifique la información general del usuario
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={formEditarU.handleSubmit(handleEditarUsuarioSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre Completo</Label>
              <Input id="edit-nombre" {...formEditarU.register('nombre')} />
              {formEditarU.formState.errors.nombre && (
                <p className="text-xs text-destructive">{formEditarU.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-correo">Correo Electrónico</Label>
              <Input id="edit-correo" type="email" {...formEditarU.register('correo')} />
              {formEditarU.formState.errors.correo && (
                <p className="text-xs text-destructive">{formEditarU.formState.errors.correo.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">Teléfono</Label>
                <Input id="edit-telefono" {...formEditarU.register('telefono')} />
                {formEditarU.formState.errors.telefono && (
                  <p className="text-xs text-destructive">{formEditarU.formState.errors.telefono.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-idPuesto">Puesto</Label>
                <Select
                  defaultValue={usuarioEditando ? String(usuarioEditando.idPuesto) : undefined}
                  onValueChange={(val) => formEditarU.setValue('idPuesto', Number(val))}
                >
                  <SelectTrigger id="edit-idPuesto">
                    <SelectValue placeholder="Seleccionar puesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {puestos
                      .filter((p) => !p.anulado)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formEditarU.formState.errors.idPuesto && (
                  <p className="text-xs text-destructive">{formEditarU.formState.errors.idPuesto.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalEditarUsuarioAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Actualizar Usuario</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL GESTIÓN DE PERMISOS POR USUARIO                        */}
      {/* ============================================================ */}
      <Dialog open={modalPermisosAbierto} onOpenChange={setModalPermisosAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Gestión de Permisos del Usuario
            </DialogTitle>
            <DialogDescription>
              {usuarioPermisos && (
                <span>
                  Asignación de permisos para <strong>{usuarioPermisos.nombre}</strong> (
                  {usuarioPermisos.correo})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Active los permisos habilitados para este usuario en cada módulo. Al activar cualquier permiso diferente a &quot;Ver&quot;, se activará &quot;Ver&quot; automáticamente.
            </p>

            <ScrollArea className="h-[380px] pr-3 border rounded-lg p-3 bg-muted/20">
              {modulos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-muted-foreground text-xs">
                  <Spinner className="h-5 w-5 text-primary" />
                  <span>Cargando módulos y permisos...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {modulos
                    .filter((m) => !m.anulado)
                    .map((mod) => {
                      const asociacionesModulo = moduloAcciones.filter((ma) => ma.idModulo === mod.id)
                      const todosSeleccionados =
                        asociacionesModulo.length > 0 &&
                        asociacionesModulo.every((ma) => idsPermisosSeleccionados.includes(ma.id))
                      const cantidadSeleccionados = asociacionesModulo.filter((ma) =>
                        idsPermisosSeleccionados.includes(ma.id)
                      ).length

                      return (
                        <div key={mod.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm capitalize">{mod.nombre}</span>
                              {asociacionesModulo.length > 0 && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {cantidadSeleccionados} / {asociacionesModulo.length}
                                </Badge>
                              )}
                            </div>

                            {asociacionesModulo.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor={`select-all-${mod.id}`}
                                  className="text-xs text-muted-foreground cursor-pointer select-none font-medium"
                                >
                                  Seleccionar todos
                                </Label>
                                <Switch
                                  id={`select-all-${mod.id}`}
                                  checked={todosSeleccionados}
                                  onCheckedChange={(checked) => toggleTodosModulo(mod.id, checked)}
                                />
                              </div>
                            )}
                          </div>

                          {asociacionesModulo.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic pl-2">
                              No hay acciones vinculadas a este módulo.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {asociacionesModulo.map((ma) => {
                                const isChecked = idsPermisosSeleccionados.includes(ma.id)
                                const esVer = ma.accion?.nombre?.toLowerCase().trim() === 'ver'
                                const nombreAccion = ma.accion?.nombre || `Acción ${ma.idAccion}`

                                return (
                                  <div
                                    key={ma.id}
                                    className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-colors ${
                                      isChecked
                                        ? 'bg-primary/10 border-primary/40 font-medium text-foreground'
                                        : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="capitalize">{nombreAccion}</span>
                                      {esVer && (
                                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                          Requerido
                                        </Badge>
                                      )}
                                    </div>
                                    <Switch
                                      checked={isChecked}
                                      onCheckedChange={(checked) => togglePermiso(ma, checked)}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setModalPermisosAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarPermisos} disabled={guardandoPermisos}>
              {guardandoPermisos ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Guardar Permisos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* ALERT DIALOG ANULAR USUARIO                                  */}
      {/* ============================================================ */}
      <AlertDialog open={!!usuarioAnular} onOpenChange={() => setUsuarioAnular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <UserX className="h-5 w-5" />
              ¿Anular / Deshabilitar Usuario?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción deshabilitará al usuario <strong>{usuarioAnular?.nombre}</strong>. El usuario ya no podrá iniciar sesión en la plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnularUsuario} className="bg-destructive hover:bg-destructive/90">
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* MODAL PUESTO (CREAR Y EDITAR)                                */}
      {/* ============================================================ */}
      <Dialog open={modalPuestoAbierto} onOpenChange={setModalPuestoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {puestoEditando ? 'Editar Puesto de Trabajo' : 'Crear Puesto de Trabajo'}
            </DialogTitle>
            <DialogDescription>
              Complete el nombre y descripción del puesto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={formPuesto.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="puesto-nombre">Nombre del Puesto</Label>
              <Input id="puesto-nombre" placeholder="ej. Guía de Recorrido" {...formPuesto.register('nombre')} />
              {formPuesto.formState.errors.nombre && (
                <p className="text-xs text-destructive">{formPuesto.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="puesto-desc">Descripción</Label>
              <Textarea
                id="puesto-desc"
                placeholder="Descripción de tareas y funciones del puesto..."
                rows={3}
                {...formPuesto.register('descripcion')}
              />
              {formPuesto.formState.errors.descripcion && (
                <p className="text-xs text-destructive">{formPuesto.formState.errors.descripcion.message}</p>
              )}
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalPuestoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {puestoEditando ? 'Guardar Cambios' : 'Crear Puesto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG ANULAR PUESTO */}
      <AlertDialog open={!!puestoAnular} onOpenChange={() => setPuestoAnular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ¿Anular Puesto de Trabajo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se cambiará el estado del puesto <strong>{puestoAnular?.nombre}</strong> a anulado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnularPuesto} className="bg-destructive hover:bg-destructive/90">
              Anular Puesto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* MODAL MÓDULO                                                 */}
      {/* ============================================================ */}
      <Dialog open={modalModuloAbierto} onOpenChange={setModalModuloAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{moduloEditando ? 'Editar Módulo' : 'Crear Módulo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={formModulo.handleSubmit(handleModuloSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del Módulo</Label>
              <Input placeholder="ej. usuarios, tickets..." {...formModulo.register('nombre')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalModuloAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!moduloAnular} onOpenChange={() => setModuloAnular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Módulo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Desea anular el módulo <strong>{moduloAnular?.nombre}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnularModulo} className="bg-destructive">
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* MODAL ACCIÓN                                                 */}
      {/* ============================================================ */}
      <Dialog open={modalAccionAbierto} onOpenChange={setModalAccionAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{accionEditando ? 'Editar Acción' : 'Crear Acción'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={formAccion.handleSubmit(handleAccionSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre de la Acción</Label>
              <Input placeholder="ej. ver, crear, exportar..." {...formAccion.register('nombre')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAccionAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!accionEliminar} onOpenChange={() => setAccionEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Acción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar la acción <strong>{accionEliminar?.nombre}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarAccion} className="bg-destructive">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RutaProtegida>
  )
}
