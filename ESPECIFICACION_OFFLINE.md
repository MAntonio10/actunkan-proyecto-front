# Especificación backend — Emisión de tickets offline

> **Ya implementado. La autoridad es `DOCUMENTACION_ENDPOINTS.md` § 18**, que documenta el contrato
> tal como quedó construido. Este documento se conserva porque explica el *porqué* de cada regla
> —qué falla si se quita— pero donde ambos difieran, manda la sección 18.
>
> Diferencias conocidas respecto de lo que se especificó acá:
> - Se agregó el rechazo `FOLIO_YA_EMITIDO` (el dispositivo gastó dos veces el mismo folio).
> - La reserva devuelve `expirado`, y un lote vencido **no** bloquea reservar el siguiente; sus
>   folios siguen en `RESERVADO` y las ventas pendientes todavía pueden subirse.
> - `fechaUsoOffline` **no existe** y no se implementó a propósito: subir la venta y validar el pase
>   son actos distintos. `POST /tickets/validar` verifica la firma, rechaza reingresos con `409` y
>   deja rastro en Bitácora; aceptar una fecha de uso enviada por el dispositivo saltearía todo eso.
>   El frontend sella el ingreso con esa segunda llamada al reconectar (§ 8.1).
> - **El `ValidationPipe` del backend usa `forbidNonWhitelisted`.** Un campo de más en el payload
>   devuelve `400` y tumba la tanda entera. No agregue campos a `VentaOffline` sin que estén en 18.3.
> - Se agregó la sesión de solo sincronización para usuarios dados de baja (§ 18.6).
> - El vencimiento de un lote ya no traba nada: el backend concilia solo los lotes vencidos, tanto al
>   reservar como al cerrar la caja. Un lote vigente sigue bloqueando el cierre con `409`, que es lo
>   correcto — puede haber un dispositivo vendiendo contra esa caja.

Contrato que debe implementar el backend para que la taquilla del Parque Regional Municipal
Actún Kan pueda vender tickets sin conexión a internet, entregando al visitante un pase con QR
**válido desde el momento de la venta**.

Documento dirigido a quien implementa el backend. El frontend se construye contra este contrato.

Complementa a `DOCUMENTACION_ENDPOINTS.md`; no lo reemplaza. Las secciones citadas (`11. Tickets`,
`12. Tarifas`, `8. Cajas`) son las de ese documento.

---

## 0. Verificación previa — bloqueante

Todo este diseño depende de una sola suposición:

> **La firma del QR se calcula únicamente sobre `numeroTicket`.**
> `firma = HMAC-SHA256(SECRETO_QR, numeroTicket)`

Es lo que sugiere `POST /tickets/validar`, que recibe solo `{ numeroTicket, firma }`
(`DOCUMENTACION_ENDPOINTS.md` § 11.3). Si la firma incluyera monto, fecha, cantidad de personas o
cualquier dato de la venta, **no se pueden pre-firmar folios** y el modelo entero cambia.

Revisar la implementación actual antes de escribir código. Si resulta que la firma cubre más
campos, hay dos salidas: reducir la firma a `numeroTicket` (el ticket ya se valida contra la base
de datos, la firma solo prueba que el folio salió del sistema), o abandonar el pre-firmado.

---

## 1. Concepto

Un **folio reservado** es un número de ticket con su firma, generado por el servidor *antes* de que
exista la venta. El servidor lo entrega al dispositivo de taquilla mientras hay conexión. El
dispositivo lo consume después, sin red.

Un **lote** agrupa folios reservados y queda atado a un usuario, un dispositivo y una caja abierta.

Ciclo de vida:

```
                    ┌─── conciliar ──────────> NO_UTILIZADO
                    │
RESERVADO ──────────┼─── expiración ─────────> NO_UTILIZADO
                    │
                    ├─── DELETE del lote ────> INVALIDADO
                    │
                    └─── emitir-offline ─────> EMITIDO ──validar──> EMITIDO + fechaUso
```

**Solo un folio `EMITIDO` autoriza el ingreso.** Un folio `RESERVADO` tiene firma criptográficamente
válida pero no corresponde a ninguna venta: si `/tickets/validar` lo aceptara, sería una entrada
gratis. Ver § 7.

---

## 2. Modelo de datos

### 2.1 Tabla nueva: `LoteOffline`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | int PK | |
| `idUsuario` | int FK | Quien reservó el lote |
| `idAperturaCaja` | int FK | Caja abierta al momento de reservar |
| `idDispositivo` | string | UUID persistente que genera el navegador |
| `estado` | enum | `ACTIVO` \| `CONCILIADO` \| `INVALIDADO` |
| `fechaCreacion` | timestamp | |
| `expiraEn` | timestamp | Ver § 3 |
| `fechaConciliacion` | timestamp? | |

### 2.2 Tabla nueva: `FolioReservado`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | int PK | |
| `idLote` | int FK | |
| `numeroTicket` | string UNIQUE | |
| `firma` | string | |
| `estado` | enum | `RESERVADO` \| `EMITIDO` \| `NO_UTILIZADO` \| `INVALIDADO` |
| `idTicket` | int FK? | Se llena al emitir |

> **Tabla aparte, no filas de `Ticket` en estado reservado.** Pre-crear filas en `Ticket` obligaría a
> filtrarlas en `GET /tickets`, en el arqueo, en las métricas y en cualquier consulta futura. Un
> `WHERE` olvidado en un solo sitio mete folios fantasma en un reporte de ingresos. La tabla
> separada no toca ninguna consulta existente.

### 2.3 Campos nuevos en `Ticket`

| Campo | Tipo | Notas |
|---|---|---|
| `idLocal` | uuid? **UNIQUE** | Clave de idempotencia. Null en ventas online |
| `idLoteOffline` | int FK? | |
| `fechaEmisionOffline` | timestamp? | Momento real de la venta, distinto de `fechaCreacion` |
| `montoRecalculado` | decimal? | Solo si difiere de lo cobrado (§ 5, regla 8) |
| `origenOffline` | boolean | Default `false` |

El índice único sobre `idLocal` es lo que hace segura la reintentabilidad. No es opcional.

### 2.4 Secuencia de folios

Reservar 100 folios consume 100 números de la secuencia global. Las ventas online que ocurran
mientras tanto toman los números siguientes al bloque.

**La reserva y la emisión online deben tomar números del mismo contador atómico.** Es el error
clásico de este diseño: dos caminos leyendo `MAX(numeroTicket)` por separado generan folios
duplicados bajo concurrencia. Usar una secuencia de la base de datos o un `SELECT … FOR UPDATE`
sobre una fila contador. La unicidad debe verificarse contra `Ticket` y `FolioReservado` a la vez.

---

## 3. `POST /tickets/lotes-offline` — Reservar folios

Permiso: `EmisionTickets` / `Crear`

**Request**
```json
{ "cantidad": 100, "idDispositivo": "b3f1c2d4-…" }
```

`cantidad`: entero entre 1 y 200. Lotes chicos limitan el daño si se pierde el dispositivo.

**Reglas**

1. `idAperturaCaja` **no lo envía el cliente**: el servidor toma la caja abierta actual. Si no hay
   caja abierta, `400` — igual que `POST /tickets/emitir`.
2. Si ese `idDispositivo` ya tiene un lote `ACTIVO`, responder `409` con `{ "codigo":
   "LOTE_ACTIVO_EXISTENTE", "idLote": 7 }`. El cliente debe conciliar el anterior primero. Para
   recuperar sus folios está `GET /tickets/lotes-offline/activo`.
3. `expiraEn`: fin de la jornada operativa. Sugerido, configurable: las 06:00 del día siguiente.
   Un job diario pasa los `RESERVADO` vencidos a `NO_UTILIZADO`.

**Response `201`**
```json
{
  "idLote": 7,
  "idAperturaCaja": 12,
  "idUsuario": 3,
  "idDispositivo": "b3f1c2d4-…",
  "estado": "ACTIVO",
  "fechaCreacion": "2026-08-20T13:00:00.000Z",
  "expiraEn": "2026-08-21T06:00:00.000Z",
  "folios": [
    {
      "numeroTicket": "TCK-2026-000101",
      "firma": "9f2a7c…",
      "qr": "TCK-2026-000101|9f2a7c…"
    }
  ]
}
```

> **`qr` debe venir armado por el servidor**, en el mismo formato exacto que produce hoy
> `TicketBackend.qr` en la emisión online. Si el frontend tuviera que construir esa cadena por su
> cuenta, cualquier cambio futuro de formato rompería silenciosamente los pases offline y el
> problema aparecería recién en la puerta de la cueva.

---

## 4. `GET /tickets/lotes-offline/activo` — Recuperar lote

Permiso: `EmisionTickets` / `Ver`
Query: `?idDispositivo=b3f1c2d4-…`

Devuelve el lote `ACTIVO` de ese dispositivo con los folios que siguen en `RESERVADO`. Sirve para
cuando se reinstala la aplicación o se borra el almacenamiento local: sin esto, los folios quedan
inutilizables hasta que expiren y el taquillero no puede vender.

Exige que coincidan **usuario y dispositivo**. Este endpoint vuelve a exponer folios pre-firmados;
no debe poder usarse desde otra sesión para extraerlos.

**Response `200`**
```json
{ "hayLoteActivo": true, "lote": { … misma forma que § 3 … } }
```
o `{ "hayLoteActivo": false, "lote": null }`.

Envoltorio explícito, siguiendo el criterio de `GET /cajas/actual`.

---

## 5. `POST /tickets/emitir-offline` — Subir la cola de ventas

Permiso: `EmisionTickets` / `Crear`

**Request** — lote de hasta 50 ventas por llamada.
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
      "fechaUsoOffline": "2026-08-20T14:41:02.000Z",

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
      "guia": { "modo": "nuevo", "nombre": "Pedro Ak'abal", "tieneCarnet": false, "idOpcionPagoGuia": 2 }
    }
  ]
}
```

Todo lo que va después de `montoCobrado` es el payload de `POST /tickets/emitir` sin cambios.

`numeroTicketGuia` solo aparece cuando la venta lleva guía sin carnet, que genera un segundo ticket
y por lo tanto consume un segundo folio.

`fechaUsoOffline` es opcional y aparece cuando el visitante ya ingresó, validado contra el
almacenamiento local (§ 8.1). El ticket debe crearse **con el uso ya sellado en esa fecha**. Si se
ignora, el mismo pase vuelve a entrar en la puerta la próxima vez que se escanee.

**Reglas, en este orden**

1. **Idempotencia.** Si `idLocal` ya existe, no crear nada: devolver el ticket existente con estado
   `DUPLICADO_IGNORADO`. Es lo que permite al cliente reintentar sin miedo tras un timeout ambiguo.
2. El folio debe pertenecer a `idLote` y estar en `RESERVADO`. Si no, rechazar ese ítem.
3. `idOpcionPago` debe ser **efectivo**. Offline no se cobra con tarjeta: sin pasarela no hay cobro.
   Cualquier otra forma de pago se rechaza.
4. **Acotar `fechaEmision`** al rango `[lote.fechaCreacion, ahora]`. Viene del reloj del dispositivo
   y no es confiable; un reloj mal puesto mandaría la venta al arqueo de otro día.
5. Recalcular el precio con la **tarifa vigente en `fechaEmision`**. Las tarifas ya son versionadas
   por vigencia (`DOCUMENTACION_ENDPOINTS.md` § 12), así que el dato existe.
6. Crear el ticket con `numeroTicket` = el folio reservado. Pasar el folio a `EMITIDO`.
7. **La caja del ticket es `lote.idAperturaCaja`, no la caja abierta al momento de subir.** La venta
   ocurrió en el turno del lote y ahí debe cuadrar.
8. Crear el `TicketPago` en efectivo por **`montoCobrado`**, que es el dinero que realmente entró al
   cajón. Si el recálculo del punto 5 difiere, guardarlo en `montoRecalculado` y exponer la
   diferencia en el arqueo. **No rechazar por discrepancia**: el visitante ya pagó y ya entró; un
   rechazo dejaría dinero en la caja sin ticket que lo respalde, que es peor.
9. Registrar en Bitácora, marcando origen offline, con `fechaEmision` y fecha de sincronización.

**Cada venta va en su propia transacción.** Una venta con datos malos no debe abortar las otras 49.

**Response `200`** — éxito parcial. Nunca `4xx` para el lote completo si al menos un ítem es válido.
```json
{
  "procesadas": 3,
  "resultados": [
    { "idLocal": "f47ac10b-…", "estado": "CREADO", "ticket": { … TicketBackend … } },
    { "idLocal": "a91bd22c-…", "estado": "DUPLICADO_IGNORADO", "ticket": { … } },
    { "idLocal": "c02ef88a-…", "estado": "RECHAZADO", "codigo": "FOLIO_NO_RESERVADO", "mensaje": "…" }
  ]
}
```

Códigos de rechazo: `FOLIO_NO_RESERVADO`, `FOLIO_DE_OTRO_LOTE`, `LOTE_INVALIDADO`,
`PAGO_NO_EFECTIVO`, `CATALOGO_INVALIDO`.

El resultado por ítem es lo que le permite al frontend distinguir **"no hubo red, reintento"** de
**"el servidor lo rechazó, aviso al taquillero y no reintento"**. Sin esa distinción, la cola
reintenta para siempre una venta que nunca va a entrar.

---

## 6. `POST /tickets/lotes-offline/:id/conciliar` — Cerrar el lote

Permiso: `EmisionTickets` / `Crear`

**Request** — el cliente declara lo que hizo, como contraste.
```json
{
  "foliosUtilizados": ["TCK-2026-000101", "TCK-2026-000102"],
  "foliosNoUtilizados": ["TCK-2026-000103", "…"]
}
```

**Reglas**

1. Todo folio del lote que siga en `RESERVADO` pasa a `NO_UTILIZADO`. Así la auditoría no ve huecos
   inexplicados en la secuencia de folios.
2. Si el cliente declara utilizado un folio del que el servidor no tiene ticket, **no fallar**:
   agregarlo a `advertencias`. Significa una venta que se perdió (almacenamiento corrupto, cola
   borrada) y hay que investigarla, pero bloquear la conciliación dejaría la caja sin poder cerrar.
3. El lote pasa a `CONCILIADO`. Recién entonces se puede cerrar la caja (§ 8).

**Response `200`**
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

---

## 7. `DELETE /tickets/lotes-offline/:id` — Invalidar lote

Permiso: `EmisionTickets` / `Anular`

Para dispositivo perdido o robado. Todos los folios `RESERVADO` pasan a `INVALIDADO`, el lote
también. Las subidas posteriores contra ese lote se rechazan con `LOTE_INVALIDADO`.

> **Destruye las ventas offline que todavía no se hubieran subido.** Ese dinero quedaría cobrado sin
> ticket. Usar solo cuando el dispositivo no va a volver.

---

## 8. Cambio en `POST /tickets/validar`

`DOCUMENTACION_ENDPOINTS.md` § 11.3 hoy responde `200` / `401` / `404` / `409`.

**Regla nueva:** si `numeroTicket` corresponde a un `FolioReservado` en estado `RESERVADO`,
`NO_UTILIZADO` o `INVALIDADO`, responder **`404`**, idéntico a un folio inexistente.

Sin distinguir entre los casos, y sin mensaje que revele que el folio existe. La firma de un folio
reservado es criptográficamente válida; si `/validar` lo aceptara, cualquier folio filtrado sería
entrada gratuita. Y un mensaje del tipo "folio reservado, aún no vendido" le confirma a quien esté
probando números que el rango del bloque existe.

### 8.1 Efecto en la puerta, y cómo lo resuelve el frontend

La regla anterior deja un hueco operativo: el visitante recibe un QR válido al comprar y puede
llegar a la entrada de la cueva antes de que la venta suba. El folio sigue `RESERVADO`, el servidor
responde `404` y se le niega el paso a alguien que pagó.

**Se resuelve del lado del cliente, no acá.** Sin conexión, la pantalla de validación consulta
primero el almacenamiento local: si *este dispositivo* vendió ese folio y no está marcado como
usado, autoriza y sella el uso localmente. Es una comprobación más fuerte que la firma, porque no
pregunta si el folio salió del sistema sino si corresponde a una venta real.

Ese sello llega al backend por dos caminos, y ambos deben funcionar:

1. Si la venta todavía no había subido, viaja en `fechaUsoOffline` dentro del propio ítem (§ 5).
2. Si la venta ya había subido y el pase se usó después, el dispositivo llama a
   `POST /tickets/validar` al reconectar. Para entonces el folio ya está `EMITIDO`, así que el
   endpoint funciona sin cambios. La marca de tiempo será la del reintento, no la del ingreso real.

No hace falta ningún endpoint nuevo para esto.

---

## 9. Cambio en `POST /cajas/:id/cierre`

Hoy el arqueo es inmutable y solo puede haber una caja abierta en todo el sistema
(`DOCUMENTACION_ENDPOINTS.md` § 8). Una venta offline de las 10:00 que sube a las 16:00 no puede
entrar en una caja cerrada a las 14:00 sin corromper un arqueo ya guardado.

**Regla nueva:** si la caja tiene un lote offline en estado `ACTIVO`, responder `409`.
```json
{ "codigo": "LOTE_OFFLINE_PENDIENTE", "idLote": 7, "foliosReservados": 88 }
```

El taquillero cierra su turno con conexión, que es cuando de todos modos cuenta el efectivo.

**Salida de emergencia:** `POST /cajas/:id/cierre` con `{ "forzarLoteOffline": true }`, que exige
permiso `Cajas` / `Anular`. Invalida el lote (§ 7) y lo deja registrado en Bitácora. Las ventas que
lleguen después de eso entran como ajuste post-cierre **visible**, nunca en silencio.

---

## 10. Duración del refresh token

El dispositivo puede pasar un turno completo sin conexión. Al reconectar necesita un refresh token
todavía válido para subir la cola.

**Si el refresh token vence antes de que el dispositivo reconecte, no se puede subir nada** — y el
taquillero tampoco puede volver a iniciar sesión, porque justamente estaba sin internet. Las ventas
quedan atrapadas en el dispositivo.

Recomendación: **mínimo 7 días** para sesiones con `recordarme: true`. Verificar el valor actual.

La rotación de refresh tokens no estorba: es un solo dispositivo, con un solo token en vuelo.

---

## 11. Login offline — qué necesita el backend

**Nada.** Se resuelve entero en el frontend.

En el login online el navegador tiene la contraseña en claro. Deriva
`PBKDF2-SHA256(contraseña, salt aleatorio, 600 000 iteraciones)` con WebCrypto y guarda localmente
solo el salt y el digest; la contraseña nunca se almacena. Esa misma derivación produce además la
llave AES-GCM con la que se cifran, en el almacenamiento local, el refresh token y los folios
pre-firmados. Un dispositivo robado sin la contraseña no entrega folios utilizables.

Se documenta acá solo para que quede constancia de dos límites que sí dependen del backend:

- La duración del refresh token (§ 10) también acota la ventana de login offline.
- **Un usuario dado de baja mientras el dispositivo está offline sigue operando hasta que
  reconecte.** No tiene solución limpia: sin red no hay forma de consultar su estado. Al
  sincronizar se detecta y se cierra la sesión, pero esos tickets ya se vendieron. Conviene que
  Bitácora lo deje explícito al procesar el lote.

---

## 12. Resumen de cambios

| # | Endpoint | Tipo |
|---|---|---|
| 1 | `POST /tickets/lotes-offline` | Nuevo |
| 2 | `GET /tickets/lotes-offline/activo` | Nuevo |
| 3 | `POST /tickets/emitir-offline` | Nuevo |
| 4 | `POST /tickets/lotes-offline/:id/conciliar` | Nuevo |
| 5 | `DELETE /tickets/lotes-offline/:id` | Nuevo |
| 6 | `POST /tickets/validar` | Modificado — folio reservado responde 404 |
| 7 | `POST /cajas/:id/cierre` | Modificado — 409 con lote activo, más `forzarLoteOffline` |
| 8 | Refresh token | Configuración — TTL mínimo 7 días |

Migraciones: tablas `LoteOffline` y `FolioReservado`; campos `idLocal` (único), `idLoteOffline`,
`fechaEmisionOffline`, `montoRecalculado` y `origenOffline` en `Ticket`; contador atómico único
para la secuencia de folios.
