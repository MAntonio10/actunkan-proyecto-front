# =============================================================================
#  Frontend (Next.js)
#
#  LO ÚNICO QUE HAY QUE ENTENDER DE ESTA IMAGEN
#  --------------------------------------------
#  `NEXT_PUBLIC_API_URL` se incrusta en el JavaScript que descarga el navegador
#  DURANTE LA COMPILACIÓN. No se lee al arrancar el contenedor. O sea:
#
#    - va como `--build-arg`, no como variable de entorno en ejecución;
#    - si cambia el dominio del backend hay que RECONSTRUIR la imagen;
#    - reiniciar el contenedor con otra variable no cambia nada.
#
#  Es el fallo más caro de este despliegue porque no se ve: la aplicación carga,
#  se ve completa, y ninguna petición llega.
# =============================================================================

# --- Etapa 1: dependencias ---------------------------------------------------
FROM node:24-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- Etapa 2: compilación ----------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La dirección pública del backend. Sin valor por defecto a propósito: un
# localhost heredado produciría una imagen que parece buena y no funciona.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN test -n "$NEXT_PUBLIC_API_URL" || \
    (echo "ERROR: falta --build-arg NEXT_PUBLIC_API_URL=https://api.sudominio.com" && exit 1)

RUN npm run build

# --- Etapa 3: ejecución ------------------------------------------------------
FROM node:24-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Sin esto Next escucha solo en localhost DENTRO del contenedor y nginx no lo
# alcanza, aunque el puerto esté publicado.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

# `output: 'standalone'` deja en `.next/standalone` el servidor con solo las
# dependencias que usa de verdad, así que no hace falta copiar node_modules.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
