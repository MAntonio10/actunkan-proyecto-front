/**
 * Estado real del modo sin conexión.
 *
 * El diagnóstico decía "Soportado" mirando solo si el navegador conoce los
 * Service Workers, y eso es cierto incluso cuando no hay ninguno registrado.
 * Con esa respuesta el taquillero no tenía cómo saber que las pantallas no
 * estaban guardadas hasta quedarse sin señal y chocar con la pantalla de error
 * del navegador. Acá se pregunta lo que de verdad importa: si hay un worker
 * activo controlando esta pestaña y qué pantallas alcanzó a guardar.
 *
 * No duplica la lista de rutas de `public/sw.js` a propósito: la lee de la
 * caché, así que sigue siendo correcta cuando esa lista cambie.
 */

export interface DiagnosticoOffline {
  /** El navegador conoce la API. Falso sobre http:// que no sea localhost. */
  soportado: boolean
  /** Hay un worker registrado para este origen. */
  registrado: boolean
  /** Además está controlando esta pestaña: sin esto no intercepta nada. */
  controlando: boolean
  /** Pantallas de la aplicación guardadas, listas para abrirse sin señal. */
  rutasGuardadas: string[]
}

/** Descarta lo que no es una pantalla: estáticos, cargas RSC y recursos. */
function esRutaDePantalla(url: URL): boolean {
  return (
    url.origin === location.origin &&
    !url.searchParams.has('_rsc') &&
    !url.pathname.startsWith('/_next/') &&
    !/\.[a-z0-9]+$/i.test(url.pathname)
  )
}

export async function diagnosticarOffline(): Promise<DiagnosticoOffline> {
  const soportado =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined'

  if (!soportado) {
    return { soportado: false, registrado: false, controlando: false, rutasGuardadas: [] }
  }

  let registrado = false
  try {
    registrado = (await navigator.serviceWorker.getRegistrations()).length > 0
  } catch {
    /* algunos navegadores lo bloquean en modo privado */
  }

  const rutas = new Set<string>()
  try {
    for (const nombre of await caches.keys()) {
      const cache = await caches.open(nombre)
      for (const peticion of await cache.keys()) {
        const url = new URL(peticion.url)
        if (esRutaDePantalla(url)) rutas.add(url.pathname)
      }
    }
  } catch {
    /* sin acceso a la caché queda la lista vacía, que ya es la señal */
  }

  return {
    soportado,
    registrado,
    controlando: Boolean(navigator.serviceWorker.controller),
    rutasGuardadas: [...rutas].sort(),
  }
}
