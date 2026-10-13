---
name: responsividad
description: Audita la interfaz en móvil, tablet y escritorio módulo por módulo, con reglas concretas de cómo deben agruparse las tarjetas según cuántas sean, y revisa tablas, modales, formularios y accesibilidad táctil. Usar cuando se pida "probar responsividad", "revisar en móvil", "no se ve bien en celular", "las tarjetas se ven mal", "responsive", "se corta en pantalla chica" o "revisar la interfaz en tablet".
---

# Responsividad

Audita la interfaz de Aktun Kan (Next.js + Tailwind + shadcn/ui) en pantallas chicas. El entregable es un informe por módulo con el problema, el archivo y la corrección propuesta.

**No es una revisión de estética.** Cada hallazgo cita `archivo:línea` y dice en qué ancho se rompe.

---

## Regla de agrupación de tarjetas

Lo primero que hay que verificar en cada módulo. En móvil las tarjetas **no** se apilan en una sola columna: se agrupan en dos, y la última se estira si queda sola.

| Tarjetas | Móvil | Por qué |
|---|---|---|
| 1 | 1 columna, ancho completo | — |
| 2 | 2 columnas | Caben; apilarlas desperdicia media pantalla |
| **3** | **1 arriba ocupando 2 columnas + 2 abajo** | La primera es la principal. Nunca 3 apiladas |
| 4 | 2 × 2 | — |
| 5 | 2 + 2 + 1 estirada al final | La suelta ocupa el ancho, no media fila con un hueco |
| 6 | 3 filas de 2 | — |

**El patrón:** rejilla de 2 columnas, y toda tarjeta que quede sola en su fila se estira a las dos. Con 3, la que se estira es la **primera**; con 5, la **última**.

En Tailwind:

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {/* 3 tarjetas: la primera manda */}
  <Card className="col-span-2 lg:col-span-1">…</Card>
  <Card>…</Card>
  <Card>…</Card>
</div>
```

```tsx
{/* 5 tarjetas: la última se estira, y solo en móvil */}
<Card className="col-span-2 sm:col-span-1">…</Card>
```

Señal de que está mal: `grid-cols-1` en el ancho base, o `flex-col` sin `sm:flex-row`. Las dos apilan todo en móvil, que es justo lo que no se quiere.

---

## Anchos a revisar

| Ancho | Qué representa | Qué se rompe ahí |
|---|---|---|
| **320 px** | El móvil más chico en uso | Desborde horizontal, botones que no caben |
| **375 px** | iPhone SE / base real de la taquilla | La medida de referencia |
| **768 px** | Tablet vertical — **el equipo de taquilla** | Rejillas que saltan a escritorio antes de tiempo |
| **1024 px** | Tablet horizontal | — |
| **1440 px** | Escritorio | Contenido estirado sin tope de ancho |

Los `breakpoints` de Tailwind por omisión: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

> **La taquilla trabaja en tablet, no en escritorio.** Si algo se ve bien en 1440 y mal en 768, es un fallo de producción, no un detalle.

---

## Módulos a recorrer

Recorrer **todos**, no una muestra. Para cada uno: la regla de tarjetas, la tabla, los modales y el formulario.

- `app/registro-visitantes` — emisión. El formulario más largo y el más usado
- `app/cierre-diario` — cajas y arqueo
- `app/usuarios` — usuarios, puestos y permisos, con sus pestañas
- `app/bitacora` — tabla ancha, con la descripción larga
- `app/sincronizacion` — cola sin conexión
- `app/validar-ticket` — se usa **de pie, en la entrada**, a veces con una mano
- `app/reportes` — predeterminados e IA
- `componentes/modulo_actividades`, `modulo_donaciones`
- `componentes/historial_tickets_emitidos`, `historial_cierres_caja`, `historial_aperturas_caja`

---

## Qué comprobar en cada uno

### Tarjetas de indicadores
La regla de arriba. Y que el número no se corte: una cifra como `Q1,234,567.00` en una tarjeta de media pantalla necesita `text-xl sm:text-2xl`, no un tamaño fijo.

### Tablas
Son el problema más frecuente en móvil.

- ¿Hay desborde horizontal de la **página**? Eso nunca: el scroll va en el contenedor de la tabla, no en el `body`.
- ¿Se esconden columnas secundarias con `hidden sm:table-cell`?
- ¿O se cambia a lista de tarjetas en móvil? Suele leerse mejor que una tabla con scroll.
- La columna de acciones tiene que quedar alcanzable sin desplazarse.

Bitácora es el caso a mirar primero: su `descripcion` es texto largo.

### Modales
- ¿Caben en 320 px de alto útil, o el botón de confirmar queda fuera de pantalla?
- Un modal alto necesita el cuerpo con scroll y el pie fijo, o el usuario no encuentra el botón.
- Con el teclado abierto en móvil queda menos de la mitad de la pantalla: un campo enfocado no puede quedar tapado.

### Formularios
- Campos a ancho completo en móvil; en dos columnas solo desde `sm`.
- `inputMode="decimal"` en montos y `inputMode="numeric"` en cantidades: abre el teclado correcto.
- El botón de enviar, alcanzable con el pulgar.

### Táctil
- Área mínima de toque **44 × 44 px**. Un icono de 16 px dentro de un botón sin relleno no cumple.
- Separación entre acciones destructivas y las normales: anular un ticket no puede quedar a dos píxeles de imprimirlo.

---

## Cómo probarlo

**El código dice mucho antes de abrir un navegador.** Empezar por ahí, que es lo que se puede automatizar:

```bash
# Rejillas que apilan todo en movil: el error mas comun
grep -rn "grid-cols-1" --include="*.tsx" app componentes | grep -v "sm:grid-cols"

# Anchos fijos, que desbordan en 320 px
grep -rnE "w-\[[0-9]{3,}px\]|min-w-\[[0-9]{3,}px\]" --include="*.tsx" app componentes

# Tablas sin contenedor desplazable
grep -rn "<table" -B3 --include="*.tsx" app componentes | grep -c "overflow"

# Texto de tamaño fijo en tarjetas de cifras
grep -rn "text-3xl\|text-4xl" --include="*.tsx" app componentes | grep -v "sm:text"
```

**Después, en el navegador.** Necesita a una persona: ninguna sesión de Claude maneja un navegador. Preparar un guion con los pasos —qué ruta, qué ancho, qué mirar— y pedirle que lo recorra.

En DevTools: modo dispositivo, y probar **320, 375 y 768**. Los dos primeros son donde se rompe; el tercero es donde trabaja la taquilla.

---

## Informe

| Módulo | Ancho | Qué se rompe | Archivo | Corrección |
|---|---|---|---|---|

- Ordenar por gravedad: primero lo que **impide operar** (un botón inalcanzable), después lo que se ve mal.
- Separar lo verificado en código de lo que necesita el navegador. No presentar como comprobado lo que solo se dedujo leyendo Tailwind.
- Si un módulo ya cumple, decirlo. Un informe sin hallazgos en un módulo es un resultado, no una omisión.

---

## Dos cosas que no hay que romper al arreglar

**Los overlays de los modales están modificados a mano.** `dialog`, `alert-dialog`, `sheet` y `drawer` llevan `bg-black/70 backdrop-blur-sm` en lugar del valor de shadcn. Un `npx shadcn add` los pisa. Están anotados en cada archivo.

**El pase imprimible mide 80 mm**, no una hoja. Si se toca su CSS, `@page { size: 80mm auto }` no es negociable: va a una impresora térmica de tickets.
