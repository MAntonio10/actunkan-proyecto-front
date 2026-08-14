# Módulo de Emisión de Tickets — documento retirado

Este documento describía el módulo de emisión cuando funcionaba **en memoria**, con catálogos y tarifas quemados en `tipos/index.ts`, y servía para especificarle al backend qué debía construir.

Ese trabajo ya se hizo: el módulo está conectado a la API real.

**La fuente de verdad ahora es [`DOCUMENTACION_ENDPOINTS.md`](../DOCUMENTACION_ENDPOINTS.md)** (raíz del repo), secciones 11 (`/tickets`), 12 (`/tarifas`) y 13 (`GET /tickets/catalogos`).

Puntos que cambiaron respecto a lo que decía este documento:

- Los catálogos (atracciones, orígenes, países, tipos de visitante, tipos de recorrido, formas de pago, guías) y las tarifas vienen de `GET /tickets/catalogos`; ya no existen los `*_DEMO` en el frontend para este flujo.
- **El cliente no envía precios.** El servidor resuelve la tarifa vigente al emitir, así que el total que muestra el formulario es solo informativo.
- El **folio** lo genera el servidor (correlativo único). Ya no se arma con `Math.random()` en el cliente.
- El **QR** lo firma el servidor (HMAC) y viene listo en el campo `qr` de cada ticket; el frontend lo codifica tal cual. Un QR armado en el cliente no valida.
- Guía sin carnet genera **dos tickets** unidos por `idGrupoEmision`, cada uno con su folio, QR y forma de pago.
- Emitir exige una **caja abierta** (`/cajas`); sin ella el backend responde `400`.
- Editar una tarifa no sobrescribe la fila: cierra la vigencia anterior y crea una nueva, por eso los tickets ya vendidos conservan su precio original.
