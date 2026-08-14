import {
  Home,
  ScanLine,
  Users,
  Calculator,
  History,
  BarChart3,
  ClipboardList,
  HandHeart,
  CloudCog,
  type LucideIcon,
} from 'lucide-react'
import { type ModuloMenu } from '@/tipos'
import { normalizarNombreModulo } from '@/lib/utils'

export interface ItemModulo {
  id: string
  /** Etiqueta corta, para la barra inferior móvil. */
  nombre: string
  /** Etiqueta completa, para el menú de escritorio. */
  nombreLargo: string
  descripcion: string
  icono: LucideIcon
  iconoDesktop: LucideIcon
  ruta: string
}

/**
 * Módulos que el backend ya administra. La clave es el nombre del módulo tal
 * como lo devuelve `GET /modulos/mis-modulos`; un item solo se muestra si ese
 * endpoint lo devuelve, es decir si el usuario tiene permiso sobre él.
 */
export const MODULOS_BACKEND: Record<string, ItemModulo> = {
  EmisionTickets: {
    id: 'inicio',
    nombre: 'Inicio',
    nombreLargo: 'Emisión de Tickets',
    descripcion: 'Registrar visitantes y emitir tickets',
    icono: Home,
    iconoDesktop: ScanLine,
    ruta: '/registro-visitantes',
  },
  Usuarios: {
    id: 'usuarios',
    nombre: 'Usuarios',
    nombreLargo: 'Usuarios',
    descripcion: 'Staff, puestos y permisos',
    icono: Users,
    iconoDesktop: Users,
    ruta: '/usuarios',
  },
  Cajas: {
    id: 'cierre-diario',
    nombre: 'Cierre',
    nombreLargo: 'Caja y Cierre',
    descripcion: 'Apertura, gastos y arqueo',
    icono: Calculator,
    iconoDesktop: Calculator,
    ruta: '/cierre-diario',
  },
  Bitacora: {
    id: 'bitacora',
    nombre: 'Bitácora',
    nombreLargo: 'Bitácora',
    descripcion: 'Registro de actividades del sistema',
    icono: History,
    iconoDesktop: History,
    ruta: '/bitacora',
  },
}

/**
 * Módulos aún sin implementar en el backend: nunca llegan en `mis-modulos`, así
 * que se muestran siempre para no desaparecer del menú. Al implementarse en el
 * backend deben moverse a MODULOS_BACKEND.
 */
export const MODULOS_SIN_BACKEND: ItemModulo[] = [
  {
    id: 'reportes',
    nombre: 'Reportes',
    nombreLargo: 'Reportes',
    descripcion: 'Estadísticas y gráficos',
    icono: BarChart3,
    iconoDesktop: BarChart3,
    ruta: '/reportes',
  },
  {
    id: 'actividades',
    nombre: 'Actividades',
    nombreLargo: 'Actividades',
    descripcion: 'Registro de actividades del parque',
    icono: ClipboardList,
    iconoDesktop: ClipboardList,
    ruta: '/actividades',
  },
  {
    id: 'donaciones',
    nombre: 'Donativos',
    nombreLargo: 'Donaciones',
    descripcion: 'Gestión de donativos y recibos',
    icono: HandHeart,
    iconoDesktop: HandHeart,
    ruta: '/donaciones',
  },
  {
    id: 'sincronizacion',
    nombre: 'Sync',
    nombreLargo: 'Sincronización',
    descripcion: 'Estado offline',
    icono: CloudCog,
    iconoDesktop: CloudCog,
    ruta: '/sincronizacion',
  },
]

/**
 * Convierte la respuesta de `GET /modulos/mis-modulos` en los items de menú.
 * Los sub-módulos sin pantalla propia (Gastos bajo Cajas, Puestos bajo Usuarios)
 * no están en MODULOS_BACKEND a propósito: viven como pestaña dentro de su
 * módulo padre, así que no deben generar un item de navegación duplicado.
 */
export function resolverModulosPermitidos(modulosMenu: ModuloMenu[]): ItemModulo[] {
  // El índice se arma normalizado para que un módulo renombrado en la base de
  // datos ('Bitácora' vs 'Bitacora') siga encontrando su entrada.
  const indice = new Map(
    Object.entries(MODULOS_BACKEND).map(([nombre, item]) => [
      normalizarNombreModulo(nombre),
      item,
    ]),
  )

  const delBackend = modulosMenu
    .map((m) => indice.get(normalizarNombreModulo(m.nombre)))
    .filter((item): item is ItemModulo => Boolean(item))

  const vistos = new Set(delBackend.map((i) => i.id))
  const pendientes = MODULOS_SIN_BACKEND.filter((i) => !vistos.has(i.id))

  return [...delBackend, ...pendientes]
}
