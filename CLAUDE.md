# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend for **Parque Regional Municipal Actún Kan** ticketing / visitor system (Guatemala). Spanish-language UI, mobile-first PWA-style layout.

Both institutional logos (ProPetén + Actún Kan) always render together via `componentes/logos_institucionales.tsx` — don't add a bare `<Image src="/actun.png">` or `/Propeten.png` anywhere; use that component so the pair stays consistent.

The backend is **mostly connected**. `DOCUMENTACION_ENDPOINTS.md` (repo root) is the authoritative API contract — read it before touching any connected module.

- **Connected to the real API:** auth (with refresh tokens + sessions), usuarios, puestos, modulos, acciones, bitácora, **tickets/tarifas** (emisión, historial, validación de QR), **cajas/gastos**.
- **Still in-memory demo data** (`*_DEMO` constants in `tipos/index.ts`): donaciones, reportes, actividades, sincronización. The backend has no endpoints for these yet.

Don't assume a module is mocked or connected — check whether it imports from `@/lib/api` or from a `*_DEMO` constant.

## Commands

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — eslint over the repo

There are no tests in the repo. `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `npm run build` will succeed even with type errors — type-check explicitly with `npx tsc --noEmit` when validating changes.

Both `package-lock.json` and `pnpm-lock.yaml` exist; the project currently builds with npm (lockfile is recent). Don't edit both — pick the one already being maintained for the change you're making.

## Architecture

### Stack
Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + shadcn/ui (new-york style, Radix primitives) + react-hook-form + zod + sonner. Path alias `@/*` maps to repo root.

### Directory layout (note the Spanish/English split — this is intentional, do not "normalize")
- `app/` — Next.js routes. Every page is a client component (`'use client'`). Root `app/page.tsx` redirects to `/login`. `app/layout.tsx` wraps everything in `ProveedorAutenticacion` and renders `BarraNavegacionInferior` globally.
- `componentes/` (Spanish) — **domain/feature components** specific to this app (forms, ticket pass preview, nav bars, QR code, `ruta_protegida.tsx` route guard, etc.). New domain components go here, in Spanish snake_case filenames.
- `components/` (English) — **shadcn/ui primitives only** (`components/ui/*`) plus `theme-provider.tsx`. Treat this as a vendored library; do not put feature code here. `components.json` configures shadcn so any `npx shadcn add` lands in `components/ui`.
- `contexto/` — React context providers (`contexto_autenticacion.tsx`, auth + permissions).
- `tipos/index.ts` — **single source of truth** for domain types AND seed/demo data. Contains two parallel type families (see "Backend integration"): legacy frontend-only types (`Usuario`, `Ticket`, `Visitante`, `ModuloSistema`, `RegistroAuditoria`, ...) with their `*_DEMO` seed constants, and `*Backend`-suffixed types (`UsuarioBackend`, `PuestoBackend`, `ModuloBackend`, `AccionBackend`, `ModuloAccionBackend`, `PermisoBackend`, `BitacoraBackend`, `RespuestaLogin`) that mirror the real API responses. Pages import whichever fits the module they're in.
- `lib/api.ts` — typed REST client for the connected modules (`api.auth`, `api.usuarios`, `api.puestos`, `api.modulos`, `api.acciones`, `api.moduloAcciones`, `api.bitacora`). Base URL comes from `NEXT_PUBLIC_API_URL` (`.env.local`, defaults to `http://localhost:4000`). Attaches the `token` from `localStorage` as a Bearer header; on a 401 it clears the stored session and hard-redirects to `/login`.
- `hooks/`, `lib/utils.ts` — small utilities (`cn` for class merging, `useToast`, `useMobile`).
- `styles/globals.css` — older copy; the live stylesheet imported by `app/layout.tsx` is `app/globals.css` (Tailwind v4 `@import 'tailwindcss'` + custom OKLCH "forest green" theme tokens).

### Backend integration & auth model
`contexto/contexto_autenticacion.tsx` exposes `useAutenticacion()` — `usuario` (typed `UsuarioBackend`), `token`, `estaAutenticado`, `cargando`, `iniciarSesion`, `cerrarSesion`, `cerrarTodasLasSesiones`, `tienePermiso(modulo, accion)`, `tieneAccesoModulo(modulo)`, `tieneAlgunPermiso()`, `refrescarUsuario`, `historialAuditoria`, `registrarAuditoria`. This is real, persisted auth — not seeded/mocked state.

**Token model (important):** login returns a short-lived `access_token` (~30 min) plus a revocable `refresh_token`; both live in `localStorage`. `lib/api.ts` handles this transparently — on a 401 it refreshes once and retries the original request, and only clears the session and redirects to `/login` if the refresh also fails. Concurrent 401s share a single in-flight refresh (`refrescarTokensUnaVez`), because the backend rotates refresh tokens and treats a reused one as theft. Don't add ad-hoc `fetch` calls that bypass `request()` — they'd lose all of this.

Two endpoint lists in `lib/api.ts` govern that behavior and must be kept accurate:
- `ENDPOINTS_PUBLICOS` — routes that take no token. It is a whitelist, not a `/auth/` prefix match, because `/auth/logout-todas` and `/auth/sesiones` *do* require a token.
- `ENDPOINTS_401_DE_NEGOCIO` — routes where a 401 is a business answer, not an expired session. `/tickets/validar` returns 401 for "tampered QR signature"; treating that as expiry would kick the taquilla user out to the login screen whenever someone scans a fake pass.

Permission checks read `usuario.permiso` (an array of `PermisoBackend`, each linking a `moduloAccion` → `modulo` + `accion`). `registrarAuditoria` still only appends to local React state (`historialAuditoria`) for login/logout events shown client-side — the `/bitacora` page itself reads real audit entries from the backend via `api.bitacora.getBitacora()`.

**`ACCESO_TEMPORAL_DEV`** (top of `contexto_autenticacion.tsx`) is a hardcoded `true` that makes every permission check (`tienePermiso`, `tieneAccesoModulo`, `tieneAlgunPermiso`) pass regardless of the logged-in user's actual permissions. It's a temporary dev bypass — flip it to `false` to exercise real permission gating, and be aware any permission-related bug report may actually be this flag.

Route-level guarding uses `<RutaProtegida moduloRequerido="..." accionRequerida="...">` (`componentes/ruta_protegida.tsx`) wrapping each protected page's content — it redirects unauthenticated users to `/login`, shows an "sin módulos asignados" screen if the user has zero permissions, and shows an "acceso denegado" screen if the specific module/action check fails. New protected pages should wrap their body in this component with the appropriate `moduloRequerido` (matching a `ModuloBackend.nombre` from the backend, e.g. `"Usuarios"`, `"Actividades"`, `"Cierre Diario"`, `"Auditoria"`, `"Sincronizacion"`).

### Navigation
There are two navs and **both** are driven by the same registry in `componentes/modulos_navegacion.ts` — change module routing/labels there, not in the components:
- `BarraNavegacionInferior` — mobile bar rendered by the root layout (`md:hidden`).
- `MenuModulos` — the desktop grid dialog, rendered inside `BarraNavegacionSuperior` (`hidden md:inline-flex`).

Both call `api.modulos.misModulos()` (`GET /modulos/mis-modulos`) and pass the result through `resolverModulosPermitidos()`. **Never use `GET /modulos` to build nav** — it requires `Usuarios.Ver`, so a taquillero would get a 403 and lose their whole menu; `mis-modulos` needs only a valid token and already returns just the user's modules with their granted `acciones`.

The registry has two halves:
- `MODULOS_BACKEND` — keyed by backend module name (`EmisionTickets`, `Usuarios`, `Cajas`, `Bitacora`); an item shows only if `mis-modulos` returns that module. Note the names are the backend's, not the route names — e.g. `EmisionTickets` maps to `/registro-visitantes` and `Cajas` to `/cierre-diario`.
- `MODULOS_SIN_BACKEND` — modules with no endpoints yet (`Reportes`, `Actividades`, `Donaciones`, `Sincronizacion`). They never arrive in `mis-modulos`, so they're always shown; move them into `MODULOS_BACKEND` as the backend implements them.

Sub-modules without their own screen (`Puestos` under `Usuarios`, `Gastos` under `Cajas`) are deliberately absent from both halves — they live as tabs inside the parent's page, so a nav entry would duplicate a route.

### Module/permission structure
Per `DOCUMENTACION_ENDPOINTS.md`: permissions are always **module + action** (`Ver`, `Crear`, `Editar`, `Anular`, `Exportar`). `EmisionTickets` is one general module covering *all* ticket catalogs, tarifas and QR validation — the catalogs are not separate permission modules.

`Modulos` and `Acciones` are infrastructure modules (`esAsignable: false`) that the backend rejects with a 400 if assigned. **`GET /modulo-acciones` is the authoritative assignable set** — it already excludes them. The permissions modal in `app/usuarios/page.tsx` relies on that in three places, all of which matter:
1. Modules render only if they have at least one entry in `moduloAcciones` (plus the `esAsignable !== false` check).
2. When opening the modal, the user's existing `permiso[]` is filtered against that set before seeding the checkboxes — users can still carry permissions granted *before* those modules became non-assignable, and re-submitting them is what triggers the 400.
3. On save the outgoing id list is filtered again as a safety net.

### Conventions
- Domain code is Spanish (variables, types, file names: `formulario_visitante_completo.tsx`, `usuario`, `cierre_diario`). Keep it Spanish — do not translate to English. shadcn primitives stay in English because they're vendored.
- Forms use react-hook-form + a zod schema declared at the top of the file (see `app/login/page.tsx`, which has three separate schemas/forms: login, solicitar código, restablecer contraseña).
- Toasts: `sonner` (`Toaster` is mounted in the root layout); call `toast(...)` from `sonner`.
- Icons: `lucide-react`.
- `app/globals.css` defines both `:root` (light) and `.dark` OKLCH token sets behind Tailwind's `@custom-variant dark (&:is(.dark *))`, but nothing currently applies a `dark` class to `<html>` in `app/layout.tsx` — the app renders with light tokens by default. `components/theme-provider.tsx` wraps `next-themes` but isn't mounted in the root layout, so it isn't driving anything either. If a page looks wrong in "dark mode," check whether `dark` is actually applied before assuming a token bug.
