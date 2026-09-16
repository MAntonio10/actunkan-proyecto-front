/*
 * Service Worker de la taquilla del Parque Regional Municipal Actún Kan.
 *
 * Escrito a mano en vez de usar next-pwa: esa librería no acompaña el App
 * Router de Next 16 y genera un worker que asume rutas que acá no existen.
 *
 * Su único trabajo es que la aplicación cargue sin señal. Los datos ya viven en
 * IndexedDB (Dexie); acá solo se cachea la carcasa de la interfaz.
 *
 * REGLA QUE NO SE PUEDE ROMPER: nunca cachear llamadas a la API. Servir un
 * catálogo o un historial viejo desde caché, sin que nadie lo pida, es peor que
 * fallar: el taquillero cobraría con tarifas de la semana pasada creyendo que
 * están al día. Lo que se guarda para uso sin conexión pasa por Dexie, donde es
 * explícito y está fechado.
 */

const VERSION = 'actunkan-v7'
const CACHE_SHELL = `${VERSION}-shell`
const CACHE_ESTATICOS = `${VERSION}-estaticos`
const PAGINA_SIN_CONEXION = '/sin-conexion.html'

/*
 * Solo las pantallas que tienen que funcionar sin señal. El resto de los
 * módulos no se cachea a propósito: todos dependen de la API y offline se
 * quedarían en blanco o mostrando datos viejos.
 *
 * `/sincronizacion` está acá porque no consulta la API para nada: todo lo que
 * muestra sale de IndexedDB. Es además la pantalla que más falta hace sin
 * conexión, que es cuando se acumula la cola.
 *
 * Para que el taquillero no se choque con pantallas muertas, la navegación
 * oculta el resto mientras no hay conexión (`componentes/modulos_navegacion.ts`).
 * Las dos piezas van juntas: si agrega una ruta acá, márquela también como
 * disponible sin conexión allá, y al revés.
 */
const RUTAS_APP = [
  '/login',
  '/registro-visitantes',
  '/validar-ticket',
  '/sincronizacion',
]

const OTROS_RECURSOS = [
  PAGINA_SIN_CONEXION,
  '/manifest.json',
  '/actun.png',
  '/Propeten.png',
  // El fondo del sistema. Sin el, las pantallas sin conexion se ven con un
  // hueco de color plano donde el resto de la aplicacion tiene el mapa.
  '/fondo-sistema-1920.webp',
  '/icon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

/**
 * Guarda las rutas que falten, una a una.
 *
 * Una a una y no con `addAll` porque ahí un solo 404 aborta la instalación
 * completa y deja la aplicación sin worker. Y se comprueba antes de pedir,
 * porque esto se vuelve a correr en cada activación: una ruta agregada a
 * `RUTAS_APP` después de que el worker se instaló no quedaba guardada nunca, y
 * el módulo terminaba en la pantalla de error del navegador justo sin señal.
 */
async function precachearFaltantes() {
  const cache = await caches.open(CACHE_SHELL)
  await Promise.all(
    [...RUTAS_APP, ...OTROS_RECURSOS].map(async (ruta) => {
      const guardado = await cache.match(ruta, { ignoreVary: true })
      if (guardado) return
      await cache.add(ruta).catch(() => undefined)
    }),
  )
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      await precachearFaltantes()
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      await Promise.all(
        nombres
          .filter((nombre) => !nombre.startsWith(VERSION))
          .map((nombre) => caches.delete(nombre)),
      )
      await self.clients.claim()
      // Segunda pasada después de reclamar: si al instalar la red estaba a
      // medias, acá se completa lo que haya quedado afuera.
      await precachearFaltantes()
    })(),
  )
})

/** Todo lo que va al backend queda fuera del worker, sin excepciones. */
function esLlamadaApi(url) {
  return (
    url.origin !== self.location.origin ||
    /^\/(auth|tickets|usuarios|puestos|modulos|acciones|modulo-acciones|bitacora|tarifas|guias|cajas|gastos|tipos-gasto|donaciones|actividades|sectores|reportes|pagos)(\/|$)/.test(
      url.pathname,
    )
  )
}

/**
 * Navegación del App Router. Al pulsar un enlace, Next no hace una navegación
 * del navegador: pide la carga RSC de la ruta con `?_rsc=…`. Esas peticiones no
 * son `mode: 'navigate'`, así que sin este caso caían al manejador genérico,
 * fallaban sin conexión y el router terminaba en la pantalla de error.
 */
function esPeticionRsc(peticion, url) {
  return url.searchParams.has('_rsc') || peticion.headers.get('RSC') === '1'
}

/** Ruta de los estáticos de Next. Que sean inmutables lo decide la respuesta,
 *  no la ruta: ver `sePuedeGuardarComoInmutable`. */
function esEstaticoInmutable(url) {
  return url.pathname.startsWith('/_next/static/')
}

/**
 * ¿Esta respuesta se puede guardar para siempre?
 *
 * Con `next build` el nombre de cada archivo lleva un hash de su contenido y el
 * servidor lo declara `immutable`: guardarlo sin fecha de vencimiento es
 * correcto. Con `next dev` **no**: Turbopack reutiliza el nombre del chunk
 * aunque el contenido cambie, y lo sirve con `no-cache`. Guardar eso mezclaba
 * una pantalla recién compilada con módulos viejos, y la aplicación fallaba con
 * errores que no se corresponden con el código en disco.
 *
 * Por eso se pregunta a la cabecera en vez de suponerlo por la ruta.
 */
function sePuedeGuardarComoInmutable(respuesta) {
  const control = respuesta.headers.get('cache-control') || ''
  if (/no-store|no-cache/i.test(control)) return false
  if (/immutable/i.test(control)) return true
  const maxima = control.match(/max-age=(\d+)/i)
  return maxima ? Number(maxima[1]) >= 3600 : false
}

/** Red primero y caché como respaldo. Al revés, un despliegue nuevo tardaría en
 *  verse y el taquillero seguiría trabajando con la versión anterior. */
async function redPrimero(peticion, nombreCache) {
  const cache = await caches.open(nombreCache)
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) {
      cache.put(peticion, respuesta.clone())
      // Además, una copia bajo la ruta limpia: es la que se busca al navegar
      // sin señal, y la petición real llega con parámetros y cabeceras que
      // hacen fallar la coincidencia.
      const url = new URL(peticion.url)
      if (RUTAS_APP.includes(url.pathname) && !esPeticionRsc(peticion, url)) {
        cache.put(url.pathname, respuesta.clone())
      }
    }
    return respuesta
  } catch {
    const guardado = await cache.match(peticion, { ignoreVary: true })
    if (guardado) return guardado
    return null
  }
}

/**
 * Carga RSC guardada de esa misma ruta, sea cual sea el `_rsc` con que se pidió.
 * Ese parámetro cambia según el estado del router, así que buscar la URL exacta
 * falla casi siempre aunque la ruta sí esté guardada.
 */
async function rscGuardadaDeLaRuta(url) {
  const cache = await caches.open(CACHE_SHELL)
  for (const clave of await cache.keys()) {
    const claveUrl = new URL(clave.url)
    if (claveUrl.pathname === url.pathname && claveUrl.searchParams.has('_rsc')) {
      const guardado = await cache.match(clave)
      if (guardado) return guardado
    }
  }
  return null
}

/**
 * Último recurso, sin depender de la caché: si ni `/sin-conexion.html` quedó
 * guardado, igual hay que devolver algo con una salida hacia la aplicación. La
 * pantalla de error del navegador no la tiene.
 */
function respuestaDeEmergencia() {
  const html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Sin conexion</title></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;' +
    'justify-content:center;font-family:system-ui,sans-serif;background:#f5f1e6;color:#23301f">' +
    '<div style="max-width:22rem;text-align:center;padding:1.5rem">' +
    '<h1 style="font-size:1.1rem">Esta pantalla necesita conexion</h1>' +
    '<p style="font-size:.875rem;color:#5f6b59">La emision de tickets si funciona sin senal.</p>' +
    '<p><a href="/registro-visitantes" style="display:inline-block;padding:.7rem 1.2rem;' +
    'border-radius:.6rem;background:#5a8557;color:#fff;text-decoration:none;font-weight:600">' +
    'Ir a emision de tickets</a></p></div></body></html>'

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)
  if (esLlamadaApi(url)) return

  if (esEstaticoInmutable(url)) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ESTATICOS)
        const guardado = await cache.match(peticion)
        if (guardado) return guardado
        const respuesta = await fetch(peticion)
        if (respuesta.ok && sePuedeGuardarComoInmutable(respuesta)) {
          cache.put(peticion, respuesta.clone())
        }
        return respuesta
      })(),
    )
    return
  }

  if (esPeticionRsc(peticion, url)) {
    evento.respondWith(
      (async () => {
        const respuesta = await redPrimero(peticion, CACHE_SHELL)
        if (respuesta) return respuesta

        // El `_rsc` de esta petición no coincide con el de la prefetch que se
        // guardó estando en línea; sirve esa, que es de la misma ruta.
        const deLaRuta = await rscGuardadaDeLaRuta(url)
        if (deLaRuta) return deLaRuta

        // Sin nada guardado, un error hace que el router de Next abandone la
        // navegación suave y haga una navegación completa, que sí resuelve el
        // manejador de abajo contra el HTML precacheado.
        return new Response('', { status: 503, statusText: 'Sin conexión' })
      })(),
    )
    return
  }

  if (peticion.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        const respuesta = await redPrimero(peticion, CACHE_SHELL)
        if (respuesta) return respuesta

        const cache = await caches.open(CACHE_SHELL)
        // Se busca por la ruta pelada, sin los parámetros que Next agrega a la
        // URL de navegación, y sin Vary, porque la respuesta trae
        // `Vary: RSC, Next-Router-…` y con eso la coincidencia falla contra el
        // HTML que sí está precacheado. Nada de `ignoreSearch`: haría coincidir
        // la carga RSC guardada de esa misma ruta, que no es HTML y se vería
        // como basura en pantalla.
        const opciones = { ignoreVary: true }
        const porRuta = await cache.match(url.pathname, opciones)
        if (porRuta) return porRuta

        const sinConexion = await cache.match(PAGINA_SIN_CONEXION, opciones)
        if (sinConexion) return sinConexion

        // Nunca `Response.error()`: eso entrega la pantalla de error del
        // navegador, desde la que no hay vuelta a la aplicación.
        return respuestaDeEmergencia()
      })(),
    )
    return
  }

  // Resto de estáticos propios (imágenes, manifest): caché primero.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL)
      const guardado = await cache.match(peticion)
      if (guardado) return guardado
      try {
        const respuesta = await fetch(peticion)
        if (respuesta.ok) cache.put(peticion, respuesta.clone())
        return respuesta
      } catch {
        return Response.error()
      }
    })(),
  )
})
