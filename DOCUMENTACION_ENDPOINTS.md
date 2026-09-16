# Documentación de Endpoints y Estructuras JSON

Documento de referencia para la integración con la API REST del sistema **Aktun Kan Backend**. Contiene los métodos HTTP, rutas, parámetros, estructuras del cuerpo de solicitud (`Request Body`) y respuestas esperadas (`Response Body`) en formato JSON para las operaciones de **POST**, **GET**, **PATCH/UPDATE**, **ACTIVAR**, **RESTABLECER CONTRASEÑA** y **DELETE/ANULAR**.

---

## Novedades en Autenticación
- **Restablecimiento de Contraseña con Código de 6 Dígitos:** Se agregaron los endpoints públicos `POST /auth/solicitar-codigo-restablecimiento`, `POST /auth/validar-codigo-restablecimiento` y `POST /auth/restablecer-contrasena` con envío de correos vía Nodemailer.
- **Activación de Registros:** Endpoints explícitos `PATCH /:id/activar` para reactivar registros anulados en **Usuarios**, **Puestos** y **Módulos**.
## Paginación de listados

⚠️ **Cambio de contrato con el frontend (16-09-2026).** Cinco listados que antes
devolvían un arreglo plano ahora devuelven un sobre:

```json
{ "datos": [ ... ], "total": 1627, "pagina": 1, "limite": 100 }
```

`total` es el conjunto **filtrado completo**, no el tamaño de la página. Todos
aceptan además `pagina` (defecto `1`) y `limite`.

| Endpoint | `limite` por defecto | Máximo |
|---|---|---|
| `GET /usuarios` | 50 | 200 |
| `GET /bitacora` | 100 | 200 |
| `GET /cajas` | 50 | 200 |
| `GET /guias` | 50 | 200 |
| `GET /tarifas/historico` | 50 | 200 |

- `limite=0` o por encima del tope responde **400** con mensaje en español.
- Una `pagina` más allá del final responde **200** con `datos: []` y el `total`
  real. **No es un error**; no lo trate como fallo.
- `/usuarios`, `/guias` y `/tarifas/historico` validan su query con un DTO
  (`forbidNonWhitelisted`): un parámetro desconocido ya no se ignora, responde
  **400**. Los válidos son exactamente `incluirAnulados` (usuarios, guías),
  `buscar` (guías), `idAtraccion` e `idOrigen` (tarifas), más `pagina` y
  `limite` en los tres.

**Ya devolvían el sobre desde antes** (no cambiaron): `/tickets`, `/donaciones`,
`/cajas/cierres`, `/actividades`.

⚠️ **`/actividades` no usa el tope general.** Tiene su propio preset
(`PAGINACION_ACTIVIDADES`): por omisión **20** y **máximo 100**. Pedirle
`limite=200`, como hacen los combos de los demás listados, responde **400**.

**Siguen siendo arreglo plano** — no los envuelva: `/puestos`, `/acciones`,
`/modulos`, `/modulo-acciones`, `/modulos/mis-modulos`, `/sectores`, `/tarifas`
(vigentes), `/tickets/catalogos`, `/auth/sesiones`.

Del lado del frontend: un listado que alimenta un `<select>` o un caché offline
pide `limite: 200` de una vez y lee `.datos` (no se pagina un desplegable, o
esconde opciones sin avisar); los historiales con tabla sí usan `total` para
pintar un paginador.

---

## Seguridad y límites de peticiones

**`JWT_SECRET` es obligatorio.** La aplicación **no arranca** si falta o tiene menos de 32 caracteres (`src/auth/auth.module.ts`). Antes existía un valor por defecto en el código, lo que permitía firmar tokens de cualquier usuario a quien tuviera acceso al repositorio; ese fallback se eliminó. Cambiar el secreto invalida todas las sesiones activas.

### Sesiones: token de acceso + refresh token

⚠️ **Cambio de contrato con el frontend.** `POST /auth/login` ya no devuelve un token de larga duración: devuelve un **access token corto** (30 min) y un **refresh token** con el que renovarlo.

| Token | Duración | Revocable |
|---|---|---|
| `access_token` (JWT) | `JWT_ACCESS_EXPIRA`, por defecto **30 min** | No — por eso dura poco |
| `refresh_token` (cadena opaca) | **30 días** con `recordarme: true`, **24 h** sin él | **Sí**, individualmente |

Cómo funciona y por qué:

- El refresh se guarda en la tabla `SesionRefresh` **solo como hash SHA-256**: si la base de datos se filtrara, los valores almacenados no sirven para autenticarse.
- **Rotación en cada uso:** al refrescar, el token anterior se revoca y se emite uno nuevo, conservando la fecha de expiración original (refrescar no alarga la sesión indefinidamente).
- **Detección de robo:** si llega un refresh **ya revocado**, se asume que alguien lo copió y se cierran **todas las sesiones de ese usuario**, con registro `ALERTA_SESION` en Bitácora. No afecta a ningún otro usuario.
- Restablecer la contraseña cierra todas las sesiones de ese usuario.

**Qué debe hacer el frontend:** guardar ambos tokens; ante un `401`, llamar a `POST /auth/refresh` con el `refresh_token`, **reemplazar los dos** por los nuevos y reintentar la petición. Si el refresh también falla, enviar al login.

| Ruta | Auth | Descripción |
|---|---|---|
| `POST /auth/refresh` | Pública | `{ refresh_token }` → nuevo par de tokens. 30/min por IP |
| `POST /auth/logout` | Pública | `{ refresh_token }` → cierra **esa** sesión; las demás siguen activas |
| `POST /auth/logout-todas` | Token | Cierra todas las sesiones del usuario autenticado |
| `GET /auth/sesiones` | Token | Sesiones activas propias (fecha, IP, dispositivo) |
| `DELETE /auth/sesiones/:id` | Token | Cierra una sesión concreta (ej. una taquilla olvidada) |

Respuesta de `POST /auth/login` y `POST /auth/refresh`:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rQ8-A_q1N7N4ZhM9O-rW7IQSfqf-lkO5By2cpP7ypAE",
  "token_type": "Bearer",
  "expires_in": "30m",
  "refresh_expira": "2026-09-12T17:00:00.000Z"
}
```
> `login` incluye además el objeto `usuario`.

**Límite de peticiones por IP** (`@nestjs/throttler`, primer guard global):

| Alcance | Límite | Respuesta al excederlo |
|---|---|---|
| Toda la API | `THROTTLE_LIMITE` por `THROTTLE_TTL_SEGUNDOS` (por defecto 120 por minuto) | `429 Too Many Requests` |
| `POST /auth/login` | 10 por minuto | `429` |
| `POST /auth/validar-codigo-restablecimiento` y `/auth/restablecer-contrasena` | 10 por minuto | `429` |
| `POST /auth/solicitar-codigo-restablecimiento` | 5 por hora | `429` |

> El límite se evalúa **antes** de verificar el token, para que una ráfaga se descarte sin tocar la base de datos.
>
> Si la aplicación corre detrás de un proxy inverso, hay que poner `TRUST_PROXY=true`; de lo contrario todas las peticiones llegan con la IP del proxy y el límite se comparte entre todos los usuarios. Actívelo solo con un proxy de confianza al frente: expuesto directo a internet, permitiría falsificar la IP con `X-Forwarded-For`.

### Variables de entorno requeridas

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a SQL Server |
| `JWT_SECRET` | **Sí** | Firma de los tokens, mínimo 32 caracteres |
| `JWT_ACCESS_EXPIRA` | No | Vida del token de acceso (por defecto `30m`) |
| `CORS_ORIGINS` | No | Dominios permitidos separados por coma. Vacío = cualquiera (solo desarrollo) |
| `TICKET_QR_SECRET` | Recomendada | Firma HMAC del QR; si cambia, los pases impresos dejan de validar |
| `TICKET_SERIE` | No | Serie del folio correlativo (por defecto `TCK`) |
| `THROTTLE_LIMITE` / `THROTTLE_TTL_SEGUNDOS` | No | Límite global de peticiones (120 / 60 s) |
| `TRUST_PROXY` | No | `true` solo detrás de un proxy inverso de confianza |
| `SMTP_*` | Sí para correos | Configuración de Nodemailer |

## Estructura de permisos

El sistema se organiza en **módulos generales**, que pueden agrupar **sub-módulos** con permisos propios (`Modulo.idModuloPadre`). El permiso siempre se evalúa como **módulo + acción**.

| Módulo general | Sub-módulos | Cubre |
|---|---|---|
| `EmisionTickets` | — | Todo lo relacionado a tickets: emisión, historial, validación de QR, tarifas y la lectura de catálogos (atracciones, guías, países, tipos, formas de pago) |
| `Cajas` | `Gastos` | Apertura, cierre y arqueo. `Gastos` es sub-módulo con permisos propios (incluye el catálogo de tipos de gasto) |
| `Usuarios` | `Puestos` | Usuarios, puestos y asignación de permisos |
| `Bitacora` | — | Consulta de bitácora |

> **Emisión de Tickets es un módulo general**: atracciones, guías, tarifas y demás catálogos **no** son módulos de permiso aparte. Quien tiene permiso sobre `EmisionTickets` lo tiene sobre todo el módulo, con la granularidad de las 4 acciones.

### Módulos de infraestructura (no asignables)

`Modulos` y `Acciones` tienen `esAsignable: false`. Existen para que el frontend arme el menú y la pantalla de permisos, pero **no se conceden a ningún usuario**:

- No deben mostrarse en la pantalla de asignación de permisos. El frontend los filtra con `GET /modulos?soloAsignables=true` o por el campo `esAsignable`, sin nombres quemados en código.
- `POST /usuarios/:id/permisos` **rechaza con `400`** cualquier intento de asignarlos.
- Los permisos que ya existían sobre ellos se conservan (no se borró ninguna fila), pero la API ya no acepta volver a asignarlos.

Para que ocultarlos no rompa el menú, este **no** depende de un permiso: usa `GET /modulos/mis-modulos` (ver 4.7), que solo exige sesión válida.

Pendientes de implementar (aún sin código): `Donaciones`, `Sincronizacion`, `Reportes`, `ActividadesParque`.

- **Acciones:** `'Ver'`, `'Crear'`, `'Editar'`, `'Anular'`, `'Exportar'`
- Un handler **sin** `@RequirePermission` queda accesible a cualquier usuario autenticado (`permissions.guard.ts` es fail-open por diseño), así que toda ruta nueva debe declararlo explícitamente.

## Novedades en Cajas
- **Apertura y cierre de caja con arqueo automático:** Se agregó el módulo `/cajas`. Al cerrar, el sistema calcula el monto esperado (`montoInicial + ventas en efectivo - gastos`) y lo compara contra el monto contado, generando una `diferencia` (sobrante/faltante).
- **Inmutabilidad:** Ni la apertura ni el cierre se editan una vez creados — solo se pueden **anular** (`Cajas` / `Anular`). El módulo `Cajas` no usa la acción `'Editar'`.
- **Gastos:** Se agregó `/gastos` (registro de gastos contra la caja abierta actual) y su catálogo `/tipos-gasto`.
- **Integridad del arqueo:** un gasto solo puede crearse, editarse o anularse mientras su caja sigue **abierta**. Tocarlo después del cierre devuelve `400`, porque alteraría de forma retroactiva un arqueo ya guardado.
- **Reapertura controlada:** anular un cierre devuelve `409` si en ese momento hay otra caja abierta; nunca pueden quedar dos cajas abiertas a la vez.
- **Trazabilidad:** cada gasto guarda `idUsuario` (quién lo registró), además del registro en Bitácora.
- **Configuración requerida tras desplegar:** ejecutar `npx ts-node prisma/seed-modulos-dinero.ts` para registrar el módulo general `'Cajas'` y su sub-módulo `'Gastos'` con sus acciones (script aditivo e idempotente). Después, otorgar los permisos a cada usuario con `POST /usuarios/:id/permisos`.

## Novedades en Tickets
- **Módulo de emisión completo:** `/tickets` (catálogos, emisión, historial con métricas y validación de QR en taquilla) y `/tarifas` con vigencia histórica.
- **Sin CRUD por catálogo:** atracciones, orígenes, países, tipos y formas de pago son datos de configuración que alimentan el formulario. Se leen todos con `GET /tickets/catalogos` y se administran por seed.
- **Cierra el circuito de dinero:** cada ticket queda asociado a la caja abierta y genera su `TicketPago`; el arqueo de `/cajas/:id/arqueo` por fin suma ventas en efectivo además de restar gastos.
- **Variables de entorno nuevas:** `TICKET_QR_SECRET` (firma HMAC del QR — si cambia, los pases ya impresos dejan de validar) y `TICKET_SERIE` (serie alfanumérica del folio, default `TCK`).
- **Permiso único:** todo el módulo se controla con `EmisionTickets` + acción. Los catálogos (atracciones, guías, tarifas, países…) **no** tienen módulo de permiso propio.
- **Seed:** `npx ts-node prisma/seed-tickets.ts` siembra catálogos y tarifas iniciales; `npx ts-node prisma/reorganizar-modulos.ts` consolida la estructura de módulos generales y sub-módulos.

---

## Índice de Contenidos
1. [Autenticación (`/auth`)](#1-autenticación-auth)
2. [Usuarios (`/usuarios`)](#2-usuarios-usuarios)
3. [Puestos (`/puestos`)](#3-puestos-puestos)
4. [Módulos (`/modulos`)](#4-módulos-modulos)
5. [Acciones (`/acciones`)](#5-acciones-acciones)
6. [Módulo-Acciones (`/modulo-acciones`)](#6-módulo-acciones-modulo-acciones)
7. [Bitácora y Auditoría (`/bitacora`)](#7-bitácora-y-auditoría-bitacora)
8. [Cajas (`/cajas`)](#8-cajas-cajas)
9. [Gastos (`/gastos`)](#9-gastos-gastos)
10. [Tipos de Gasto (`/tipos-gasto`)](#10-tipos-de-gasto-tipos-gasto)
11. [Tickets (`/tickets`)](#11-tickets-tickets)
12. [Tarifas (`/tarifas`)](#12-tarifas-tarifas)
13. [Catálogos de Tickets (`GET /tickets/catalogos`)](#13-catálogos-de-tickets--get-ticketscatalogos)

---

## 1. Autenticación (`/auth`)

### 1.1 `POST /auth/login`
Inicia sesión y devuelve un **par de tokens**: uno de acceso (corto) y uno de refresco (largo y revocable). Ver [Sesiones](#sesiones-token-de-acceso--refresh-token).

* **Headers:** `Content-Type: application/json`
* **Request Body (JSON):**
```json
{
  "correo": "admin@aktunkan.com",
  "contrasena": "Password123!",
  "recordarme": true
}
```
> **Nota de Duración de la Sesión:**
> - El `access_token` dura **30 minutos** siempre; se renueva con `POST /auth/refresh`.
> - El `refresh_token` dura **30 días** si `"recordarme": true`, o **24 horas** si se omite.

* **Response (201 Created - JSON):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rQ8-A_q1N7N4ZhM9O-rW7IQSfqf-lkO5By2cpP7ypAE",
  "token_type": "Bearer",
  "expires_in": "30m",
  "refresh_expira": "2026-09-12T17:00:00.000Z",
  "usuario": {
    "id": 1,
    "idPuesto": 1,
    "nombre": "Administrador General",
    "correo": "admin@aktunkan.com",
    "telefono": "55551234",
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z",
    "anulado": false
  }
}
```
> El `refresh_token` se muestra **una sola vez**: en la base de datos solo queda su hash. Guárdalo junto con el `access_token`.

---

### 1.2 `GET /auth/me`
Obtiene la información del perfil del usuario autenticado actual.

* **Headers:** `Authorization: Bearer <token_jwt>`
* **Response (200 OK - JSON):**
```json
{
  "id": 1,
  "idPuesto": 1,
  "nombre": "Administrador General",
  "correo": "admin@aktunkan.com",
  "telefono": "55551234",
  "fechaCreacion": "2026-07-24T14:00:00.000Z",
  "fechaActualizacion": "2026-07-24T14:00:00.000Z",
  "anulado": false,
  "puesto": {
    "id": 1,
    "nombre": "Administrador",
    "descripcion": "Acceso total al sistema",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  },
  "permiso": []
}
```

---

### 1.3 `POST /auth/solicitar-codigo-restablecimiento` (Público)
Genera un código aleatorio de 6 dígitos con expiración de 15 minutos y lo envía al correo del usuario vía Nodemailer.

* **Headers:** `Content-Type: application/json`
* **Request Body (JSON):**
```json
{
  "correo": "usuario@aktunkan.com"
}
```

* **Response (201 Created - JSON):**
```json
{
  "mensaje": "Se ha enviado un código de verificación de 6 dígitos al correo electrónico 'usuario@aktunkan.com'.",
  "expiracionMinutos": 15
}
```

---

### 1.4 `POST /auth/validar-codigo-restablecimiento` (Público)
Valida si un código de 6 dígitos ingresado por el usuario es correcto y no ha expirado.

* **Headers:** `Content-Type: application/json`
* **Request Body (JSON):**
```json
{
  "correo": "usuario@aktunkan.com",
  "codigo": "482915"
}
```

* **Response (201 Created - JSON):**
```json
{
  "valido": true,
  "mensaje": "El código de verificación es válido."
}
```

---

### 1.5 `POST /auth/restablecer-contrasena` (Público)
Valida el código de 6 dígitos y actualiza la contraseña del usuario con encriptación bcrypt en la base de datos bajo transacción atómica.

* **Headers:** `Content-Type: application/json`
* **Request Body (JSON):**
```json
{
  "correo": "usuario@aktunkan.com",
  "codigo": "482915",
  "nuevaContrasena": "NuevaClaveSegura2026!"
}
```

* **Response (201 Created - JSON):**
```json
{
  "mensaje": "La contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión con su nueva contraseña."
}
```

---

## 2. Usuarios (`/usuarios`)

### 2.1 `POST /usuarios` (Crear Usuario)
Registra un nuevo usuario en la base de datos bajo transacción atómica.

* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Crear'`
* **Headers:** `Authorization: Bearer <token_jwt>`, `Content-Type: application/json`
* **Request Body (JSON):**
```json
{
  "nombre": "Carlos Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "contrasena": "ClaveSegura2026",
  "idPuesto": 2,
  "telefono": "55554321"
}
```

* **Response (201 Created - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55554321",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z",
  "anulado": false,
  "puesto": {
    "id": 2,
    "nombre": "Taquillero",
    "descripcion": "Atención y venta de tickets",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  }
}
```

---

### 2.2 `GET /usuarios` (Listar Usuarios)
* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Ver'`
* **Query Params (Opcional):** `?incluirAnulados=true`, `?pagina=1`, `?limite=50` (máx. 200). Cualquier otro parámetro responde 400.
* **Response (200 OK - JSON):** **paginado** — ver «Paginación de listados». El arreglo de abajo es el contenido de `datos`, dentro del sobre `{ datos, total, pagina, limite }`.
```json
[
  {
    "id": 1,
    "idPuesto": 1,
    "nombre": "Administrador General",
    "correo": "admin@aktunkan.com",
    "telefono": "55551234",
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z",
    "anulado": false,
    "puesto": {
      "id": 1,
      "nombre": "Administrador",
      "descripcion": "Acceso total al sistema",
      "anulado": false,
      "fechaCreacion": "2026-07-24T14:00:00.000Z",
      "fechaActualizacion": "2026-07-24T14:00:00.000Z"
    },
    "permiso": []
  }
]
```

---

### 2.3 `GET /usuarios/:id` (Obtener Usuario por ID)
* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55554321",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z",
  "anulado": false,
  "puesto": {
    "id": 2,
    "nombre": "Taquillero",
    "descripcion": "Atención y venta de tickets",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  },
  "permiso": []
}
```

---

### 2.4 `PATCH /usuarios/:id` (Actualizar Usuario)
* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Request Body (JSON - Todos los campos opcionales):**
```json
{
  "nombre": "Carlos Alberto Mendoza",
  "telefono": "55559999",
  "idPuesto": 2
}
```

* **Response (200 OK - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Alberto Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55559999",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:05:00.000Z",
  "anulado": false,
  "puesto": {
    "id": 2,
    "nombre": "Taquillero",
    "descripcion": "Atención y venta de tickets",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  }
}
```

---

### 2.5 `PATCH /usuarios/:id/activar` (Reactivar Usuario)
Reactiva un usuario previamente anulado (`anulado: false`) bajo transacción atómica.

* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Alberto Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55559999",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:15:00.000Z",
  "anulado": false,
  "puesto": {
    "id": 2,
    "nombre": "Taquillero",
    "descripcion": "Atención y venta de tickets",
    "anulado": false
  }
}
```

---

### 2.6 `DELETE /usuarios/:id` (Anular Usuario)
* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Alberto Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55559999",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:06:00.000Z",
  "anulado": true
}
```

---

### 2.7 `POST /usuarios/:id/permisos` (Asignar / Reemplazar Permisos)
* **Permiso requerido:** `Módulo: 'Usuarios'`, `Acción: 'Editar'`
* **Path Params:** `id` (ID del usuario)
* **Request Body (JSON - Permite arreglo vacío `[]` para revocar todos):**
```json
{
  "idsModuloAccion": [1, 2, 3, 5]
}
```
> ⚠️ **Reemplaza la lista completa**: los permisos que no vengan en el arreglo se revocan. Envía siempre el conjunto completo que debe quedar, no solo los nuevos.
>
> Devuelve `400` si alguno de los IDs pertenece a un módulo con `esAsignable: false` (`Modulos`, `Acciones`).

* **Response (200 OK - JSON):**
```json
{
  "id": 2,
  "idPuesto": 2,
  "nombre": "Carlos Alberto Mendoza",
  "correo": "carlos.mendoza@aktunkan.com",
  "telefono": "55559999",
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:06:00.000Z",
  "anulado": false,
  "puesto": {
    "id": 2,
    "nombre": "Taquillero",
    "descripcion": "Atención y venta de tickets",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  },
  "permiso": [
    {
      "id": 10,
      "idUsuario": 2,
      "idModuloAccion": 1,
      "moduloAccion": {
        "id": 1,
        "idModulo": 1,
        "idAccion": 1,
        "modulo": { "id": 1, "nombre": "Puestos", "anulado": false },
        "accion": { "id": 1, "nombre": "Ver" }
      }
    }
  ]
}
```

---

## 3. Puestos (`/puestos`)

### 3.1 `POST /puestos` (Crear Puesto)
* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "nombre": "Guía de Recorrido",
  "descripcion": "Encargado de guiados dentro del parque"
}
```

* **Response (201 Created - JSON):**
```json
{
  "id": 3,
  "nombre": "Guía de Recorrido",
  "descripcion": "Encargado de guiados dentro del parque",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z"
}
```

---

### 3.2 `GET /puestos` (Listar Puestos)
* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Ver'`
* **Query Params (Opcional):** `?incluirAnulados=true`
* **Response (200 OK - JSON):**
```json
[
  {
    "id": 1,
    "nombre": "Administrador",
    "descripcion": "Acceso total al sistema",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  }
]
```

---

### 3.3 `GET /puestos/:id` (Obtener Puesto por ID)
* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 3,
  "nombre": "Guía de Recorrido",
  "descripcion": "Encargado de guiados dentro del parque",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z",
  "_count": {
    "usuarios": 0
  }
}
```

---

### 3.4 `PATCH /puestos/:id` (Actualizar Puesto)
* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Request Body (JSON - Campos opcionales):**
```json
{
  "nombre": "Guía Turístico Principal",
  "descripcion": "Encargado senior de guiados en el parque"
}
```

* **Response (200 OK - JSON):**
```json
{
  "id": 3,
  "nombre": "Guía Turístico Principal",
  "descripcion": "Encargado senior de guiados en el parque",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:07:00.000Z"
}
```

---

### 3.5 `PATCH /puestos/:id/activar` (Reactivar Puesto)
Reactiva un puesto anulado (`anulado: false`) bajo transacción atómica.

* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 3,
  "nombre": "Guía Turístico Principal",
  "descripcion": "Encargado senior de guiados en el parque",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:15:00.000Z"
}
```

---

### 3.6 `DELETE /puestos/:id` (Anular Puesto)
* **Permiso requerido:** `Módulo: 'Puestos'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 3,
  "nombre": "Guía Turístico Principal",
  "descripcion": "Encargado senior de guiados en el parque",
  "anulado": true,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:08:00.000Z"
}
```

---

## 4. Módulos (`/modulos`)

### 4.1 `POST /modulos` (Crear Módulo)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "nombre": "Tickets"
}
```

* **Response (201 Created - JSON):**
```json
{
  "id": 4,
  "nombre": "Tickets",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z"
}
```

---

### 4.2 `GET /modulos` (Listar Módulos)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Ver'`
* **Query Params (Opcionales):** `?incluirAnulados=true`, `?soloAsignables=true` (excluye los módulos de infraestructura; úsalo en la pantalla de asignación de permisos)
* **Response (200 OK - JSON):**
```json
[
  {
    "id": 1,
    "nombre": "Usuarios",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z",
    "moduloAcciones": [
      {
        "id": 1,
        "idModulo": 1,
        "idAccion": 1,
        "accion": { "id": 1, "nombre": "Ver" }
      }
    ]
  }
]
```

---

### 4.3 `GET /modulos/:id` (Obtener Módulo por ID)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 4,
  "nombre": "Tickets",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:03:35.000Z",
  "moduloAcciones": []
}
```

---

### 4.4 `PATCH /modulos/:id` (Actualizar Módulo)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Request Body (JSON):**
```json
{
  "nombre": "VentaTickets"
}
```

* **Response (200 OK - JSON):**
```json
{
  "id": 4,
  "nombre": "VentaTickets",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:09:00.000Z"
}
```

---

### 4.5 `PATCH /modulos/:id/activar` (Reactivar Módulo)
Reactiva un módulo anulado (`anulado: false`) bajo transacción atómica.

* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 4,
  "nombre": "VentaTickets",
  "anulado": false,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:15:00.000Z"
}
```

---

### 4.6 `DELETE /modulos/:id` (Anular Módulo)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 4,
  "nombre": "VentaTickets",
  "anulado": true,
  "fechaCreacion": "2026-07-24T14:03:35.000Z",
  "fechaActualizacion": "2026-07-24T14:10:00.000Z"
}
```

---

### 4.7 `GET /modulos/mis-modulos` (Menú del usuario autenticado)
Devuelve los módulos a los que el usuario de la sesión tiene acceso, con las acciones que efectivamente se le concedieron. Es lo que debe alimentar el menú del frontend.

* **Permiso requerido:** ninguno — basta un token válido. Cada usuario consulta su propio acceso.
* **Headers:** `Authorization: Bearer <token_jwt>`
* **Response (200 OK - JSON):** Un elemento por módulo (no por permiso), con `idModuloPadre` para poder anidar sub-módulos en el menú.
```json
[
  {
    "id": 7,
    "nombre": "Cajas",
    "esAsignable": true,
    "idModuloPadre": null,
    "moduloPadre": null,
    "acciones": ["Ver", "Crear", "Anular"]
  },
  {
    "id": 8,
    "nombre": "Gastos",
    "esAsignable": true,
    "idModuloPadre": 7,
    "moduloPadre": { "id": 7, "nombre": "Cajas" },
    "acciones": ["Ver", "Crear"]
  },
  {
    "id": 10,
    "nombre": "EmisionTickets",
    "esAsignable": true,
    "idModuloPadre": null,
    "moduloPadre": null,
    "acciones": ["Ver", "Crear", "Editar", "Anular"]
  }
]
```
> Se excluyen los módulos anulados. Este endpoint **no** exige permiso a propósito: si dependiera de uno, ese permiso tendría que asignarse a todos y bastaría quitarlo por error para dejar a un usuario sin menú.

---

## 5. Acciones (`/acciones`)

### 5.1 `POST /acciones` (Crear Acción)
* **Permiso requerido:** `Módulo: 'Acciones'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "nombre": "Exportar"
}
```

* **Response (201 Created - JSON):**
```json
{
  "id": 5,
  "nombre": "Exportar"
}
```

---

### 5.2 `GET /acciones` (Listar Acciones)
* **Permiso requerido:** `Módulo: 'Acciones'`, `Acción: 'Ver'`
* **Response (200 OK - JSON):**
```json
[
  { "id": 1, "nombre": "Ver" },
  { "id": 2, "nombre": "Crear" },
  { "id": 3, "nombre": "Editar" },
  { "id": 4, "nombre": "Anular" },
  { "id": 5, "nombre": "Exportar" }
]
```

---

### 5.3 `GET /acciones/:id` (Obtener Acción por ID)
* **Permiso requerido:** `Módulo: 'Acciones'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 5,
  "nombre": "Exportar"
}
```

---

### 5.4 `PATCH /acciones/:id` (Actualizar Acción)
* **Permiso requerido:** `Módulo: 'Acciones'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Request Body (JSON):**
```json
{
  "nombre": "ExportarPDF"
}
```

* **Response (200 OK - JSON):**
```json
{
  "id": 5,
  "nombre": "ExportarPDF"
}
```

---

### 5.5 `DELETE /acciones/:id` (Eliminar Acción)
* **Permiso requerido:** `Módulo: 'Acciones'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 5,
  "nombre": "ExportarPDF"
}
```

---

## 6. Módulo-Acciones (`/modulo-acciones`)

### 6.1 `POST /modulo-acciones` (Vincular Módulo con Acción)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Editar'`
* **Request Body (JSON):**
```json
{
  "idModulo": 1,
  "idAccion": 4
}
```

* **Response (201 Created - JSON):**
```json
{
  "id": 12,
  "idModulo": 1,
  "idAccion": 4,
  "modulo": {
    "id": 1,
    "nombre": "Usuarios",
    "anulado": false,
    "fechaCreacion": "2026-07-24T14:00:00.000Z",
    "fechaActualizacion": "2026-07-24T14:00:00.000Z"
  },
  "accion": {
    "id": 4,
    "nombre": "Anular"
  }
}
```

---

### 6.2 `GET /modulo-acciones` (Listar Asociaciones Módulo-Acción)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Ver'`
* **Response (200 OK - JSON):**
```json
[
  {
    "id": 12,
    "idModulo": 1,
    "idAccion": 4,
    "modulo": { "id": 1, "nombre": "Usuarios", "anulado": false },
    "accion": { "id": 4, "nombre": "Anular" }
  }
]
```

---

### 6.3 `GET /modulo-acciones/modulo/:idModulo` (Obtener Acciones por ID de Módulo)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Ver'`
* **Path Params:** `idModulo` (número entero)
* **Response (200 OK - JSON):**
```json
[
  {
    "id": 12,
    "idModulo": 1,
    "idAccion": 4,
    "accion": { "id": 4, "nombre": "Anular" }
  }
]
```

---

### 6.4 `GET /modulo-acciones/:id` (Obtener por ID)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 12,
  "idModulo": 1,
  "idAccion": 4,
  "modulo": { "id": 1, "nombre": "Usuarios", "anulado": false },
  "accion": { "id": 4, "nombre": "Anular" }
}
```

---

### 6.5 `DELETE /modulo-acciones/:id` (Eliminar Vinculación)
* **Permiso requerido:** `Módulo: 'Modulos'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 12,
  "idModulo": 1,
  "idAccion": 4
}
```

---

## 7. Bitácora y Auditoría (`/bitacora`)

### 7.1 `GET /bitacora` (Listar Bitácora de Actividades)
Obtiene los registros de auditoría ordenados descendentemente por fecha en huso horario **UTC-6**.

* **Permiso requerido:** `Módulo: 'Bitacora'`, `Acción: 'Ver'`
* **Query Params (Todos opcionales):**
  - `idUsuario` (número): Filtrar por ID de usuario ejecutor.
  - `modulo` (texto): Filtrar por módulo. **Coincide por `contains`, no por igualdad**: pedir `Tickets` devuelve también los de `EmisionTickets`.
    El campo lo escribe cada service como texto libre, **no es una llave foránea a `Modulo`** y sus valores no coinciden con esa tabla. Los que existen hoy son: `ActividadesParque`, `Auth`, `Cajas`, `Donaciones`, `EmisionTickets`, `Gastos`, `Modulos`, `Reportes`, `Tarifas`, `Tickets`, `TiposGasto`, `Usuarios`. No pueble un desplegable desde `GET /modulos`: perdería `Tickets` y `Auth`, y ofrecería módulos sin ningún registro.
  - `accion` (texto): Filtrar por tipo de acción. Hay 45 distintas; las de mayor volumen son `GENERAR_REPORTE`, `EXPORTAR_REPORTE`, `RESERVAR_FOLIOS_OFFLINE`, `ANULAR_TICKET` y `VALIDAR_TICKET`. Si algún día se expone este filtro en la interfaz, esos son los que valen la pena ofrecer; `CREAR_USUARIO` o `EDITAR_PUESTO` existen pero son marginales.
  - `fechaInicio` (ISO Date string): Filtrar desde fecha.
  - `fechaFin` (ISO Date string): Filtrar hasta fecha.
  - `limite` (número, defecto `100`, máx. `200`): Tamaño de la página.
  - `pagina` (número, defecto `1`).

* **Response (200 OK - JSON):** **paginado** — ver «Paginación de listados». El arreglo de abajo es el contenido de `datos`, dentro del sobre `{ datos, total, pagina, limite }`.
```json
[
  {
    "id": 15,
    "idUsuario": 1,
    "usuarioNombre": "Administrador General",
    "accion": "CREAR_USUARIO",
    "modulo": "Usuarios",
    "descripcion": "Se creo el nuevo usuario 'Carlos Mendoza' (carlos.mendoza@aktunkan.com) asignado al puesto 'Taquillero'.",
    "fecha": "2026-07-25T03:45:00.000Z",
    "usuario": {
      "id": 1,
      "nombre": "Administrador General",
      "correo": "admin@aktunkan.com",
      "puesto": {
        "id": 1,
        "nombre": "Administrador"
      }
    }
  },
  {
    "id": 14,
    "idUsuario": 2,
    "usuarioNombre": "Carlos Mendoza",
    "accion": "INICIO_SESION",
    "modulo": "Auth",
    "descripcion": "Inicio de sesión exitoso para el usuario 'Carlos Mendoza' (carlos.mendoza@aktunkan.com).",
    "fecha": "2026-07-25T03:40:12.000Z",
    "usuario": {
      "id": 2,
      "nombre": "Carlos Mendoza",
      "correo": "carlos.mendoza@aktunkan.com",
      "puesto": {
        "id": 2,
        "nombre": "Taquillero"
      }
    }
  }
]
```

---

### 7.2 `GET /bitacora/:id` (Obtener Registro de Bitácora por ID)
* **Permiso requerido:** `Módulo: 'Bitacora'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 15,
  "idUsuario": 1,
  "usuarioNombre": "Administrador General",
  "accion": "CREAR_USUARIO",
  "modulo": "Usuarios",
  "descripcion": "Se creo el nuevo usuario 'Carlos Mendoza' (carlos.mendoza@aktunkan.com) asignado al puesto 'Taquillero'.",
  "fecha": "2026-07-25T03:45:00.000Z",
  "usuario": {
    "id": 1,
    "nombre": "Administrador General",
    "correo": "admin@aktunkan.com",
    "puesto": {
      "id": 1,
      "nombre": "Administrador"
    }
  }
}
```

---

## 8. Cajas (`/cajas`)

Módulo de apertura y cierre de caja. Solo puede existir **una caja abierta a la vez en todo el sistema**. Ni la apertura ni el cierre se pueden editar una vez creados — solo se pueden **anular**.

### 8.1 `POST /cajas/apertura` (Abrir Caja)
* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "montoInicial": 500.00,
  "observaciones": "Fondo inicial de caja del turno matutino"
}
```
* **Response (201 Created - JSON):** Falla con `409 Conflict` si ya existe una caja abierta.
```json
{
  "id": 5,
  "idUsuario": 1,
  "montoInicial": "500.0000",
  "observaciones": "Fondo inicial de caja del turno matutino",
  "anulado": false,
  "fechaCreacion": "2026-08-13T14:00:00.000Z",
  "fechaActualizacion": "2026-08-13T14:00:00.000Z",
  "usuario": { "id": 1, "nombre": "Administrador General", "correo": "admin@aktunkan.com" },
  "estado": { "id": 1, "nombre": "Abierta" },
  "cierresCaja": [],
  "gastos": []
}
```

---

### 8.2 `GET /cajas` (Listar Aperturas)
* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Ver'`
* **Query Params (Opcionales):** `?estado=Abierta`, `?fechaInicio=`, `?fechaFin=`, `?incluirAnulados=true`, `?pagina=1`, `?limite=50` (máx. 200)
* **Response (200 OK - JSON):** **paginado** — sobre `{ datos, total, pagina, limite }` donde `datos` son objetos con la misma forma que 8.1. Ver «Paginación de listados».

---

### 8.3 `GET /cajas/actual` (Obtener Caja Abierta Actual)
* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Ver'`
* **Response (200 OK - JSON):** Objeto con la misma forma que 8.1, o `null` si no hay ninguna caja abierta.

---

### 8.4 `GET /cajas/:id` (Detalle de una Apertura)
* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):** Igual que 8.1, incluyendo `cierresCaja` y `gastos` asociados.

---

### 8.5 `GET /cajas/:id/arqueo` (Previsualizar Arqueo)
Calcula el monto esperado sin cerrar la caja, para revisión previa.

* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "idApertura": 5,
  "montoInicial": 500,
  "ventasEfectivo": 1250,
  "totalGastos": 150,
  "montoEsperado": 1600
}
```

---

### 8.6 `POST /cajas/:id/cierre` (Cerrar Caja)
Calcula el arqueo, crea el registro de cierre (no editable) y marca la caja como `'Cerrada'`.

* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Crear'`
* **Path Params:** `id` (número entero, ID de la apertura)
* **Request Body (JSON):**
```json
{
  "montoContado": 1590.00,
  "observaciones": "Faltante detectado, se revisará con el cajero"
}
```
* **Response (201 Created - JSON):** Falla con `400 Bad Request` si la caja ya está cerrada o anulada.
```json
{
  "apertura": {
    "id": 5,
    "estado": { "id": 2, "nombre": "Cerrada" }
  },
  "cierre": {
    "id": 3,
    "idApertura": 5,
    "fechaCierre": "2026-08-13T20:00:00.000Z",
    "montoFinal": "1590.0000",
    "montoEsperado": "1600.0000",
    "diferencia": "-10.0000",
    "observaciones": "Faltante detectado, se revisará con el cajero",
    "anulado": false
  }
}
```

---

### 8.7 `PATCH /cajas/:id/cierre/anular` (Anular Cierre y Reabrir Caja)
Anula el cierre vigente y revierte el estado de la caja a `'Abierta'`, para corregir un cierre hecho por error.

* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero, ID de la apertura)
* **Response (200 OK - JSON):** Falla con `400 Bad Request` si la caja no tiene un cierre vigente, y con `409 Conflict` si ya existe otra caja abierta (reabrir dejaría dos cajas abiertas).
```json
{
  "id": 5,
  "estado": { "id": 1, "nombre": "Abierta" }
}
```

---

### 8.8 `DELETE /cajas/:id` (Anular Apertura)
Anula una apertura hecha por error. Solo permitido mientras la caja sigue `'Abierta'`.

* **Permiso requerido:** `Módulo: 'Cajas'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):** Falla con `400 Bad Request` si la caja ya está `'Cerrada'` (primero debe anularse el cierre).
```json
{
  "id": 5,
  "anulado": true
}
```

---

## 9. Gastos (`/gastos`)

Registra gastos contra la **caja abierta actual** — el cliente no envía `idAperturaCaja`, se asocia automáticamente. Los gastos vigentes se descuentan en el arqueo de `Cajas`.

### 9.1 `POST /gastos` (Registrar Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "idTipoGasto": 1,
  "descripcion": "Compra de insumos de limpieza",
  "monto": 150.00
}
```
* **Response (201 Created - JSON):** Falla con `400 Bad Request` si no hay caja abierta.
```json
{
  "id": 10,
  "idTipoGasto": 1,
  "idAperturaCaja": 5,
  "idUsuario": 1,
  "descripcion": "Compra de insumos de limpieza",
  "monto": "150.0000",
  "anulado": false,
  "fechaCreacion": "2026-08-13T15:00:00.000Z",
  "fechaActualizacion": "2026-08-13T15:00:00.000Z",
  "tipoGasto": { "id": 1, "nombre": "Insumos", "anulado": false }
}
```

---

### 9.2 `GET /gastos` (Listar Gastos)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Ver'`
* **Query Params (Opcionales):** `?idAperturaCaja=5`, `?incluirAnulados=true`
* **Response (200 OK - JSON):** Arreglo de objetos con la misma forma que 9.1.

---

### 9.3 `GET /gastos/:id` (Obtener Gasto por ID)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Ver'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):** Igual que 9.1.

---

### 9.4 `PATCH /gastos/:id` (Editar Gasto)
Solo permitido mientras la caja del gasto sigue **abierta**. El campo `anulado` no se acepta: para dar de baja se usa `DELETE /gastos/:id`.

* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Editar'`
* **Path Params:** `id` (número entero)
* **Request Body (JSON - Campos opcionales):**
```json
{
  "descripcion": "Compra de insumos de limpieza (corregido)",
  "monto": 160.00
}
```
* **Response (200 OK - JSON):** Igual que 9.1. Falla con `400 Bad Request` si la caja del gasto ya fue cerrada.

---

### 9.5 `DELETE /gastos/:id` (Anular Gasto)
Solo permitido mientras la caja del gasto sigue **abierta** (`400` en caso contrario).

* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Anular'`
* **Path Params:** `id` (número entero)
* **Response (200 OK - JSON):**
```json
{
  "id": 10,
  "anulado": true
}
```

---

## 10. Tipos de Gasto (`/tipos-gasto`)

Catálogo usado por `Gastos`. Sigue el mismo patrón CRUD que `Puestos` (crear, listar, obtener, editar, activar, anular).

### 10.1 `POST /tipos-gasto` (Crear Tipo de Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{ "nombre": "Insumos" }
```
* **Response (201 Created - JSON):**
```json
{ "id": 1, "nombre": "Insumos", "anulado": false }
```

---

### 10.2 `GET /tipos-gasto` (Listar Tipos de Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Ver'`
* **Query Params (Opcional):** `?incluirAnulados=true`
* **Response (200 OK - JSON):**
```json
[{ "id": 1, "nombre": "Insumos", "anulado": false }]
```

---

### 10.3 `GET /tipos-gasto/:id` (Obtener Tipo de Gasto por ID)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Ver'`
* **Response (200 OK - JSON):**
```json
{ "id": 1, "nombre": "Insumos", "anulado": false, "_count": { "gastos": 3 } }
```

---

### 10.4 `PATCH /tipos-gasto/:id` (Actualizar Tipo de Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Editar'`
* **Request Body (JSON):**
```json
{ "nombre": "Insumos de limpieza" }
```

---

### 10.5 `PATCH /tipos-gasto/:id/activar` (Reactivar Tipo de Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Editar'`

---

### 10.6 `DELETE /tipos-gasto/:id` (Anular Tipo de Gasto)
* **Permiso requerido:** `Módulo: 'Gastos'`, `Acción: 'Anular'`
* **Response (200 OK - JSON):**
```json
{ "id": 1, "nombre": "Insumos de limpieza", "anulado": true }
```

---

## 11. Tickets (`/tickets`)

Emisión de boletos del parque. Reglas que aplica el servidor:

- **Requiere caja abierta.** Sin caja abierta no se puede vender (`400`).
- **El cliente nunca envía precios.** El servidor resuelve la tarifa vigente por atracción + origen + categoría. El payload solo lleva cantidades e identificadores.
- **El folio lo genera el servidor**: correlativo, único, y siempre **texto** (`TCK-2026-000123`). La serie es alfanumérica y configurable con `TICKET_SERIE`.
- **Guía sin carnet ⇒ dos tickets.** Se emiten dos registros independientes (visitante y guía) unidos por `idGrupoEmision`, cada uno con su folio, QR, monto y forma de pago. Si el guía tiene carnet, va incluido sin costo y su número de carnet **no** se expone en el pase.
- `nino_menor` siempre Q0. `centro_educativo` no está disponible para origen extranjero. El país es obligatorio si el origen es extranjero.

### 11.1 `POST /tickets/emitir` (Emitir Ticket)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{
  "nombreGrupo": "Familia Rodríguez",
  "idAtraccion": 1,
  "idOrigen": 1,
  "idPais": null,
  "idTipoRecorrido": 1,
  "cantidades": [
    { "idTipoVisitante": 1, "cantidad": 2 },
    { "idTipoVisitante": 2, "cantidad": 3 }
  ],
  "idOpcionPago": 1,
  "notas": "Grupo con reserva previa",
  "guia": {
    "modo": "nuevo",
    "nombre": "Pedro Ak'abal",
    "tieneCarnet": false,
    "idOpcionPagoGuia": 2
  }
}
```
> `guia` es opcional. Con `modo: "existente"` se envía `idGuia`; con `modo: "nuevo"` se envían `nombre`, `tieneCarnet` y `numeroCarnet` (obligatorio si `tieneCarnet: true`). Un guía nuevo queda registrado en el catálogo.

* **Response (201 Created - JSON):**
```json
{
  "idGrupoEmision": 12,
  "montoVisitantes": "70",
  "montoGuia": "15",
  "montoTotalGeneral": "85",
  "tickets": [
    {
      "id": 31,
      "numeroTicket": "TCK-2026-000045",
      "tipoTicket": "VISITANTE",
      "nombre": "Familia Rodríguez",
      "cantidadPersonas": 5,
      "montoTotal": "70.0000",
      "qrFirma": "9f2a…",
      "qr": "{\"numeroTicket\":\"TCK-2026-000045\",\"firma\":\"9f2a…\"}",
      "atraccion": { "id": 1, "codigo": "cuevas", "nombre": "Cuevas Actun Kan" },
      "origen": { "id": 1, "codigo": "nacional", "nombre": "Nacional" },
      "pais": null,
      "visitantePorTickets": [
        { "idTipoVisitante": 1, "cantidad": 2, "precioUnitario": "20.0000", "subtotal": "40.0000" },
        { "idTipoVisitante": 2, "cantidad": 3, "precioUnitario": "10.0000", "subtotal": "30.0000" }
      ],
      "ticketPagos": [{ "idOpcionPago": 1, "monto": "70.0000" }]
    },
    {
      "id": 32,
      "numeroTicket": "TCK-2026-000046",
      "tipoTicket": "GUIA",
      "cantidadPersonas": 1,
      "montoTotal": "15.0000"
    }
  ]
}
```
> El campo `qr` es exactamente lo que debe codificarse en el código QR impreso. Los datos legibles del pase (nombre, personas, total) los arma el frontend con esta misma respuesta.

---

### 11.2 `GET /tickets` (Historial con filtros y métricas)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Ver'`
* **Query Params (todos opcionales):** `buscar` (nombre, folio o guía), `idAtraccion`, `idOpcionPago`, `idOrigen`, `idPais`, `fechaInicio`, `fechaFin`, `incluirAnulados=true`, `pagina` (default 1), `limite` (default 50, máx. 200)
* **Response (200 OK - JSON):** Las métricas se calculan en el servidor sobre el filtro aplicado, no solo sobre la página.
```json
{
  "datos": [ /* tickets con la misma forma que 11.1 */ ],
  "total": 128,
  "pagina": 1,
  "limite": 50,
  "metricas": {
    "totalTickets": 128,
    "totalPersonas": 412,
    "montoRecaudado": "8450.0000"
  }
}
```

---

### 11.3 `POST /tickets/validar` (Control de acceso en taquilla)
Verifica la firma del QR y sella el primer uso. Cada intento, aceptado o rechazado, queda en Bitácora.

* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Editar'`
* **Request Body (JSON):** el contenido decodificado del QR.
```json
{ "numeroTicket": "TCK-2026-000045", "firma": "9f2a…" }
```
* **Respuestas:**
  - `200` — ingreso autorizado: `{ "valido": true, "mensaje": "Ingreso autorizado.", "ticket": { … } }`
  - `401` — firma inválida o alterada
  - `404` — el ticket no existe
  - `409` — ticket anulado, o **ya utilizado** (incluye la fecha de uso)

---

### 11.4 `GET /tickets/:id` y `DELETE /tickets/:id`
* **Ver:** `Módulo: 'EmisionTickets'`, `Acción: 'Ver'`. Devuelve el ticket con su `qr` listo para imprimir.
* **Anular:** `Módulo: 'EmisionTickets'`, `Acción: 'Anular'`. Baja lógica del ticket **y de sus pagos**, para que el ingreso salga del arqueo de caja. Solo con la caja de origen abierta.

---

## 12. Tarifas (`/tarifas`)

Editar un precio **no sobrescribe** la fila: cierra la vigencia de la tarifa actual y crea una nueva. Los tickets ya vendidos conservan el precio con el que se emitieron (`VisitantePorTicket.precioUnitario`).

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/tarifas` | `EmisionTickets` / `Ver` | Tarifas vigentes (atracción + origen + categoría). Arreglo plano, **no** paginado |
| GET | `/tarifas/historico` | `EmisionTickets` / `Ver` | Historial **paginado** (`{ datos, total, pagina, limite }`). Filtros: `idAtraccion`, `idOrigen`, `pagina`, `limite` (máx. 200) |
| GET | `/tarifas/guia` | `EmisionTickets` / `Ver` | Tarifa vigente del ticket de guía sin carnet |
| PATCH | `/tarifas` | `EmisionTickets` / `Editar` | `{ idAtraccion, idOrigen, idTipoVisitante, precio }` |
| PATCH | `/tarifas/guia` | `EmisionTickets` / `Editar` | `{ precio }` |

Validación: se rechaza precio ≤ 0 salvo en la categoría `nino_menor`, la única que admite Q0.

---

## 13. Catálogos de Tickets — `GET /tickets/catalogos`

Atracciones, orígenes, países, tipos y formas de pago **no tienen CRUD propio**: son datos de configuración que solo alimentan el formulario de emisión. Se sirven todos en **una sola llamada** y se administran por seed (`prisma/seed-tickets.ts`).

* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Ver'`
* **Response (200 OK - JSON):**
```json
{
  "atracciones": [{ "id": 1, "codigo": "cuevas", "nombre": "Cuevas Actun Kan" }],
  "origenes": [
    { "id": 1, "codigo": "nacional", "nombre": "Nacional" },
    { "id": 2, "codigo": "extranjero", "nombre": "Extranjero" }
  ],
  "paises": [{ "id": 59, "nombre": "España", "codigoIso": "ESP" }],
  "tiposVisitante": [
    { "id": 1, "codigo": "adulto", "nombre": "Adulto" },
    { "id": 2, "codigo": "nino", "nombre": "Niño (7 años o más)" },
    { "id": 3, "codigo": "nino_menor", "nombre": "Niño menor de 7 años" },
    { "id": 4, "codigo": "centro_educativo", "nombre": "Centro educativo (nivel primario)" }
  ],
  "tiposRecorrido": [{ "id": 1, "codigo": "corto", "nombre": "Recorrido corto (~45 minutos)" }],
  "opcionesPago": [
    { "id": 1, "nombre": "Efectivo", "esEfectivo": true },
    { "id": 2, "nombre": "Tarjeta", "esEfectivo": false }
  ],
  "guias": [{ "id": 7, "nombre": "Juan Tecún", "tieneCarnet": true }],
  "tarifas": [
    { "idAtraccion": 1, "idOrigen": 1, "idTipoVisitante": 1, "precio": "20.0000" }
  ],
  "precioTicketGuia": "15.0000"
}
```

Notas de uso:
- **`codigo` es la clave estable** de las reglas de negocio (`nino_menor` siempre Q0, `centro_educativo` no aplica a extranjero). `nombre` es solo presentación.
- **`tarifas` es únicamente para que el formulario muestre el total al usuario.** El servidor vuelve a resolver el precio al emitir, así que un cliente manipulado no puede alterar lo que se cobra.
- **Guatemala viene en `paises`**; excluirla del selector de extranjeros es cosa del frontend.
- Los **guías nuevos se crean dentro de `POST /tickets/emitir`** (bloque `guia.modo: "nuevo"`), no por un endpoint aparte.
- Para **editar precios** sí hay endpoints: ver sección 12 (`/tarifas`).
- `/tipos-gasto` sigue existiendo aparte porque pertenece al sub-módulo `Gastos` de `Cajas`, no a la emisión de tickets.





---
## 18. Venta offline (`/tickets/lotes-offline`, `/tickets/emitir-offline`)

Permite vender tickets **sin conexión a internet**, entregando al visitante un pase con QR **válido desde el momento de la venta**.

La idea es simple: el servidor entrega **folios pre-firmados** mientras hay red; el dispositivo los consume después, sin ella; al reconectar sube la cola y cada folio se convierte en un ticket real.

Diseño completo en `ESPECIFICACION_OFFLINE.md`.

### Conceptos

| Término | Qué es |
|---|---|
| **Folio reservado** | Un número de ticket con su firma HMAC, generado **antes** de que exista la venta |
| **Lote** | Un bloque de folios, atado a un usuario, un dispositivo y **la caja abierta al reservarlo** |

Estados del folio:

```
                    ┌─── conciliar ──────────> NO_UTILIZADO
RESERVADO ──────────┼─── invalidar el lote ──> INVALIDADO
                    └─── emitir-offline ─────> EMITIDO ──validar──> EMITIDO + fechaUso
```

> **Solo un folio `EMITIDO` autoriza el ingreso.** Un folio reservado tiene firma criptográficamente válida pero no corresponde a ninguna venta. Como vive en su propia tabla y no en `Ticket`, **`POST /tickets/validar` responde `404`** por él, idéntico a un folio inexistente — sin mensaje que revele que existe, para no confirmarle a nadie que el rango del bloque es real.

**Permisos:** todo se gobierna con `EmisionTickets`, igual que el resto de la emisión.

**Solo efectivo.** Sin conexión no hay pasarela, así que no hay cobro con tarjeta: cualquier otra forma de pago se rechaza al subir.

---

### 18.1 `POST /tickets/lotes-offline` (Reservar folios)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Crear'`
* **Request Body (JSON):**
```json
{ "cantidad": 100, "idDispositivo": "b3f1c2d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d" }
```

| Campo | Reglas |
|---|---|
| `cantidad` | Entero de 1 a 200 |
| `idDispositivo` | UUID persistente que genera el navegador; máximo 64 caracteres |

* **Exige caja abierta** (`400` si no hay). La caja **no la envía el cliente**: se toma la abierta actual.

* **Response (201 Created - JSON):**
```json
{
  "idLote": 7,
  "idAperturaCaja": 12,
  "idUsuario": 3,
  "idDispositivo": "b3f1c2d4-…",
  "estado": "ACTIVO",
  "fechaCreacion": "2026-08-20T13:00:00.000Z",
  "expiraEn": "2026-08-21T06:00:00.000Z",
  "expirado": false,
  "folios": [
    {
      "numeroTicket": "TCK-2026-000101",
      "firma": "9f2a7c…",
      "qr": "{\"numeroTicket\":\"TCK-2026-000101\",\"firma\":\"9f2a7c…\"}"
    }
  ]
}
```

> **El campo `qr` viene armado por el servidor**, en el mismo formato exacto que la emisión online. No lo reconstruya en el frontend: un cambio futuro de formato rompería los pases offline en silencio y el problema aparecería recién en la puerta de la cueva.

* **Errores:**

```json
{ "codigo": "LOTE_ACTIVO_EXISTENTE", "idLote": 7 }
```
`409` si ese dispositivo ya tiene un lote activo. Concílielo primero, o recupérelo con 18.2.

> **Pida lotes chicos, no el máximo por costumbre.** Cada folio que quede sin vender consume un número del correlativo y deja un hueco permanente en la numeración. Lotes chicos también limitan el daño si se pierde el dispositivo.
>
> Un lote **vencido** deja de bloquear la reserva del día siguiente, pero **sus folios siguen en `RESERVADO`**: si quedaron ventas sin subir, todavía pueden subirse.

---

### 18.2 `GET /tickets/lotes-offline/activo` (Recuperar el lote)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Ver'`
* **Query Param:** `idDispositivo` (obligatorio)

Para cuando se reinstala la aplicación o se borra el almacenamiento local. Sin esto los folios quedan inutilizables hasta que expiren y el taquillero no puede vender.

* **Response (200 OK - JSON):**
```json
{ "hayLoteActivo": true, "lote": { "…": "misma forma que 18.1" } }
```
o `{ "hayLoteActivo": false, "lote": null }`.

Solo devuelve los folios que siguen en `RESERVADO`.

> **Exige que coincidan usuario y dispositivo.** Este endpoint vuelve a exponer folios pre-firmados; desde otra sesión responde `hayLoteActivo: false`, no los entrega.

---

### 18.3 `POST /tickets/emitir-offline` (Subir la cola de ventas)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Crear'`
* **Request Body (JSON):** hasta **50 ventas** por llamada.
```json
{
  "idLote": 7,
  "ventas": [
    {
      "idLocal": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "numeroTicket": "TCK-2026-000101",
      "numeroTicketGuia": "TCK-2026-000102",
      "fechaEmision": "2026-08-20T14:32:11.000Z",
      "montoCobrado": "85.00",

      "nombreGrupo": "Familia Rodríguez",
      "idAtraccion": 1,
      "idOrigen": 1,
      "idPais": null,
      "idTipoRecorrido": 1,
      "cantidades": [{ "idTipoVisitante": 1, "cantidad": 2 }],
      "idOpcionPago": 1,
      "notas": "Grupo con reserva previa",
      "guia": { "modo": "nuevo", "nombre": "Pedro Ak'abal", "tieneCarnet": false }
    }
  ]
}
```

Todo lo que va después de `montoCobrado` es el payload de `POST /tickets/emitir` sin cambios.

| Campo | Notas |
|---|---|
| `idLocal` | **UUID de 36 caracteres**, generado por el dispositivo. Es la clave de idempotencia |
| `numeroTicket` | Folio reservado que el dispositivo ya imprimió |
| `numeroTicketGuia` | Segundo folio, solo si la venta lleva guía sin carnet |
| `fechaEmision` | ISO 8601. Momento real de la venta |
| `montoCobrado` | **Texto**, no número: evita perder centavos en el punto flotante de JSON |

* **Response (200 OK - JSON):** éxito parcial. **Nunca un `4xx` para el lote completo** si al menos un ítem es válido — el resto corresponde a dinero que ya entró al cajón.
```json
{
  "procesadas": 2,
  "resultados": [
    { "idLocal": "f47ac10b-…", "estado": "CREADO", "discrepancia": null, "ticket": { "…": "TicketBackend" } },
    { "idLocal": "a91bd22c-…", "estado": "DUPLICADO_IGNORADO", "ticket": { "…": "…" } },
    { "idLocal": "c02ef88a-…", "estado": "RECHAZADO", "codigo": "FOLIO_YA_EMITIDO", "mensaje": "…" }
  ]
}
```

**Códigos de rechazo:**

| Código | Significa |
|---|---|
| `FOLIO_NO_RESERVADO` | El folio no existe, o ya no está disponible |
| `FOLIO_YA_EMITIDO` | **El dispositivo gastó dos veces el mismo folio**: hay una venta cobrada que se va a perder. Hay que investigarla |
| `FOLIO_DE_OTRO_LOTE` | El folio pertenece a otro lote |
| `LOTE_INVALIDADO` | El lote se invalidó; ninguna venta suya puede subirse |
| `PAGO_NO_EFECTIVO` | Offline solo se vende en efectivo |
| `CATALOGO_INVALIDO` | Datos de la venta inválidos (atracción, país, categoría…) |

> El resultado **por ítem** es lo que le permite al frontend distinguir *"no hubo red, reintento"* de *"el servidor lo rechazó, aviso al taquillero y no reintento"*. Sin esa distinción, la cola reintenta para siempre una venta que nunca va a entrar.

#### Reglas que aplica el servidor

1. **Idempotencia.** Un `idLocal` ya registrado devuelve `DUPLICADO_IGNORADO` sin crear nada. Es lo que permite reintentar tras un timeout ambiguo. *(Garantizado por un índice único; ver 18.7.)*
2. **La caja es la del lote**, no la que esté abierta al subir: la venta ocurrió en aquel turno y ahí tiene que cuadrar.
3. **La fecha del dispositivo se acota** al rango `[creación del lote, ahora]`. Viene del reloj del aparato y no es confiable; un reloj mal puesto mandaría la venta al arqueo de otro día.
4. **El precio se recalcula con la tarifa vigente en `fechaEmision`**, no con la de hoy. Una venta de ayer se recalcula con el precio de ayer.
5. **Un guía nuevo repetido se reutiliza.** Offline es normal que el mismo guía acompañe a varios grupos del turno: la primera venta lo crea y las demás lo reutilizan. *(La emisión online sigue rechazando nombres repetidos con `409`, porque ahí el taquillero puede corregir en el momento.)*
6. **Cada venta va en su propia transacción**: una con datos malos no aborta las otras 49.

#### Discrepancia de monto

Si lo cobrado difiere de lo recalculado, la venta **se registra igual**:

```json
"discrepancia": { "montoCobrado": "30", "montoRecalculado": "40", "diferencia": "-10" }
```

> **No se rechaza por discrepancia.** El visitante ya pagó y ya entró; rechazar dejaría dinero en la caja sin ticket que lo respalde, que es peor. El `TicketPago` se crea por **lo cobrado** —que es lo que hay en el cajón— y la diferencia queda en `Ticket.montoRecalculado` y en el arqueo (sección 8.5), visible solo para un supervisor.

---

### 18.4 `POST /tickets/lotes-offline/:id/conciliar` (Cerrar el lote)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Crear'`
* **Request Body (JSON, opcional):** el dispositivo declara lo que hizo, como contraste.
```json
{
  "foliosUtilizados": ["TCK-2026-000101", "TCK-2026-000102"],
  "foliosNoUtilizados": ["TCK-2026-000103"]
}
```
* **Response (200 OK - JSON):**
```json
{
  "idLote": 7,
  "estado": "CONCILIADO",
  "emitidos": 12,
  "noUtilizados": 88,
  "advertencias": [
    { "numeroTicket": "TCK-2026-000140", "detalle": "Declarado utilizado, sin ticket registrado" }
  ]
}
```

Todo folio que siga en `RESERVADO` pasa a `NO_UTILIZADO`, para que la auditoría no vea huecos inexplicados en la secuencia.

> **Un folio declarado vendido del que el servidor no tiene ticket sale como advertencia, no como error.** Significa una venta que se perdió (almacenamiento corrupto, cola borrada) y hay que investigarla, pero bloquear la conciliación dejaría la caja sin poder cerrarse.

* Falla con `400` si el lote ya estaba conciliado o invalidado. **Conciliar es requisito para cerrar la caja** (ver 8.6).

---

### 18.5 `DELETE /tickets/lotes-offline/:id` (Invalidar lote)
* **Permiso requerido:** `Módulo: 'EmisionTickets'`, `Acción: 'Anular'`
* **Response (200 OK - JSON):**
```json
{ "idLote": 7, "estado": "INVALIDADO", "foliosInvalidados": 88 }
```

Para dispositivo perdido o robado. Los folios en `RESERVADO` pasan a `INVALIDADO` y las subidas posteriores contra ese lote se rechazan. **Los folios ya emitidos no se tocan: esas ventas existen.**

> **Destruye las ventas offline que todavía no se hubieran subido.** Ese dinero quedaría cobrado sin ticket. Usar solo cuando el dispositivo no va a volver.

---

### 18.6 Un usuario dado de baja conserva el derecho a sincronizar

Si a un taquillero lo dan de baja **mientras su dispositivo está sin conexión**, sus ventas ya cobradas quedarían atrapadas: el guard lo rechazaría con `401` al reconectar, y la caja quedaría con dinero que ningún ticket respalda.

**Baja no es repudio de lo actuado.** Las ventas ocurrieron mientras la sesión era legítima; impedir que se registren no las deshace, solo las esconde.

**Qué puede hacer un usuario anulado:**

| Endpoint | Por qué |
|---|---|
| `POST /auth/refresh` | Sin token de acceso vigente no puede llamar a nada más |
| `POST /tickets/emitir-offline` | Es el acto de liquidar lo ya vendido |
| `POST /tickets/lotes-offline/:id/conciliar` | Cerrar el lote para que la caja pueda cerrarse |

Todo lo demás sigue devolviendo `401`. En particular **no** puede reservar folios nuevos ni recuperar folios pre-firmados: eso sería seguir operando, no liquidar.

**Cómo se hace cumplir:**

1. El derecho **está atado a que haya algo que liquidar**: solo se renueva la sesión si el usuario tiene un lote `ACTIVO` y sin vencer. Sin eso, la baja es total y `/auth/refresh` responde `401`.
2. El token de acceso que recibe viene marcado con **`soloSincronizacion: true`** y el guard lo **rechaza en cualquier otro handler**, incluso si el usuario volviera a estar activo. Sin esto, refrescar tras la baja devolvería acceso completo y la baja no serviría de nada.
3. Cada renovación queda en Bitácora como **`REFRESH_USUARIO_ANULADO`**, indicando qué lote la justifica.

La respuesta del refresh lo anuncia, para que el frontend pueda mostrar solo la pantalla de sincronización:

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "solo_sincronizacion": true,
  "aviso": "Su usuario fue deshabilitado. Esta sesión solo permite subir y conciliar las ventas offline pendientes; el resto del sistema no está disponible."
}
```



