// Tipos para el sistema de tickets del Parque Regional Municipal Actún Kan

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

export interface BitacoraBackend {
  id: number
  idUsuario: number
  usuarioNombre: string
  accion: string
  modulo: string
  descripcion: string
  fecha: string
  usuario?: {
    id: number
    nombre: string
    correo: string
    puesto?: {
      id: number
      nombre: string
    }
  }
}

export interface FiltrosBitacora {
  idUsuario?: number
  modulo?: string
  accion?: string
  fechaInicio?: string
  fechaFin?: string
  limite?: number
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

// Origen y categoria del visitante (definen el precio del ticket)
export type OrigenVisitante = 'nacional' | 'extranjero'
export type CategoriaVisitante = 'adulto' | 'nino' | 'nino_menor' | 'centro_educativo'
export type AtraccionVisitante = 'cuevas' | 'mariposario'

export const ORIGENES_VISITANTE: { valor: OrigenVisitante; etiqueta: string }[] = [
  { valor: 'nacional', etiqueta: 'Nacional' },
  { valor: 'extranjero', etiqueta: 'Extranjero' },
]

// El nombre visible de cada atracción lo sirve GET /tickets/catalogos; esta
// lista quedó sin uso tras conectar el módulo y solo se mantiene como
// referencia de los códigos. 'mariposario' es la clave estable en base de
// datos aunque la atracción se llame ahora Biblioteca Ambiental.
export const ATRACCIONES_VISITANTE: { valor: AtraccionVisitante; etiqueta: string; descripcion: string }[] = [
  { valor: 'cuevas', etiqueta: 'Cuevas Actún Kan', descripcion: 'Recorrido en cavernas naturales' },
  { valor: 'mariposario', etiqueta: 'Biblioteca Ambiental', descripcion: 'Espacio de educación ambiental' },
]

export const CATEGORIAS_VISITANTE: { valor: CategoriaVisitante; etiqueta: string; descripcion: string }[] = [
  { valor: 'adulto', etiqueta: 'Adulto', descripcion: 'Mayor de edad' },
  { valor: 'nino', etiqueta: 'Niño (7 años o más)', descripcion: 'Tarifa infantil' },
  { valor: 'nino_menor', etiqueta: 'Niño (Menor de 7 años)', descripcion: 'Entrada gratuita (Q0.00)' },
  { valor: 'centro_educativo', etiqueta: 'Centro Educativo', descripcion: 'Nivel primario' },
]

// Precio en Quetzales por persona segun atracción + origen + categoria
export const PRECIOS_VISITANTE: Record<OrigenVisitante, Record<CategoriaVisitante, number>> = {
  nacional: { adulto: 20, nino: 10, nino_menor: 0, centro_educativo: 5 },
  extranjero: { adulto: 25, nino: 25, nino_menor: 0, centro_educativo: 5 },
}

export const PRECIOS_MARIPOSARIO: Record<OrigenVisitante, Record<CategoriaVisitante, number>> = {
  nacional: { adulto: 20, nino: 10, nino_menor: 0, centro_educativo: 5 },
  extranjero: { adulto: 25, nino: 25, nino_menor: 0, centro_educativo: 5 },
}

export interface TicketEmitido {
  id: string
  numero_ticket: string
  nombre_visitante: string
  atraccion: AtraccionVisitante
  origen: OrigenVisitante
  pais_id?: number
  pais?: string
  tipo_recorrido: 'corto' | 'largo'
  cantidad_personas: number
  monto_total: number
  metodo_pago: MetodoPago
  nombre_guia?: string
  tiene_carnet_guia?: boolean
  monto_guia?: number
  metodo_pago_guia?: MetodoPago
  fecha: Date
}

export const TICKETS_EMITIDOS_DEMO: TicketEmitido[] = [
  {
    id: 't-101',
    numero_ticket: 'TCK-2026-001',
    nombre_visitante: 'Familia Morales',
    atraccion: 'cuevas',
    origen: 'nacional',
    tipo_recorrido: 'largo',
    cantidad_personas: 3,
    monto_total: 50,
    metodo_pago: 'efectivo',
    nombre_guia: 'Juan Tecún',
    tiene_carnet_guia: true,
    fecha: new Date('2026-03-08T09:15:00'),
  },
  {
    id: 't-102',
    numero_ticket: 'TCK-2026-002',
    nombre_visitante: 'John Smith & Group',
    atraccion: 'mariposario',
    origen: 'extranjero',
    tipo_recorrido: 'corto',
    cantidad_personas: 2,
    monto_total: 50,
    metodo_pago: 'tarjeta',
    fecha: new Date('2026-03-08T10:45:00'),
  },
  {
    id: 't-103',
    numero_ticket: 'TCK-2026-003',
    nombre_visitante: 'Delegación Escolar Petén',
    atraccion: 'cuevas',
    origen: 'nacional',
    tipo_recorrido: 'corto',
    cantidad_personas: 12,
    monto_total: 60,
    metodo_pago: 'efectivo',
    nombre_guia: 'Pedro Ak\'abal',
    tiene_carnet_guia: false,
    monto_guia: 15,
    metodo_pago_guia: 'efectivo',
    fecha: new Date('2026-03-08T11:30:00'),
  },
]

export const TIPOS_ACCESO: TipoAcceso[] = [
  { id: '1', nombre: 'Entrada General', precio: 15, precio_extranjero: 25, descripcion: 'Acceso general al parque', duracion_horas: 4 },
  { id: '2', nombre: 'Entrada Estudiante', precio: 10, precio_extranjero: 15, descripcion: 'Con carnet de estudiante', duracion_horas: 4 },
  { id: '3', nombre: 'Entrada Tercera Edad', precio: 8, precio_extranjero: 12, descripcion: 'Mayores de 65 anos', duracion_horas: 4 },
  { id: '4', nombre: 'Entrada Ninos', precio: 5, precio_extranjero: 8, descripcion: 'Menores de 12 anos', duracion_horas: 4 },
  { id: '5', nombre: 'Tour Guiado', precio: 35, precio_extranjero: 50, descripcion: 'Incluye guia especializado', duracion_horas: 3, incluye_guia: true },
]

export const PRECIO_APORTE_REFORESTACION = 2
export const PRECIO_TICKET_GUIA_SIN_CARNET = 15

export interface Guia {
  id: string
  nombre: string
  numero_carnet?: string
  tiene_carnet: boolean
}

export const GUIAS_DEMO: Guia[] = [
  { id: 'g1', nombre: 'Juan Tecún', numero_carnet: 'GT-2024-001', tiene_carnet: true },
  { id: 'g2', nombre: 'María Chajón', numero_carnet: 'GT-2023-045', tiene_carnet: true },
  { id: 'g3', nombre: 'Pedro Ak\'abal', numero_carnet: '', tiene_carnet: false },
]

// País de origen del visitante extranjero.
// PAISES_DEMO es un catálogo temporal en el frontend: el backend debe exponer
// un catálogo real de países (tabla propia) y este listado debe reemplazarse
// por una llamada a ese endpoint (ver docs/modulo-emision-tickets.md).
export interface PaisBackend {
  id: number
  nombre: string
  codigoIso?: string
}

export const PAISES_DEMO: PaisBackend[] = [
  { id: 1, nombre: 'Afganistán' },
  { id: 2, nombre: 'Albania' },
  { id: 3, nombre: 'Alemania' },
  { id: 4, nombre: 'Andorra' },
  { id: 5, nombre: 'Angola' },
  { id: 6, nombre: 'Antigua y Barbuda' },
  { id: 7, nombre: 'Arabia Saudita' },
  { id: 8, nombre: 'Argelia' },
  { id: 9, nombre: 'Argentina' },
  { id: 10, nombre: 'Armenia' },
  { id: 11, nombre: 'Australia' },
  { id: 12, nombre: 'Austria' },
  { id: 13, nombre: 'Azerbaiyán' },
  { id: 14, nombre: 'Bahamas' },
  { id: 15, nombre: 'Baréin' },
  { id: 16, nombre: 'Bangladés' },
  { id: 17, nombre: 'Barbados' },
  { id: 18, nombre: 'Bélgica' },
  { id: 19, nombre: 'Belice' },
  { id: 20, nombre: 'Benín' },
  { id: 21, nombre: 'Bielorrusia' },
  { id: 22, nombre: 'Birmania (Myanmar)' },
  { id: 23, nombre: 'Bolivia' },
  { id: 24, nombre: 'Bosnia y Herzegovina' },
  { id: 25, nombre: 'Botsuana' },
  { id: 26, nombre: 'Brasil' },
  { id: 27, nombre: 'Brunéi' },
  { id: 28, nombre: 'Bulgaria' },
  { id: 29, nombre: 'Burkina Faso' },
  { id: 30, nombre: 'Burundi' },
  { id: 31, nombre: 'Bután' },
  { id: 32, nombre: 'Cabo Verde' },
  { id: 33, nombre: 'Camboya' },
  { id: 34, nombre: 'Camerún' },
  { id: 35, nombre: 'Canadá' },
  { id: 36, nombre: 'Catar' },
  { id: 37, nombre: 'Chad' },
  { id: 38, nombre: 'Chile' },
  { id: 39, nombre: 'China' },
  { id: 40, nombre: 'Chipre' },
  { id: 41, nombre: 'Colombia' },
  { id: 42, nombre: 'Comoras' },
  { id: 43, nombre: 'Corea del Norte' },
  { id: 44, nombre: 'Corea del Sur' },
  { id: 45, nombre: 'Costa de Marfil' },
  { id: 46, nombre: 'Costa Rica' },
  { id: 47, nombre: 'Croacia' },
  { id: 48, nombre: 'Cuba' },
  { id: 49, nombre: 'Dinamarca' },
  { id: 50, nombre: 'Dominica' },
  { id: 51, nombre: 'Ecuador' },
  { id: 52, nombre: 'Egipto' },
  { id: 53, nombre: 'El Salvador' },
  { id: 54, nombre: 'Emiratos Árabes Unidos' },
  { id: 55, nombre: 'Eritrea' },
  { id: 56, nombre: 'Eslovaquia' },
  { id: 57, nombre: 'Eslovenia' },
  { id: 58, nombre: 'España' },
  { id: 59, nombre: 'Estados Unidos' },
  { id: 60, nombre: 'Estonia' },
  { id: 61, nombre: 'Esuatini (Suazilandia)' },
  { id: 62, nombre: 'Etiopía' },
  { id: 63, nombre: 'Filipinas' },
  { id: 64, nombre: 'Finlandia' },
  { id: 65, nombre: 'Fiyi' },
  { id: 66, nombre: 'Francia' },
  { id: 67, nombre: 'Gabón' },
  { id: 68, nombre: 'Gambia' },
  { id: 69, nombre: 'Georgia' },
  { id: 70, nombre: 'Ghana' },
  { id: 71, nombre: 'Granada' },
  { id: 72, nombre: 'Grecia' },
  { id: 73, nombre: 'Guatemala' },
  { id: 74, nombre: 'Guinea' },
  { id: 75, nombre: 'Guinea-Bisáu' },
  { id: 76, nombre: 'Guinea Ecuatorial' },
  { id: 77, nombre: 'Guyana' },
  { id: 78, nombre: 'Haití' },
  { id: 79, nombre: 'Honduras' },
  { id: 80, nombre: 'Hungría' },
  { id: 81, nombre: 'India' },
  { id: 82, nombre: 'Indonesia' },
  { id: 83, nombre: 'Irak' },
  { id: 84, nombre: 'Irán' },
  { id: 85, nombre: 'Irlanda' },
  { id: 86, nombre: 'Islandia' },
  { id: 87, nombre: 'Islas Marshall' },
  { id: 88, nombre: 'Islas Salomón' },
  { id: 89, nombre: 'Israel' },
  { id: 90, nombre: 'Italia' },
  { id: 91, nombre: 'Jamaica' },
  { id: 92, nombre: 'Japón' },
  { id: 93, nombre: 'Jordania' },
  { id: 94, nombre: 'Kazajistán' },
  { id: 95, nombre: 'Kenia' },
  { id: 96, nombre: 'Kirguistán' },
  { id: 97, nombre: 'Kiribati' },
  { id: 98, nombre: 'Kosovo' },
  { id: 99, nombre: 'Kuwait' },
  { id: 100, nombre: 'Laos' },
  { id: 101, nombre: 'Lesoto' },
  { id: 102, nombre: 'Letonia' },
  { id: 103, nombre: 'Líbano' },
  { id: 104, nombre: 'Liberia' },
  { id: 105, nombre: 'Libia' },
  { id: 106, nombre: 'Liechtenstein' },
  { id: 107, nombre: 'Lituania' },
  { id: 108, nombre: 'Luxemburgo' },
  { id: 109, nombre: 'Madagascar' },
  { id: 110, nombre: 'Malasia' },
  { id: 111, nombre: 'Malaui' },
  { id: 112, nombre: 'Maldivas' },
  { id: 113, nombre: 'Malí' },
  { id: 114, nombre: 'Malta' },
  { id: 115, nombre: 'Marruecos' },
  { id: 116, nombre: 'Mauricio' },
  { id: 117, nombre: 'Mauritania' },
  { id: 118, nombre: 'México' },
  { id: 119, nombre: 'Micronesia' },
  { id: 120, nombre: 'Moldavia' },
  { id: 121, nombre: 'Mónaco' },
  { id: 122, nombre: 'Mongolia' },
  { id: 123, nombre: 'Montenegro' },
  { id: 124, nombre: 'Mozambique' },
  { id: 125, nombre: 'Namibia' },
  { id: 126, nombre: 'Nauru' },
  { id: 127, nombre: 'Nepal' },
  { id: 128, nombre: 'Nicaragua' },
  { id: 129, nombre: 'Níger' },
  { id: 130, nombre: 'Nigeria' },
  { id: 131, nombre: 'Noruega' },
  { id: 132, nombre: 'Nueva Zelanda' },
  { id: 133, nombre: 'Omán' },
  { id: 134, nombre: 'Países Bajos' },
  { id: 135, nombre: 'Pakistán' },
  { id: 136, nombre: 'Palaos' },
  { id: 137, nombre: 'Palestina' },
  { id: 138, nombre: 'Panamá' },
  { id: 139, nombre: 'Papúa Nueva Guinea' },
  { id: 140, nombre: 'Paraguay' },
  { id: 141, nombre: 'Perú' },
  { id: 142, nombre: 'Polonia' },
  { id: 143, nombre: 'Portugal' },
  { id: 144, nombre: 'Reino Unido' },
  { id: 145, nombre: 'República Centroafricana' },
  { id: 146, nombre: 'República Checa' },
  { id: 147, nombre: 'República del Congo' },
  { id: 148, nombre: 'República Democrática del Congo' },
  { id: 149, nombre: 'República Dominicana' },
  { id: 150, nombre: 'Ruanda' },
  { id: 151, nombre: 'Rumanía' },
  { id: 152, nombre: 'Rusia' },
  { id: 153, nombre: 'Samoa' },
  { id: 154, nombre: 'San Cristóbal y Nieves' },
  { id: 155, nombre: 'San Marino' },
  { id: 156, nombre: 'San Vicente y las Granadinas' },
  { id: 157, nombre: 'Santa Lucía' },
  { id: 158, nombre: 'Santo Tomé y Príncipe' },
  { id: 159, nombre: 'Senegal' },
  { id: 160, nombre: 'Serbia' },
  { id: 161, nombre: 'Seychelles' },
  { id: 162, nombre: 'Sierra Leona' },
  { id: 163, nombre: 'Singapur' },
  { id: 164, nombre: 'Siria' },
  { id: 165, nombre: 'Somalia' },
  { id: 166, nombre: 'Sri Lanka' },
  { id: 167, nombre: 'Sudáfrica' },
  { id: 168, nombre: 'Sudán' },
  { id: 169, nombre: 'Sudán del Sur' },
  { id: 170, nombre: 'Suecia' },
  { id: 171, nombre: 'Suiza' },
  { id: 172, nombre: 'Surinam' },
  { id: 173, nombre: 'Tailandia' },
  { id: 174, nombre: 'Taiwán' },
  { id: 175, nombre: 'Tanzania' },
  { id: 176, nombre: 'Tayikistán' },
  { id: 177, nombre: 'Timor Oriental' },
  { id: 178, nombre: 'Togo' },
  { id: 179, nombre: 'Tonga' },
  { id: 180, nombre: 'Trinidad y Tobago' },
  { id: 181, nombre: 'Túnez' },
  { id: 182, nombre: 'Turkmenistán' },
  { id: 183, nombre: 'Turquía' },
  { id: 184, nombre: 'Tuvalu' },
  { id: 185, nombre: 'Ucrania' },
  { id: 186, nombre: 'Uganda' },
  { id: 187, nombre: 'Uruguay' },
  { id: 188, nombre: 'Uzbekistán' },
  { id: 189, nombre: 'Vanuatu' },
  { id: 190, nombre: 'Vaticano' },
  { id: 191, nombre: 'Venezuela' },
  { id: 192, nombre: 'Vietnam' },
  { id: 193, nombre: 'Yemen' },
  { id: 194, nombre: 'Yibuti' },
  { id: 195, nombre: 'Zambia' },
  { id: 196, nombre: 'Zimbabue' },
]

export type MetodoPago = 'efectivo' | 'tarjeta'

export interface Donacion {
  id: string
  numero_recibo: string
  nombre_donante: string
  monto: number
  metodo_pago: MetodoPago
  fecha: Date
  notas?: string
}

export const DONACIONES_DEMO: Donacion[] = [
  { id: '1', numero_recibo: 'DON-2026-001', nombre_donante: 'Asociación Ecológica Petén', monto: 500, metodo_pago: 'efectivo', fecha: new Date('2026-03-05T10:30:00'), notas: 'Donativo para conservación de flora' },
  { id: '2', numero_recibo: 'DON-2026-002', nombre_donante: 'Carlos Mendoza', monto: 200, metodo_pago: 'tarjeta', fecha: new Date('2026-03-07T14:15:00') },
  { id: '3', numero_recibo: 'DON-2026-003', nombre_donante: 'Familia Ramírez', monto: 150, metodo_pago: 'efectivo', fecha: new Date('2026-03-08T09:00:00') },
]

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
    id: 'donaciones',
    nombre: 'Módulo de Donaciones',
    descripcion: 'Registro de donativos y emisión de recibos',
    icono: 'heart',
    ruta: '/donaciones',
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

// ==========================================
// Interfaces Backend para API REST Aktun Kan
// ==========================================

export interface PuestoBackend {
  id: number
  nombre: string
  descripcion: string
  anulado: boolean
  fechaCreacion: string
  fechaActualizacion: string
  _count?: {
    usuarios: number
  }
}

export interface AccionBackend {
  id: number
  nombre: string
}

export interface ModuloBackend {
  id: number
  nombre: string
  anulado: boolean
  fechaCreacion: string
  fechaActualizacion: string
  // Los módulos de infraestructura (Modulos, Acciones) tienen esAsignable=false:
  // existen para armar el menú y la pantalla de permisos, pero el backend
  // rechaza con 400 cualquier intento de concederlos a un usuario.
  esAsignable?: boolean
  idModuloPadre?: number | null
  moduloPadre?: { id: number; nombre: string } | null
  moduloAcciones?: ModuloAccionBackend[]
}

// Respuesta de GET /modulos/mis-modulos: un elemento por módulo accesible,
// con las acciones efectivamente concedidas al usuario de la sesión.
export interface ModuloMenu {
  id: number
  nombre: string
  esAsignable: boolean
  idModuloPadre: number | null
  moduloPadre?: { id: number; nombre: string } | null
  acciones: string[]
}

export interface ModuloAccionBackend {
  id: number
  idModulo: number
  idAccion: number
  modulo?: ModuloBackend
  accion?: AccionBackend
}

export interface PermisoBackend {
  id: number
  idUsuario: number
  idModuloAccion: number
  moduloAccion?: ModuloAccionBackend
}

export interface UsuarioBackend {
  id: number
  idPuesto: number
  nombre: string
  correo: string
  telefono: string
  fechaCreacion: string
  fechaActualizacion: string
  anulado: boolean
  puesto?: PuestoBackend
  permiso?: PermisoBackend[]
}

export interface RespuestaTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: string
  refresh_expira: string
}

export interface RespuestaLogin extends RespuestaTokens {
  usuario: UsuarioBackend
}

export interface SesionBackend {
  id: number
  fechaCreacion: string
  fechaExpira: string
  ip?: string
  dispositivo?: string
  esActual?: boolean
}

// ==========================================
// Emisión de Tickets (módulo EmisionTickets)
// ==========================================

// Los catálogos usan `codigo` como clave estable de negocio; `nombre` es solo
// presentación. Las reglas dependen del codigo, nunca del nombre.
export interface CatalogoCodificado {
  id: number
  codigo: string
  nombre: string
}

export interface PaisCatalogo {
  id: number
  nombre: string
  codigoIso?: string
}

export interface OpcionPagoCatalogo {
  id: number
  nombre: string
  esEfectivo: boolean
}

export interface GuiaCatalogo {
  id: number
  nombre: string
  tieneCarnet: boolean
}

// El catálogo de /guias no tiene alta propia: un guía nuevo se registra dentro
// de POST /tickets/emitir. Estos endpoints sirven para consultar, corregir y
// dar de baja. El número de carnet nunca se imprime en el pase.
export interface GuiaBackend extends GuiaCatalogo {
  numeroCarnet?: string | null
  anulado: boolean
  fechaCreacion?: string
  fechaActualizacion?: string
  _count?: { tickets: number }
}

export interface TarifaBackend {
  idAtraccion: number
  idOrigen: number
  idTipoVisitante: number
  precio: string
}

export interface CatalogosTickets {
  atracciones: CatalogoCodificado[]
  origenes: CatalogoCodificado[]
  paises: PaisCatalogo[]
  tiposVisitante: CatalogoCodificado[]
  tiposRecorrido: CatalogoCodificado[]
  opcionesPago: OpcionPagoCatalogo[]
  guias: GuiaCatalogo[]
  tarifas: TarifaBackend[]
  precioTicketGuia: string
}

export interface VisitantePorTicket {
  idTipoVisitante: number
  cantidad: number
  precioUnitario: string
  subtotal: string
}

export interface TicketPago {
  idOpcionPago: number
  monto: string
}

export interface TicketBackend {
  id: number
  // Comparten idGrupoEmision el ticket del visitante y el de su guía sin carnet
  idGrupoEmision?: number
  idGuia?: number | null
  numeroTicket: string
  tipoTicket: 'VISITANTE' | 'GUIA'
  nombre?: string | null
  cantidadPersonas: number
  montoTotal: string
  observaciones?: string | null
  // `qr` es la cadena exacta que debe codificarse en el código QR impreso.
  qr?: string
  qrFirma?: string
  atraccion?: CatalogoCodificado
  origen?: CatalogoCodificado
  pais?: PaisCatalogo | null
  tipoRecorrido?: CatalogoCodificado
  // El guía llega como objeto, no como campos planos, y viene poblado tanto en
  // el ticket del visitante como en el de tipo GUIA. Es null si no hubo guía.
  guia?: GuiaCatalogo | null
  usuario?: { id: number; nombre: string; correo?: string }
  fechaCreacion?: string
  fechaActualizacion?: string
  fechaUso?: string | null
  idUsuarioUso?: number | null
  anulado?: boolean
  visitantePorTickets?: VisitantePorTicket[]
  ticketPagos?: TicketPago[]
  // Pasarela de Pagos (Recurrente / Tarjeta)
  estadoPago?: 'PENDIENTE' | 'PAGADO' | 'CANCELADO' | string
  checkoutUrl?: string | null
  checkout_url?: string | null
  idCheckout?: string | null
}

export interface RespuestaEmisionTicket {
  idGrupoEmision: number
  montoVisitantes: string
  montoGuia: string
  montoTotalGeneral: string
  tickets: TicketBackend[]
  checkoutUrl?: string | null
  checkout_url?: string | null
  idCheckout?: string | null
  estadoPago?: string
}

export interface TicketConfirmadoPago {
  numeroTicket: string
  nombre?: string | null
  personas?: number
  cantidadPersonas?: number
  atraccion?: string | CatalogoCodificado
  monto?: number | string
}

export interface RespuestaConfirmacionPago {
  pagado: boolean
  mensaje?: string
  monto?: number | string
  ticket?: TicketConfirmadoPago
}

export interface RespuestaPagoTicket {
  id?: number
  idTicket?: number
  estado?: 'PENDIENTE' | 'PAGADO' | 'CANCELADO' | string
  estadoPago?: 'PENDIENTE' | 'PAGADO' | 'CANCELADO' | string
  checkoutUrl?: string | null
  checkout_url?: string | null
  idCheckout?: string | null
  monto?: number | string
  ticket?: TicketBackend
  [key: string]: unknown
}

export interface GuiaEmision {
  modo: 'existente' | 'nuevo'
  idGuia?: number
  nombre?: string
  tieneCarnet?: boolean
  numeroCarnet?: string
  idOpcionPagoGuia?: number
}

export interface PayloadEmisionTicket {
  nombreGrupo: string
  idAtraccion: number
  idOrigen: number
  idPais: number | null
  idTipoRecorrido: number
  cantidades: { idTipoVisitante: number; cantidad: number }[]
  idOpcionPago: number
  notas?: string
  guia?: GuiaEmision
}

export interface FiltrosTickets {
  buscar?: string
  idAtraccion?: number
  idOpcionPago?: number
  idOrigen?: number
  idPais?: number
  fechaInicio?: string
  fechaFin?: string
  incluirAnulados?: boolean
  pagina?: number
  limite?: number
}

export interface MetricasTickets {
  totalTickets: number
  totalPersonas: number
  montoRecaudado: string
}

export interface RespuestaHistorialTickets {
  datos: TicketBackend[]
  total: number
  pagina: number
  limite: number
  metricas: MetricasTickets
}

export interface RespuestaValidacionTicket {
  valido: boolean
  mensaje: string
  ticket?: TicketBackend
}

// ==========================================
// Cajas y Gastos (módulo Cajas + sub-módulo Gastos)
// ==========================================

// Los montos llegan como cadena decimal desde el backend (ej. "500.0000").
export interface EstadoCaja {
  id: number
  nombre: string
}

export interface CierreCajaBackend {
  id: number
  idApertura: number
  fechaCierre: string
  montoFinal: string
  montoEsperado: string
  diferencia: string
  observaciones?: string
  anulado: boolean
}

export interface TipoGastoBackend {
  id: number
  nombre: string
  anulado: boolean
  _count?: { gastos: number }
}

export interface GastoBackend {
  id: number
  idTipoGasto: number
  idAperturaCaja: number
  idUsuario: number
  descripcion: string
  monto: string
  anulado: boolean
  fechaCreacion: string
  fechaActualizacion: string
  tipoGasto?: TipoGastoBackend
}

export interface AperturaCajaBackend {
  id: number
  idUsuario: number
  montoInicial: string
  observaciones?: string
  anulado: boolean
  fechaCreacion: string
  fechaActualizacion: string
  usuario?: { id: number; nombre: string; correo: string }
  estado?: EstadoCaja
  cierresCaja?: CierreCajaBackend[]
  gastos?: GastoBackend[]
}

// GET /cajas/actual devuelve un envoltorio, no la caja directamente: el estado
// "no hay caja abierta" queda explícito en lugar de llegar como null.
export interface RespuestaCajaActual {
  hayCajaAbierta: boolean
  caja: AperturaCajaBackend | null
}

// Los importes pueden llegar como número o como cadena Decimal ("1600.0000"),
// según cómo serialice cada endpoint: conviértalos antes de operar con ellos.
export interface ArqueoCaja {
  idApertura: number
  montoInicial: number | string
  ventasEfectivo: number | string
  totalGastos: number | string
  montoEsperado: number | string
}

export interface RespuestaCierreCaja {
  apertura: AperturaCajaBackend
  cierre: CierreCajaBackend
}

export interface FiltrosCajas {
  estado?: string
  fechaInicio?: string
  fechaFin?: string
  incluirAnulados?: boolean
}

// Historial de cierres: vista de supervisión (Cajas/Editar). Incluye los
// anulados, que son la señal de que una caja se reabrió para corregir un monto.
export interface CierreCajaHistorial extends CierreCajaBackend {
  aperturaCaja?: {
    id: number
    montoInicial: string
    usuario?: { id: number; nombre: string; correo?: string }
    estado?: EstadoCaja
  }
}

export interface MetricasCierres {
  totalCierres: number
  totalContado: string
  totalEsperado: string
  /** Negativa es faltante acumulado; positiva, sobrante. */
  diferenciaAcumulada: string
}

export interface RespuestaHistorialCierres {
  datos: CierreCajaHistorial[]
  total: number
  pagina: number
  limite: number
  metricas: MetricasCierres
}

export interface FiltrosCierres {
  idUsuario?: number
  fechaInicio?: string
  fechaFin?: string
  soloAnulados?: boolean
  incluirAnulados?: boolean
  pagina?: number
  limite?: number
}

