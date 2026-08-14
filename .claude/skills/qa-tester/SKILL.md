---
name: qa-tester
description: Auditoría estática de QA del frontend de Aktun Kan contra el contrato de DOCUMENTACION_ENDPOINTS.md. Detecta rutas de API mal consumidas, respuestas leídas con la forma equivocada, botones sin guarda de doble clic, permisos mal gateados, montos Decimal usados como número y recursos sin liberar. Úsala cuando pidan revisar calidad, validar que la API se consuma bien, probar que un botón no dispare dos veces, auditar permisos de una pantalla, o antes de dar por terminado un módulo.
---

# QA tester

Audita código sin ejecutarlo. Reporta primero, corrige solo con confirmación.

## Alcance

- Sin argumento: los archivos modificados (`git status --short` y `git diff`).
- Con argumento: la ruta o módulo indicado (`/qa-tester app/cierre-diario/page.tsx`).

Anuncia el alcance en una línea antes de empezar. No lo amplíes por tu cuenta.

## Procedimiento

1. Lee `referencias/catalogo-verificaciones.md` (las 23 reglas) y `referencias/fallos-conocidos.md` (los síntomas ya vistos en este repo).
2. Para cada endpoint que toque el código en alcance, lee su sección en `DOCUMENTACION_ENDPOINTS.md`: forma de la respuesta, permiso requerido y códigos de error documentados. **El contrato manda sobre lo que asuma el código.**
3. Recorre el catálogo A–E sobre los archivos en alcance.
4. Ejecuta `npx tsc --noEmit`. Es el único gate real: `next.config.mjs` tiene `ignoreBuildErrors: true`, así que el build pasa con errores de tipos. Incluye el resultado en el reporte.
5. Reporta.
6. Pregunta caso por caso antes de editar.

## Reglas del reporte

Cada hallazgo lleva `archivo:línea`, **qué falla en la práctica** (no la regla abstracta) y el arreglo propuesto. Ordena por severidad:

- **Bloqueante** — rompe en producción: respuesta leída con forma equivocada, botón que dispara una acción que el backend rechazará, doble envío en una operación de dinero, permiso mal gateado que expone una acción imposible.
- **Importante** — degrada: 403 evitable, falta estado vacío o de error, mensaje genérico donde el contrato define una precondición.
- **Menor** — consistencia y mantenibilidad.

Usa `ReportFindings` si está disponible; si no, una lista.

Cuando no puedas verificar algo sin el backend corriendo, dilo explícitamente en vez de suponer que pasa. Un "no verificable estáticamente" es un resultado válido; un falso "correcto" no.

## Límites

- No edites nada durante la auditoría.
- Tras reportar, propón los arreglos uno por uno y espera confirmación de cada uno.
- No instales dependencias ni agregues frameworks de prueba: esta skill es estática a propósito.
- No inventes hallazgos para llenar el reporte. Si el alcance está limpio, dilo en una línea.
