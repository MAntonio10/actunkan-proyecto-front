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
  /**
   * La pantalla sirve para algo sin conexión. Solo estos módulos se muestran en
   * la navegación mientras no hay red.
   *
   * Debe coincidir con `RUTAS_APP` de `public/sw.js`: el resto de rutas no está
   * precacheado, así que navegar a ellas sin señal termina en la pantalla de
   * error del navegador. Ocultarlas es más honesto que ofrecer un destino que
   * no carga, y que cachear pantallas cuyos datos vienen todos de la API.
   */
  disponibleSinConexion?: boolean
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
    disponibleSinConexion: true,
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
    descripcion: 'Apertura, arqueo y cierre',
    icono: Calculator,
    iconoDesktop: Calculator,
    ruta: '/cierre-diario',
  },
  Donaciones: {
    id: 'donaciones',
    nombre: 'Donativos',
    nombreLargo: 'Donaciones',
    descripcion: 'Recibos de donación en efectivo',
    icono: HandHeart,
    iconoDesktop: HandHeart,
    ruta: '/donaciones',
  },
  ActividadesParque: {
    id: 'actividades',
    nombre: 'Actividades',
    nombreLargo: 'Actividades',
    descripcion: 'Publicaciones de actividades del parque',
    icono: ClipboardList,
    iconoDesktop: ClipboardList,
    ruta: '/actividades',
  },
  Reportes: {
    id: 'reportes',
    nombre: 'Reportes',
    nombreLargo: 'Reportes',
    descripcion: 'Indicadores, tablas y gráficas',
    icono: BarChart3,
    iconoDesktop: BarChart3,
    ruta: '/reportes',
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
 * Pantallas que no corresponden a un módulo del backend: nunca llegan en
 * `mis-modulos`, así que se muestran siempre para no desaparecer del menú.
 *
 * Hoy solo queda Sincronización, y no es que le falte backend: es una pantalla
 * del dispositivo —lee IndexedDB, no la API— y se gobierna con el permiso de
 * EmisionTickets, que es quien vende sin conexión. Si en algún momento aparece
 * aquí un módulo que el backend sí administra, muévalo a MODULOS_BACKEND.
 */
export const MODULOS_SIN_BACKEND: ItemModulo[] = [
  {
    id: 'sincronizacion',
    nombre: 'Sync',
    nombreLargo: 'Sincronización',
    descripcion: 'Cola offline, folios y diagnóstico',
    icono: CloudCog,
    iconoDesktop: CloudCog,
    ruta: '/sincronizacion',
    // Lee solo del almacenamiento local, así que funciona sin red — y es
    // justamente cuando más se necesita, porque es cuando la cola crece.
    disponibleSinConexion: true,
  },
]

/**
 * Convierte la respuesta de `GET /modulos/mis-modulos` en los items de menú.
 * Los sub-módulos sin pantalla propia (Gastos bajo Cajas, Puestos bajo Usuarios)
 * no están en MODULOS_BACKEND a propósito: viven como pestaña dentro de su
 * módulo padre, así que no deben generar un item de navegación duplicado.
 */
export function resolverModulosPermitidos(
  modulosMenu: ModuloMenu[],
  opciones: { enLinea?: boolean } = {},
): ItemModulo[] {
  // El índice se arma normalizado para que un módulo renombrado en la base de
  // datos ('Bitácora' vs 'Bitacora') siga encontrando su entrada.
  const indice = new Map(
    Object.entries(MODULOS_BACKEND).map(([nombre, item]) => [
      normalizarNombreModulo(nombre),
      item,
    ]),
  )

  // El orden lo fija la declaración de MODULOS_BACKEND, no el que devuelva el
  // servidor: así la posición de cada módulo en el menú es estable.
  const ordenDeclarado = Object.values(MODULOS_BACKEND).map((i) => i.id)

  const delBackend = modulosMenu
    .map((m) => indice.get(normalizarNombreModulo(m.nombre)))
    .filter((item): item is ItemModulo => Boolean(item))
    .sort((a, b) => ordenDeclarado.indexOf(a.id) - ordenDeclarado.indexOf(b.id))

  const vistos = new Set(delBackend.map((i) => i.id))
  const pendientes = MODULOS_SIN_BACKEND.filter((i) => !vistos.has(i.id))

  const todos = [...delBackend, ...pendientes]

  // Sin red se ocultan los módulos cuyas pantallas no están precacheadas: el
  // Service Worker no puede servirlas y el enlace terminaría en la pantalla de
  // error del navegador. Un menú más corto describe mejor lo que de verdad se
  // puede hacer en ese momento.
  if (opciones.enLinea === false) {
    return todos.filter((i) => i.disponibleSinConexion)
  }

  return todos
}

/**
 * Orden para la barra móvil: deja Inicio al centro de la fila principal, que
 * es la posición más cómoda para el pulgar. En escritorio no aplica: ahí el
 * menú es una cuadrícula y Emisión de Tickets va primero.
 */
export function ordenarParaMovil(items: ItemModulo[]): ItemModulo[] {
  const inicio = items.find((i) => i.id === 'inicio')
  if (!inicio) return items

  const resto = items.filter((i) => i.id !== 'inicio')
  // La fila principal muestra hasta 4 items; se centra dentro de ese grupo.
  const centro = Math.floor(Math.min(4, items.length) / 2)
  const salida = [...resto]
  salida.splice(centro, 0, inicio)
  return salida
}
