// Tipos para el sistema de tickets del Parque Nacional Actun Kan

// Enums
export type Nacionalidad = 
  | 'guatemalteco'
  | 'mexicano'
  | 'estadounidense'
  | 'europeo'
  | 'centroamericano'
  | 'sudamericano'
  | 'otro'

export type TipoRecorrido = 'corto' | 'largo'

export type RolUsuario = 'administrador' | 'taquillero' | 'supervisor' | 'guardia'

export type EstadoTicket = 'activo' | 'usado' | 'cancelado' | 'vencido'

export type TipoActividad = 
  | 'login'
  | 'logout'
  | 'emision_ticket'
  | 'cancelacion_ticket'
  | 'registro_entrada'
  | 'registro_salida'
  | 'cierre_caja'
  | 'sincronizacion'
  | 'modificacion_usuario'

export type EstadoConexion = 'online' | 'offline' | 'sincronizando'

// Interfaces principales
export interface Usuario {
  id: string
  nombre: string
  rol: RolUsuario
  taquilla?: number
  avatar?: string
  email?: string
  activo: boolean
  ultimo_acceso?: Date
}

export interface TipoAcceso {
  id: string
  nombre: string
  precio: number
  precio_extranjero?: number
  descripcion?: string
  duracion_horas?: number
  incluye_guia?: boolean
}

export interface Ticket {
  id: string
  numero_ticket: string
  nombre_visitante_grupo: string
  tipo_acceso: TipoAcceso
  cantidad_personas: number
  nacionalidad?: Nacionalidad
  tipo_recorrido?: TipoRecorrido
  aporte_reforestacion: boolean
  monto_base: number
  monto_aporte: number
  monto_total: number
  fecha_emision: Date
  fecha_visita: Date
  hora_entrada?: Date
  hora_salida?: Date
  estado: EstadoTicket
  usuario_emisor_id: string
  codigo_qr: string
  sincronizado: boolean
}

export interface Visitante {
  id: string
  nombre_grupo: string
  nacionalidad: Nacionalidad
  cantidad_personas: number
  tipo_recorrido: TipoRecorrido
  fecha_registro: Date
  ticket_id?: string
  notas?: string
}

export interface EntradaSalida {
  id: string
  ticket_id: string
  nombre_grupo: string
  tipo_recorrido: TipoRecorrido
  cantidad_personas: number
  hora_entrada: Date
  hora_salida?: Date
  estado: 'dentro' | 'fuera'
  registrado_por: string
}

export interface RegistroAuditoria {
  id: string
  usuario_id: string
  usuario_nombre: string
  tipo_actividad: TipoActividad
  descripcion: string
  fecha_hora: Date
  ip_address?: string
  datos_adicionales?: Record<string, unknown>
}

export interface CierreDiario {
  id: string
  fecha: Date
  total_tickets: number
  total_visitantes: number
  total_recaudado: number
  total_aportes: number
  total_efectivo: number
  total_tarjeta: number
  desglose_por_tipo: DesgloseTipoAcceso[]
  usuario_cierre_id: string
  usuario_cierre_nombre: string
  hora_cierre: Date
  estado: 'pendiente' | 'cerrado' | 'revisado'
  notas?: string
}

export interface DesgloseTipoAcceso {
  tipo_acceso_id: string
  tipo_acceso_nombre: string
  cantidad_tickets: number
  cantidad_personas: number
  monto: number
}

export interface OperacionPendiente {
  id: string
  tipo: 'crear_ticket' | 'actualizar_entrada' | 'registrar_salida' | 'cierre_caja'
  datos: Record<string, unknown>
  fecha_creacion: Date
  intentos: number
  ultimo_intento?: Date
  error?: string
}

export interface EstadoSincronizacion {
  conectado: boolean
  ultima_sincronizacion?: Date
  operaciones_pendientes: number
  sincronizando: boolean
}

export interface ModuloSistema {
  id: string
  nombre: string
  descripcion: string
  icono: string
  ruta: string
  activo: boolean
  requiere_rol?: RolUsuario[]
}

export interface EstadisticasDiarias {
  fecha: Date
  visitantes: number
  ingresos: number
  tickets_emitidos: number
}

// Demo users for the Users Management module
export const USUARIOS_DEMO: Usuario[] = [
  {
    id: '1',
    nombre: 'Luis Ramos',
    email: 'luis.ramos@actunkan.gt',
    rol: 'taquillero',
    taquilla: 1,
    activo: true,
    ultimo_acceso: new Date('2026-03-08T09:15:00'),
  },
  {
    id: '2',
    nombre: 'Maria Gonzalez',
    email: 'maria.gonzalez@actunkan.gt',
    rol: 'administrador',
    activo: true,
    ultimo_acceso: new Date('2026-03-08T07:30:00'),
  },
  {
    id: '3',
    nombre: 'Carlos Mendez',
    email: 'carlos.mendez@actunkan.gt',
    rol: 'supervisor',
    activo: true,
    ultimo_acceso: new Date('2026-03-07T18:45:00'),
  },
  {
    id: '4',
    nombre: 'Ana Lopez',
    email: 'ana.lopez@actunkan.gt',
    rol: 'guardia',
    activo: true,
    ultimo_acceso: new Date('2026-03-08T06:00:00'),
  },
  {
    id: '5',
    nombre: 'Jorge Hernandez',
    email: 'jorge.hernandez@actunkan.gt',
    rol: 'taquillero',
    taquilla: 2,
    activo: false,
    ultimo_acceso: new Date('2026-02-20T14:30:00'),
  },
  {
    id: '6',
    nombre: 'Rosa Martinez',
    email: 'rosa.martinez@actunkan.gt',
    rol: 'guardia',
    activo: true,
    ultimo_acceso: new Date('2026-03-08T05:45:00'),
  },
]

export const ROLES_USUARIO: { valor: RolUsuario; etiqueta: string; descripcion: string }[] = [
  { valor: 'administrador', etiqueta: 'Administrador', descripcion: 'Acceso completo al sistema' },
  { valor: 'supervisor', etiqueta: 'Supervisor', descripcion: 'Supervision y reportes' },
  { valor: 'taquillero', etiqueta: 'Taquillero', descripcion: 'Emision de tickets' },
  { valor: 'guardia', etiqueta: 'Guardia', descripcion: 'Control de acceso' },
]

// Registro de Actividades del Parque
export type SectorParque =
  | 'cavernas_principales'
  | 'sendero_norte'
  | 'sendero_sur'
  | 'zona_arqueologica'
  | 'area_administrativa'
  | 'estacionamiento'
  | 'taquilla'
  | 'area_picnic'
  | 'otro'

export const SECTORES_PARQUE: { valor: SectorParque; etiqueta: string }[] = [
  { valor: 'cavernas_principales', etiqueta: 'Cavernas Principales' },
  { valor: 'sendero_norte', etiqueta: 'Sendero Norte' },
  { valor: 'sendero_sur', etiqueta: 'Sendero Sur' },
  { valor: 'zona_arqueologica', etiqueta: 'Zona Arqueologica' },
  { valor: 'area_administrativa', etiqueta: 'Area Administrativa' },
  { valor: 'estacionamiento', etiqueta: 'Estacionamiento' },
  { valor: 'taquilla', etiqueta: 'Taquilla' },
  { valor: 'area_picnic', etiqueta: 'Area de Picnic' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export interface ActividadParque {
  id: string
  nombre_actividad: string
  sector: SectorParque
  fecha_realizacion: Date
  descripcion: string
  planificacion?: string
  responsable: string
  imagen_url?: string
  fecha_registro: Date
  usuario_registro_id: string
}

// Demo
export const ACTIVIDADES_DEMO: ActividadParque[] = [
  {
    id: '1',
    nombre_actividad: 'Limpieza de sendero norte',
    sector: 'sendero_norte',
    fecha_realizacion: new Date('2026-03-05'),
    descripcion: 'Limpieza general del sendero norte, retiro de ramas caidas y mantenimiento de senalizacion.',
    planificacion: 'Programado cada primer miercoles del mes.',
    responsable: 'Carlos Mendez',
    fecha_registro: new Date('2026-03-05T09:00:00'),
    usuario_registro_id: '1',
  },
  {
    id: '2',
    nombre_actividad: 'Inspeccion cavernas principales',
    sector: 'cavernas_principales',
    fecha_realizacion: new Date('2026-03-06'),
    descripcion: 'Revision de iluminacion, seguridad de caminos internos y estado de estalactitas en zona A.',
    responsable: 'Ana Lopez',
    fecha_registro: new Date('2026-03-06T08:30:00'),
    usuario_registro_id: '1',
  },
  {
    id: '3',
    nombre_actividad: 'Taller de educacion ambiental',
    sector: 'area_picnic',
    fecha_realizacion: new Date('2026-03-07'),
    descripcion: 'Taller educativo para visitantes escolares sobre la flora y fauna del parque.',
    planificacion: 'Actividad mensual coordinada con el Ministerio de Educacion.',
    responsable: 'Luis Ramos',
    fecha_registro: new Date('2026-03-07T10:00:00'),
    usuario_registro_id: '1',
  },
]

// Datos de ejemplo / constantes
export const NACIONALIDADES: { valor: Nacionalidad; etiqueta: string }[] = [
  { valor: 'guatemalteco', etiqueta: 'Guatemalteco' },
  { valor: 'mexicano', etiqueta: 'Mexicano' },
  { valor: 'estadounidense', etiqueta: 'Estadounidense' },
  { valor: 'europeo', etiqueta: 'Europeo' },
  { valor: 'centroamericano', etiqueta: 'Centroamericano' },
  { valor: 'sudamericano', etiqueta: 'Sudamericano' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export const TIPOS_RECORRIDO: { valor: TipoRecorrido; etiqueta: string; descripcion: string }[] = [
  { valor: 'corto', etiqueta: 'Recorrido Corto', descripcion: 'Aproximadamente 45 minutos' },
  { valor: 'largo', etiqueta: 'Recorrido Largo', descripcion: 'Aproximadamente 2 horas' },
]

export const TIPOS_ACCESO: TipoAcceso[] = [
  { id: '1', nombre: 'Entrada General', precio: 15, precio_extranjero: 25, descripcion: 'Acceso general al parque', duracion_horas: 4 },
  { id: '2', nombre: 'Entrada Estudiante', precio: 10, precio_extranjero: 15, descripcion: 'Con carnet de estudiante', duracion_horas: 4 },
  { id: '3', nombre: 'Entrada Tercera Edad', precio: 8, precio_extranjero: 12, descripcion: 'Mayores de 65 anos', duracion_horas: 4 },
  { id: '4', nombre: 'Entrada Ninos', precio: 5, precio_extranjero: 8, descripcion: 'Menores de 12 anos', duracion_horas: 4 },
  { id: '5', nombre: 'Tour Guiado', precio: 35, precio_extranjero: 50, descripcion: 'Incluye guia especializado', duracion_horas: 3, incluye_guia: true },
]

export const PRECIO_APORTE_REFORESTACION = 2

export const MODULOS_SISTEMA: ModuloSistema[] = [
  {
    id: 'autenticacion',
    nombre: 'Autenticacion y Acceso',
    descripcion: 'Inicio de sesion y registro de auditoria',
    icono: 'shield',
    ruta: '/autenticacion',
    activo: true,
  },
  {
    id: 'registro-visitantes',
    nombre: 'Registro de Visitantes',
    descripcion: 'Registrar nuevos visitantes y grupos',
    icono: 'user-plus',
    ruta: '/registro-visitantes',
    activo: true,
  },
  {
    id: 'punto-emision',
    nombre: 'Punto de Venta y Tickets',
    descripcion: 'Emitir tickets y pases de acceso',
    icono: 'ticket',
    ruta: '/punto-emision',
    activo: true,
  },
  {
    id: 'control-acceso',
    nombre: 'Control Entrada/Salida',
    descripcion: 'Registro de entradas y salidas en tiempo real',
    icono: 'scan-line',
    ruta: '/control-acceso',
    activo: true,
  },
  {
    id: 'cierre-diario',
    nombre: 'Cierre Contable Diario',
    descripcion: 'Resumen financiero y cierre de caja',
    icono: 'calculator',
    ruta: '/cierre-diario',
    activo: true,
  },
  {
    id: 'reportes',
    nombre: 'Reportes y Estadisticas',
    descripcion: 'Graficos, tendencias y exportacion de datos',
    icono: 'bar-chart-3',
    ruta: '/reportes',
    activo: true,
  },
  {
    id: 'sincronizacion',
    nombre: 'Sincronizacion Offline',
    descripcion: 'Estado de conexion y cola de sincronizacion',
    icono: 'cloud-sync',
    ruta: '/sincronizacion',
    activo: true,
  },
]

export const USUARIO_DEMO: Usuario = {
  id: '1',
  nombre: 'Luis Ramos',
  rol: 'taquillero',
  taquilla: 1,
  avatar: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-CeA0n6tM6IRk1zb1BxFVuP4L5JGQyV.png',
  activo: true,
}

// Datos de ejemplo para desarrollo
export const ENTRADAS_SALIDAS_DEMO: EntradaSalida[] = [
  {
    id: '1',
    ticket_id: 'TKT-001',
    nombre_grupo: 'Familia Rodriguez',
    tipo_recorrido: 'largo',
    cantidad_personas: 4,
    hora_entrada: new Date(Date.now() - 1000 * 60 * 45),
    estado: 'dentro',
    registrado_por: '1',
  },
  {
    id: '2',
    ticket_id: 'TKT-002',
    nombre_grupo: 'Tour Escolar San Jose',
    tipo_recorrido: 'corto',
    cantidad_personas: 25,
    hora_entrada: new Date(Date.now() - 1000 * 60 * 30),
    estado: 'dentro',
    registrado_por: '1',
  },
  {
    id: '3',
    ticket_id: 'TKT-003',
    nombre_grupo: 'Pareja Martinez',
    tipo_recorrido: 'largo',
    cantidad_personas: 2,
    hora_entrada: new Date(Date.now() - 1000 * 60 * 90),
    hora_salida: new Date(Date.now() - 1000 * 60 * 15),
    estado: 'fuera',
    registrado_por: '1',
  },
]

export const AUDITORIA_DEMO: RegistroAuditoria[] = [
  {
    id: '1',
    usuario_id: '1',
    usuario_nombre: 'Luis Ramos',
    tipo_actividad: 'login',
    descripcion: 'Inicio de sesion exitoso',
    fecha_hora: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: '2',
    usuario_id: '1',
    usuario_nombre: 'Luis Ramos',
    tipo_actividad: 'emision_ticket',
    descripcion: 'Emision de ticket TKT-001 para Familia Rodriguez (4 personas)',
    fecha_hora: new Date(Date.now() - 1000 * 60 * 100),
  },
  {
    id: '3',
    usuario_id: '1',
    usuario_nombre: 'Luis Ramos',
    tipo_actividad: 'registro_entrada',
    descripcion: 'Registro de entrada para ticket TKT-001',
    fecha_hora: new Date(Date.now() - 1000 * 60 * 45),
  },
]

export const ESTADISTICAS_SEMANA: EstadisticasDiarias[] = [
  { fecha: new Date('2026-03-01'), visitantes: 145, ingresos: 2175, tickets_emitidos: 52 },
  { fecha: new Date('2026-03-02'), visitantes: 189, ingresos: 2835, tickets_emitidos: 68 },
  { fecha: new Date('2026-03-03'), visitantes: 234, ingresos: 3510, tickets_emitidos: 84 },
  { fecha: new Date('2026-03-04'), visitantes: 167, ingresos: 2505, tickets_emitidos: 60 },
  { fecha: new Date('2026-03-05'), visitantes: 298, ingresos: 4470, tickets_emitidos: 107 },
  { fecha: new Date('2026-03-06'), visitantes: 356, ingresos: 5340, tickets_emitidos: 128 },
  { fecha: new Date('2026-03-07'), visitantes: 312, ingresos: 4680, tickets_emitidos: 112 },
]
