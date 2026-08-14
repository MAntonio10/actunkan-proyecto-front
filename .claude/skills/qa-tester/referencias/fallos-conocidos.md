# Fallos conocidos de este repo

Errores reales encontrados al conectar el frontend al backend. Se documentan por su **síntoma observable**: son fallos silenciosos, así que reconocerlos por el síntoma es más rápido que deducirlos de la regla.

Lo que tienen en común: ninguno lanza excepción. Todos producen una pantalla que *parece* funcionar.

---

## 1. Envoltorio leído como si fuera la entidad

**Síntoma:** la UI muestra una caja abierta con monto Q0.00 cuando en BD no hay ninguna abierta.

**Causa:** `GET /cajas/actual` devuelve `{ hayCajaAbierta: false, caja: null }`. El código hacía `const caja = await res.json()` y evaluaba `if (caja)`. El envoltorio es un objeto, siempre truthy → "hay caja"; `caja.montoInicial` era `undefined` → `Number(undefined) || 0` → `0`.

**Arreglo:** desenvolver en la capa API (`res?.caja ?? null`), no en cada consumidor.

**Qué buscar:** una respuesta con campo booleano de estado (`hayX`) más la entidad. Verificar que el código lea el campo interno.

---

## 2. `401` de negocio tratado como sesión expirada

**Síntoma:** al escanear un QR alterado, el taquillero es expulsado al login.

**Causa:** `POST /tickets/validar` responde `401` por firma inválida. El wrapper trataba todo `401` como expiración: intentaba refrescar, fallaba y limpiaba la sesión.

**Arreglo:** `ENDPOINTS_401_DE_NEGOCIO` en `lib/api.ts`, excluido del refresh y del redirect.

**Qué buscar:** endpoints cuyo `401` documentado describa una condición de negocio.

---

## 3. Botón gateado con la fuente de permisos equivocada

**Síntoma:** un usuario con solo `Cajas.Ver` ve el botón "Abrir Caja".

**Causa:** el gateo usaba `tienePermiso()`, que recorre `usuario.permiso` de `/auth/me`. El contrato documenta ese campo como `permiso: []` y no garantiza traerlo expandido con `moduloAccion.modulo`/`accion`.

**Arreglo:** `puedeAccion(modulo, accion)`, que resuelve contra `acciones` de `GET /modulos/mis-modulos` — la lista efectivamente concedida.

**Qué buscar:** cualquier gateo de UI que lea `usuario.permiso` en vez de `puedeAccion`.

---

## 4. Nombre de módulo desactualizado tras renombre en BD

**Síntoma:** "Acceso Denegado" en Bitácora, aunque el usuario tenga el permiso.

**Causa:** el módulo pasó de `Auditoria` a `Bitacora` en BD; `<RutaProtegida moduloRequerido="Auditoria">` quedó atrás. El mismo renombre había dejado nombres viejos en el redirect de escape de `ruta_protegida.tsx`.

**Arreglo:** actualizar los literales y normalizar la comparación con `normalizarNombreModulo()`.

**Qué buscar:** literales de nombre de módulo en guards, registros de navegación y llamadas a `tieneAccesoModulo`. Contrastar con los nombres vigentes.

---

## 5. Comparación de nombres sensible a tildes

**Síntoma:** un módulo no aparece en el menú, sin error en consola.

**Causa:** la búsqueda era por coincidencia exacta: `"Bitácora"` del backend no encontraba la clave `"Bitacora"`.

**Arreglo:** `normalizarNombreModulo()` en `lib/utils.ts` (quita tildes, mayúsculas y espacios), aplicado en ambos lados.

---

## 6. Endpoint con 403 garantizado para armar el menú

**Síntoma:** un cajero entra y no ve ningún módulo, aunque tenga permisos.

**Causa:** el menú se armaba con `GET /modulos`, que exige `Usuarios.Ver`. Sin ese permiso: 403 y lista vacía.

**Arreglo:** `GET /modulos/mis-modulos`, que solo exige token válido y ya viene filtrado.

**Qué buscar:** llamadas cuyo permiso requerido sea más estricto que el de la pantalla que las hace.

---

## 7. Doble clic sin guarda

**Síntoma:** dos registros idénticos, o un arqueo descuadrado tras un clic nervioso.

**Causa:** handler `async` sin estado de "en curso" y botón sin `disabled`.

**Estado actual:** `handleAnularGasto` (`app/cierre-diario/page.tsx`), `handleActivarUsuario` y `handleActivarPuesto` (`app/usuarios/page.tsx`) siguen sin guarda. `handleCerrarSesion` (`app/sesiones/page.tsx`) sí la tiene y **no debe reportarse**.

---

## 8. Monto Decimal usado como número

**Síntoma:** un total absurdamente largo (`"50010"` en vez de `510`), o `NaN`.

**Causa:** Prisma serializa `Decimal(18,4)` como `"500.0000"`. Con `+` las cadenas se concatenan.

**Detalle que lo hace traicionero:** la resta y la multiplicación coercen y funcionan, así que el error aparece solo al sumar.

**Arreglo:** helper `aNumero()` y tipar esos campos como `string` o `number | string`.

---

## 9. UI oculta por efecto colateral de otra rama

**Síntoma:** desaparece la pestaña de Gastos porque no hay caja abierta, aunque el usuario tenga todos los permisos de Gastos.

**Causa:** el bloque de pestañas vivía dentro del `else` de "no hay caja abierta", así que el estado vacío reemplazaba la pantalla entera.

**Arreglo:** separar "no puedo *registrar* un gasto" (exige caja abierta) de "no puedo *ver* el histórico" (no la exige).

**Qué buscar:** condiciones de UI que envuelven más de lo que su nombre sugiere.

---

## 10. Código muerto tras migración

**Síntoma:** `tsc` falla en un archivo que nadie usa.

**Causa:** `panel_emision.tsx` y `formulario_emision_ticket.tsx` implementaban un flujo anterior, no se importaban desde ninguna página y referenciaban tipos ya retirados.

**Qué buscar:** tras una migración, componentes que solo se referencian entre sí.
