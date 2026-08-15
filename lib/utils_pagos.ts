/**
 * Utilidades para extracción y manejo de enlaces de pago (Recurrente / Tarjeta).
 */

export function extraerCheckoutUrl(obj: unknown): string | null {
  if (!obj) return null

  // Si ya es una URL directa
  if (typeof obj === 'string') {
    const limpia = obj.trim()
    if (limpia.startsWith('http://') || limpia.startsWith('https://')) {
      return limpia
    }
    return null
  }

  if (typeof obj !== 'object') return null

  const record = obj as Record<string, unknown>

  // 1. Claves directas comunes en camelCase, snake_case y variantes
  const clavesDirectas = [
    'checkoutUrl',
    'checkout_url',
    'checkout_link',
    'checkoutLink',
    'urlCheckout',
    'url_checkout',
    'linkPago',
    'link_pago',
    'paymentUrl',
    'payment_url',
    'payment_link',
    'paymentLink',
    'recurrenteUrl',
    'recurrente_url',
    'url',
    'link',
  ]

  for (const clave of clavesDirectas) {
    const valor = record[clave]
    if (typeof valor === 'string') {
      const limpia = valor.trim()
      if (limpia.startsWith('http://') || limpia.startsWith('https://')) {
        return limpia
      }
    }
  }

  // 2. Buscar en objetos anidados comunes
  const objetosAnidados = ['checkout', 'pago', 'pagos', 'cobro', 'ticket', 'recurrente', 'transaccion', 'datos']
  for (const clave of objetosAnidados) {
    const anidado = record[clave]
    if (anidado && typeof anidado === 'object') {
      const encontrada = extraerCheckoutUrl(anidado)
      if (encontrada) return encontrada
    }
  }

  // 3. Buscar en arrays comunes (tickets, ticketPagos, pagos)
  const arrays = ['tickets', 'ticketPagos', 'pagos', 'cobros']
  for (const clave of arrays) {
    const lista = record[clave]
    if (Array.isArray(lista)) {
      for (const item of lista) {
        const encontrada = extraerCheckoutUrl(item)
        if (encontrada) return encontrada
      }
    }
  }

  // 4. Búsqueda profunda en cualquier propiedad de tipo string u objeto
  for (const valor of Object.values(record)) {
    if (typeof valor === 'string') {
      const limpia = valor.trim()
      if (
        (limpia.startsWith('http://') || limpia.startsWith('https://')) &&
        (limpia.includes('checkout') || limpia.includes('recurrente') || limpia.includes('pay') || limpia.includes('pago'))
      ) {
        return limpia
      }
    } else if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      const encontrada = extraerCheckoutUrl(valor)
      if (encontrada) return encontrada
    }
  }

  return null
}

/**
 * Determina si el estado del cobro está pendiente.
 * Normaliza valores como 'Pago pendiente', 'PENDIENTE', 'pending', 'unpaid', etc.
 */
export function esPagoPendiente(estadoPago?: unknown): boolean {
  if (estadoPago === undefined || estadoPago === null || estadoPago === '') return false
  if (typeof estadoPago === 'boolean') return !estadoPago
  if (typeof estadoPago !== 'string') return false
  const norm = estadoPago.trim().toLowerCase()
  return (
    norm === 'pending' ||
    norm === 'unpaid' ||
    norm === 'pendiente' ||
    norm === 'pago pendiente' ||
    norm.includes('pendiente') ||
    norm.includes('pending')
  )
}

/**
 * Determina si el estado del cobro está pagado.
 * Normaliza valores como 'paid', 'PAID', 'PAGADO', 'pagado', 'completed', 'succeeded', etc.
 */
export function esPagoPagado(estadoPago?: unknown): boolean {
  if (estadoPago === undefined || estadoPago === null || estadoPago === '') return false
  if (typeof estadoPago === 'boolean') return estadoPago
  if (typeof estadoPago !== 'string') return false
  const norm = estadoPago.trim().toLowerCase()
  return (
    norm === 'paid' ||
    norm === 'pagado' ||
    norm === 'completed' ||
    norm === 'completado' ||
    norm === 'succeeded' ||
    norm === 'success' ||
    norm.includes('paid') ||
    norm.includes('pagad') ||
    norm.includes('complet') ||
    norm.includes('succ')
  )
}

/**
 * Determina si el estado del cobro está cancelado o anulado.
 */
export function esPagoCancelado(estadoPago?: unknown): boolean {
  if (estadoPago === undefined || estadoPago === null || estadoPago === '') return false
  if (typeof estadoPago !== 'string') return false
  const norm = estadoPago.trim().toLowerCase()
  return norm.includes('cancel') || norm.includes('anula') || norm === 'void'
}


