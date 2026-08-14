import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza el nombre de un módulo para compararlo sin depender de mayúsculas,
 * espacios ni tildes ('Bitácora' === 'Bitacora'). Los nombres viven en la base
 * de datos y se han renombrado antes, así que comparar el texto tal cual hace
 * que el menú o un guard de ruta fallen en silencio ante un cambio de acento.
 */
export function normalizarNombreModulo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
