'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  TicketCheck,
  Lock,
  Mail,
  Clock,
} from 'lucide-react'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'

import { USUARIOS_DEMO, ROLES_USUARIO, type Usuario, type RolUsuario } from '@/tipos'

const esquemaUsuario = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email invalido'),
  rol: z.enum(['administrador', 'supervisor', 'taquillero', 'guardia'] as const),
  taquilla: z.number().optional(),
  activo: z.boolean(),
})

type FormUsuario = z.infer<typeof esquemaUsuario>

const ICONO_ROL: Record<RolUsuario, React.ReactNode> = {
  administrador: <ShieldCheck className="h-3.5 w-3.5" />,
  supervisor: <Shield className="h-3.5 w-3.5" />,
  taquillero: <TicketCheck className="h-3.5 w-3.5" />,
  guardia: <Lock className="h-3.5 w-3.5" />,
}

const COLOR_ROL: Record<RolUsuario, string> = {
  administrador: 'bg-primary/15 text-primary border-primary/30',
  supervisor: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  taquillero: 'bg-accent/20 text-accent-foreground border-accent/30',
  guardia: 'bg-muted text-muted-foreground border-border/50',
}

function formatoFecha(d?: Date) {
  if (!d) return 'Nunca'
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function obtenerIniciales(nombre: string) {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_DEMO)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<RolUsuario | 'todos'>('todos')

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null)

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideRol = filtroRol === 'todos' || u.rol === filtroRol
      const coincideBusqueda =
        !busqueda ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email?.toLowerCase().includes(busqueda.toLowerCase())
      return coincideRol && coincideBusqueda
    })
  }, [usuarios, busqueda, filtroRol])

  const estadisticas = useMemo(() => {
    const total = usuarios.length
    const activos = usuarios.filter((u) => u.activo).length
    const porRol = ROLES_USUARIO.reduce(
      (acc, r) => ({ ...acc, [r.valor]: usuarios.filter((u) => u.rol === r.valor).length }),
      {} as Record<RolUsuario, number>
    )
    return { total, activos, porRol }
  }, [usuarios])

  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setDialogoAbierto(true)
  }

  const abrirEditar = (u: Usuario) => {
    setUsuarioEditando(u)
    setDialogoAbierto(true)
  }

  const alternarActivo = (u: Usuario) => {
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !x.activo } : x)))
    toast.success(`Usuario ${!u.activo ? 'activado' : 'desactivado'}`, {
      description: u.nombre,
    })
  }

  const eliminarUsuario = () => {
    if (!usuarioAEliminar) return
    setUsuarios((prev) => prev.filter((u) => u.id !== usuarioAEliminar.id))
    toast.success('Usuario eliminado', { description: usuarioAEliminar.nombre })
    setUsuarioAEliminar(null)
  }

  const guardarUsuario = (datos: FormUsuario) => {
    if (usuarioEditando) {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuarioEditando.id
            ? { ...u, ...datos }
            : u
        )
      )
      toast.success('Usuario actualizado', { description: datos.nombre })
    } else {
      const nuevo: Usuario = {
        id: `u-${Date.now()}`,
        ...datos,
      }
      setUsuarios((prev) => [nuevo, ...prev])
      toast.success('Usuario creado', { description: datos.nombre })
    }
    setDialogoAbierto(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BarraNavegacionSuperior />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Staff y Usuarios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestion de personal, roles y permisos del sistema
            </p>
          </div>
          <Button onClick={abrirNuevo} className="bg-primary text-primary-foreground w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Usuario
          </Button>
        </div>

        {/* Estadisticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-2xl font-bold mt-1">{estadisticas.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold mt-1 text-primary">{estadisticas.activos}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Taquilleros</p>
              <p className="text-2xl font-bold mt-1">{estadisticas.porRol.taquillero}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Guardias</p>
              <p className="text-2xl font-bold mt-1">{estadisticas.porRol.guardia}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 bg-muted/50 border-border/50"
                />
              </div>
              <Select
                value={filtroRol}
                onValueChange={(v) => setFiltroRol(v as RolUsuario | 'todos')}
              >
                <SelectTrigger className="w-full sm:w-56 bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  {ROLES_USUARIO.map((r) => (
                    <SelectItem key={r.valor} value={r.valor}>
                      {r.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de usuarios */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Usuarios ({usuariosFiltrados.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {usuariosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No se encontraron usuarios con los filtros actuales.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {usuariosFiltrados.map((u) => {
                  const rolMeta = ROLES_USUARIO.find((r) => r.valor === u.rol)
                  return (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <Avatar
                        className={`h-10 w-10 ${u.activo ? 'border-2 border-primary/30' : 'opacity-60'}`}
                      >
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {obtenerIniciales(u.nombre)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium truncate ${!u.activo && 'text-muted-foreground line-through'}`}>
                            {u.nombre}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${COLOR_ROL[u.rol]} gap-1 font-normal`}
                          >
                            {ICONO_ROL[u.rol]}
                            {rolMeta?.etiqueta}
                          </Badge>
                          {!u.activo && (
                            <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                              Inactivo
                            </Badge>
                          )}
                          {u.taquilla !== undefined && (
                            <Badge variant="outline" className="text-xs border-border/50">
                              Taquilla {u.taquilla}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {u.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {u.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatoFecha(u.ultimo_acceso)}
                          </span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={u.activo}
                          onCheckedChange={() => alternarActivo(u)}
                          aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                          className="hidden sm:flex"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Opciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => abrirEditar(u)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => alternarActivo(u)}>
                              {u.activo ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setUsuarioAEliminar(u)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog crear/editar */}
      <DialogoUsuario
        abierto={dialogoAbierto}
        onClose={() => setDialogoAbierto(false)}
        usuario={usuarioEditando}
        onGuardar={guardarUsuario}
      />

      {/* Dialog confirmar eliminar */}
      <AlertDialog
        open={!!usuarioAEliminar}
        onOpenChange={(v) => !v && setUsuarioAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente a{' '}
              <strong>{usuarioAEliminar?.nombre}</strong>. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminarUsuario}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --------------------------------------------------------------------------
// Dialogo para crear / editar usuario
// --------------------------------------------------------------------------

interface DialogoUsuarioProps {
  abierto: boolean
  onClose: () => void
  usuario: Usuario | null
  onGuardar: (datos: FormUsuario) => void
}

function DialogoUsuario({ abierto, onClose, usuario, onGuardar }: DialogoUsuarioProps) {
  const esEdicion = !!usuario

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormUsuario>({
    resolver: zodResolver(esquemaUsuario),
    values: usuario
      ? {
          nombre: usuario.nombre,
          email: usuario.email || '',
          rol: usuario.rol,
          taquilla: usuario.taquilla,
          activo: usuario.activo,
        }
      : {
          nombre: '',
          email: '',
          rol: 'taquillero',
          taquilla: undefined,
          activo: true,
        },
  })

  const rolActual = watch('rol')
  const activoActual = watch('activo')

  const handleClose = () => {
    onClose()
    reset()
  }

  const onSubmit = (datos: FormUsuario) => {
    onGuardar(datos)
    reset()
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Actualiza la informacion del usuario.'
              : 'Completa los datos para crear un nuevo usuario del sistema.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70svh]">
          <form id="form-usuario" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                placeholder="Ej. Luis Ramos"
                {...register('nombre')}
              />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@actunkan.gt"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={rolActual}
                onValueChange={(v) => setValue('rol', v as RolUsuario)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_USUARIO.map((r) => (
                    <SelectItem key={r.valor} value={r.valor}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.etiqueta}</span>
                        <span className="text-xs text-muted-foreground">{r.descripcion}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rolActual === 'taquillero' && (
              <div className="space-y-1.5">
                <Label htmlFor="taquilla">Numero de taquilla</Label>
                <Input
                  id="taquilla"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Ej. 1"
                  {...register('taquilla', { valueAsNumber: true })}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
              <div>
                <Label htmlFor="activo" className="text-sm font-medium">
                  Usuario activo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Los usuarios inactivos no pueden iniciar sesion.
                </p>
              </div>
              <Switch
                id="activo"
                checked={activoActual}
                onCheckedChange={(v) => setValue('activo', v)}
              />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-usuario"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground"
          >
            {esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
