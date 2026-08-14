# Catálogo de verificaciones

23 reglas en cinco grupos. Cada una indica qué buscar y cómo se ve el fallo.

---

## A. Contrato con la API

### A1. La forma leída coincide con la documentada
Comparar lo que el código desestructura contra el JSON de respuesta en `DOCUMENTACION_ENDPOINTS.md`.

Señal de alarma: el backend envuelve la entidad (`{ hayCajaAbierta, caja }`) y el código lee la respuesta como si fuera la entidad. El envoltorio siempre es truthy, así que `if (respuesta)` da `true` incluso cuando no hay nada, y los campos salen `undefined`.

Verificar también el caso inverso: desestructurar `{ datos }` de un endpoint que devuelve el arreglo directo.

### A2. Ruta y método coinciden con el contrato
Cada entrada de `lib/api.ts` contra su sección del documento. Atención a `PATCH` vs `PUT` y a rutas de acción (`/cajas/:id/cierre/anular`).

### A3. Nombres de query params
Los que se arman con `URLSearchParams` deben coincidir literalmente con los documentados. Un parámetro mal escrito no da error: el backend lo ignora y devuelve resultados sin filtrar.

### A4. Montos Decimal llegan como cadena
Prisma serializa `Decimal(18,4)` como `"500.0000"` para no perder precisión. Marcar cualquier monto usado en aritmética sin convertir.

`+` sobre cadenas concatena (`"500" + "10"` → `"50010"`). La resta y la multiplicación coercen y *parecen* funcionar, lo que lo vuelve peor: pasa la prueba casual y falla al sumar.

Convertir con un helper explícito (`aNumero()` en `app/cierre-diario/page.tsx`). Tipar esos campos como `string` o `number | string`, nunca solo `number`, para que el compilador obligue a convertir.

### A5. Endpoints paginados
`GET /tickets` devuelve `{ datos, total, pagina, limite, metricas }`. Marcar si se trata como arreglo, o si las métricas se recalculan en el cliente sobre la página actual — el servidor las calcula sobre el filtro completo, y recalcularlas da otro número.

### A6. Ningún `fetch` fuera de `lib/api.ts`
`request()` concentra el token, el refresh ante 401 y el reintento. Un `fetch` suelto pierde todo eso: fallará al expirar el access token (30 min) sin renovar.

Excepción legítima: el `fetch` de `/auth/refresh` dentro de `lib/api.ts`, que no puede pasar por `request()` sin recursión.

---

## B. Semántica de errores HTTP

### B7. 401 de negocio vs sesión expirada
`ENDPOINTS_401_DE_NEGOCIO` en `lib/api.ts` debe cubrir todo endpoint cuyo `401` documentado signifique otra cosa.

Caso vivo: `POST /tickets/validar` responde `401` por firma de QR alterada. Sin registrar, el wrapper lo toma como expiración, intenta refrescar, falla y **expulsa al taquillero al login cada vez que alguien escanea un pase falso**.

Al revisar un endpoint nuevo: si su documentación describe un `401` que no sea "token inválido", va en esa lista.

### B8. Lista de endpoints públicos exacta
`ENDPOINTS_PUBLICOS` es lista blanca, no prefijo. `/auth/sesiones` y `/auth/logout-todas` empiezan con `/auth/` pero exigen token; tratarlos como públicos los manda sin `Authorization` y responden 401.

### B9. Precondiciones documentadas con mensaje específico
Cuando el contrato define un motivo concreto de rechazo, el usuario debe leer ese motivo y qué hacer, no un toast genérico con el mensaje crudo:

- `400` al emitir ticket sin caja abierta → indicar que abra caja en Cierre Diario.
- `400` al tocar un gasto de una caja ya cerrada.
- `409` ticket ya utilizado → mostrar la fecha de uso; es el caso más importante de comunicar bien, porque significa que alguien intenta entrar dos veces con el mismo pase.
- `409` al reabrir una caja cuando ya hay otra abierta.

---

## C. Permisos

### C10. `moduloRequerido` existe en el catálogo del backend
Cada `<RutaProtegida moduloRequerido="X">` debe usar un nombre que el backend reconozca hoy.

Los nombres viven en BD y se renombran: `Auditoria` pasó a `Bitacora` y el guard quedó atrás, dejando "Acceso Denegado" en una pantalla que el usuario sí podía ver. Nombres actuales: `EmisionTickets`, `Usuarios`, `Puestos`, `Cajas`, `Gastos`, `Bitacora`. Sin backend, contrastar contra `MODULOS_BACKEND` en `componentes/modulos_navegacion.ts` y contra el contrato.

### C11. Cada botón que muta está gateado por la acción de su endpoint
Cruzar cada acción de la UI con la columna "Permiso requerido" del contrato. Acceso al módulo **no** implica poder operar: abrir y cerrar caja exigen `Cajas/Crear`, no basta `Cajas/Ver`.

Un botón visible cuya acción el backend rechazará es un defecto: promete algo que no se puede cumplir.

### C12. El gateo usa `puedeAccion()`
`puedeAccion(modulo, accion)` del contexto resuelve contra `acciones` de `GET /modulos/mis-modulos`, que es la lista realmente concedida.

No gatear con `usuario.permiso` de `/auth/me`: el contrato lo documenta como `permiso: []` y no garantiza traerlo expandido con `moduloAccion.modulo`/`accion`. Gatear con eso mostraba "Abrir Caja" a un usuario de solo lectura.

### C13. Ninguna llamada con 403 garantizado
Si una pantalla la ve alguien sin cierto permiso, no debe llamar a endpoints que exijan otro.

Caso vivo: el menú se armaba con `GET /modulos`, que exige `Usuarios.Ver` → 403 y menú vacío para un cajero. Se usa `GET /modulos/mis-modulos`, que solo pide token válido.

Aplica también a cargas condicionales: no pedir `/gastos` ni `/tipos-gasto` sin permiso de Gastos.

### C14. Comparación de nombres normalizada
Todo cotejo de nombre de módulo pasa por `normalizarNombreModulo()` (`lib/utils.ts`), que ignora mayúsculas, espacios y tildes.

Comparar literal hace que `"Bitácora"` no coincida con `"Bitacora"` y el módulo desaparezca del menú sin error visible.

---

## D. Robustez de interacción

### D15. Doble clic — exige las dos mitades
Todo handler `async` disparado por el usuario necesita **ambas**:

1. Estado de "en curso" (`const [enviando, setEnviando] = useState(false)`), puesto antes del `await` y limpiado en `finally`.
2. Su disparador deshabilitado con ese estado (`disabled={enviando}`).

La bandera sola no basta si el botón sigue activo: el segundo clic entra igual. El `disabled` solo tampoco, si el estado no se limpia en `finally` y una excepción deja el botón muerto.

Para listas, el estado guarda el id en curso (`disabled={cerrandoId === s.id}`), no un booleano global que congelaría todas las filas.

Gravedad: en operaciones de dinero (anular gasto, emitir ticket, cerrar caja) es **bloqueante** — duplica registros y descuadra el arqueo.

Referencia correcta: `handleCerrarSesion` en `app/sesiones/page.tsx`. **No reportarlo como hallazgo.**

### D16. Peticiones concurrentes deduplicadas
Cuando varias llamadas simultáneas dispararían la misma operación cara o no idempotente, debe haber una sola en vuelo.

Patrón de referencia: `refrescarTokensUnaVez()` en `lib/api.ts`. Sin eso, varios 401 a la vez gastan y rotan el refresh token varias veces, y el backend interpreta la reutilización como robo y cierra todas las sesiones.

### D17. Los recursos se liberan al desmontar
Todo `useEffect` que adquiere algo debe devolver su limpieza: stream de cámara (`componentes/escaner_qr.tsx`), timers, listeners, suscripciones.

Una cámara sin liberar deja la luz encendida y el dispositivo ocupado. Verificar también el caso de desmontaje mientras la adquisición está en curso (bandera `cancelado`).

### D18. Búsquedas contra la API con retardo
Un input que dispara petición por tecla satura al backend. Debe pasar por un retardo que reinicie la paginación al aplicarse. Patrón en `componentes/historial_tickets_emitidos.tsx`.

---

## E. Prácticas de código

### E19. `npx tsc --noEmit` limpio
Único gate real: `next.config.mjs` fija `typescript.ignoreBuildErrors: true`, así que `npm run build` pasa con errores de tipos. `npm run lint` hoy falla porque eslint no está instalado; no lo reportes como hallazgo del código en alcance.

### E20. Sin código muerto
Componentes o tipos que ya nadie importa, sobre todo tras una migración. Confirmar con búsqueda antes de proponer borrar: que no lo use ninguna página ni componente vivo.

### E21. La UI dependiente de permisos espera la carga
Si los permisos llegan por red, renderizar antes deja ver botones que luego desaparecen. Contemplar `cargandoModulos` en la condición de carga.

### E22. Listas con estado vacío y de error
Toda lista traída de la API necesita un estado vacío distinguible del de error. "No hay resultados" y "no se pudo cargar" no son lo mismo para quien está en taquilla.

### E23. Nada se oculta por efecto colateral de otra rama
Revisar que una condición de UI no esconda algo sin relación.

Caso vivo: la pestaña de Gastos vivía dentro del `else` de "no hay caja abierta", así que desaparecía sin caja aunque el usuario tuviera todos los permisos de Gastos. Registrar un gasto sí exige caja abierta; **consultar el histórico no**.

Al revisar un bloque condicional, preguntar qué más se está ocultando además de lo intencionado.
