/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empaqueta el servidor con solo las dependencias que de verdad usa, en
  // `.next/standalone`. Es lo que permite que la imagen de Docker no lleve
  // `node_modules` entero: pasa de cientos de megas a decenas.
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Permitir conexión y Hot Module Reload (HMR) desde dispositivos en la red local
  allowedDevOrigins: [
    '192.168.31.104',
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ],
  // Redirección HTTP automática a nivel de servidor hacia /login
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ]
  },
  // Permitir peticiones y Server Actions desde dispositivos en la red local (teléfono, tablet, etc.)
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        '192.168.31.104:3000',
        '0.0.0.0:3000',
      ],
    },
  },
  /**
   * Cabeceras CORS para probar desde el teléfono en la red local.
   *
   * SOLO EN DESARROLLO, y la condición no es un detalle. Estas cabeceras las
   * emite el propio frontend sobre SUS rutas, así que en producción le estarían
   * diciendo al navegador que cualquier sitio web puede leer las respuestas de
   * esta aplicación. El CORS que de verdad hace falta es el del backend, que sale
   * de su `APP_URL`; esto nunca sirvió para eso.
   */
  async headers() {
    if (process.env.NODE_ENV === 'production') return []

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

export default nextConfig
