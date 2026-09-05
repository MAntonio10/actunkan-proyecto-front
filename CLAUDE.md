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
Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + shadcn/ui (new-york style, Radix primitives) + react-hook-form + zod + sonner + Dexie (IndexedDB, offline ticketing). Path alias `@/*` maps to repo root.

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

**`ACCESO_TEMPORAL_DEV`** (top of `contexto_autenticacion.tsx`) is a dev bypass that makes every permission check (`tienePermiso`, `tieneAccesoModulo`, `tieneAlgunPermiso`, `puedeAccion`) pass regardless of the logged-in user's actual permissions. It is currently `false`, so real gating is in effect — but if a permission-related bug report doesn't reproduce, check this flag first.

Route-level guarding uses `<RutaProtegida moduloRequerido="..." accionRequerida="...">` (`componentes/ruta_protegida.tsx`) wrapping each protected page's content — it redirects unauthenticated users to `/login`, shows an "sin módulos asignados" screen if the user has zero permissions, and shows an "acceso denegado" screen if the specific module/action check fails. New protected pages should wrap their body in this component with the appropriate `moduloRequerido` (matching a `ModuloBackend.nombre` from the backend, e.g. `"Usuarios"`, `"Actividades"`, `"Cierre Diario"`, `"Auditoria"`, `"Sincronizacion"`).

### Offline (módulo EmisionTickets)

The ticket desk sells without internet. `ESPECIFICACION_OFFLINE.md` (repo root) is the authoritative contract for the backend side — read it before touching any of this.

How it works: while online the device reserves a **lote** of pre-signed folios (`POST /tickets/lotes-offline`). Each folio is a `numeroTicket` plus its HMAC signature, generated by the server ahead of the sale. The signature covers **only `numeroTicket`** (backend `firmarNumeroTicket()`), which is what makes pre-signing possible — if that ever changes, the whole model breaks. Offline the desk consumes folios locally, so the visitor gets a valid QR at the moment of sale, and the queue uploads later.

Storage is Dexie (IndexedDB) in `lib/db_tickets.ts` — deliberately limited to what selling offline needs. Modules that require the network (usuarios, cajas, bitácora) have no table there.

- `lib/folios_offline.ts` — reserve, consume, reconcile the lote. A sale consumes 1 folio, or 2 when there's a guide without carnet.
- `lib/emision_offline.ts` — writes the local sale and returns a `RespuestaEmisionTicket`-shaped object so `PaseAcceso` renders unchanged. Offline tickets carry `origenOffline: true` and a **negative `id`**: no PDF, no anular.
- `lib/sincronizador_tickets.ts` — serial upload queue. Every sale carries an `idLocal` UUID as idempotency key. **A network error retries forever; a server rejection does not** — that distinction is the whole reason `ErrorDeRed` exists as a separate class from `ApiError` in `lib/api.ts`.
- `lib/validacion_offline.ts` — a pass sold offline is still a `RESERVADO` folio server-side, so `/tickets/validar` returns 404 for it. Offline the door validates against Dexie instead: it checks that *this device sold it*, which is stronger than checking the signature.
- `ticketsPendientesDeSubir()` in `lib/emision_offline.ts` feeds `historial_tickets_emitidos.tsx`. Membership is derived from the **queue state** (`pendiente`/`enviando`/`rechazada`), never from a flag on the ticket — that's what guarantees a row can't appear twice once the backend confirms it. Local rows are keyed by `numeroTicket`, not `id`: local ids are negative and restart at `-1` on every reload, so they collide. They render with a dashed sky-blue left border plus a `SIN SUBIR` / `RECHAZADA` badge, appear only on page 1, and hide the PDF and anular actions.
- `app/sincronizacion/page.tsx` — the offline control panel, and the **only** place where half-finished sales get resolved: server-rejected ones, voided ones whose takedown failed, and ones the operator chose to hold back. It reads nothing from the API, which is why it's a precached route and gated on `EmisionTickets` rather than the nonexistent `Sincronizacion` backend module.
- **Voiding an offline sale never uploads it.** `anularVentaLocal` moves it to the terminal local state `anulada`; the queue skips it forever. No ticket is created, so nothing needs taking down — which is the point: `DELETE /tickets/:id` needs `EmisionTickets / Anular`, a permission a taquillero usually lacks, and it also needs the origin caja still open. Both would fail exactly when it matters. Instead `conciliarLoteActual` declares that folio under `foliosNoUtilizados`, so the backend closes it and `/tickets/validar` starts answering 404 for the printed pass. The consumed folio is never returned to the pool — the visitor may still be holding the printout, and reselling the number would give two people the same pass. Voided rows stay in Dexie as the local record (date, user, reason).
- **`retenida` sales still block the caja close.** Holding a sale back is a scheduling choice, not a cancellation — the cash is collected and outside the system either way.
- `lib/sesion_offline.ts` + `lib/cripto_offline.ts` — offline login. PBKDF2 verifier derived from the password at online-login time (the password itself is never stored); the same derivation yields the AES-GCM key that encrypts the refresh token and the pre-signed folios. **A stolen tablet without the password yields no usable folios.** The key is mirrored into `sessionStorage` so it survives a reload — when it lived only in memory, every refresh forced the taquillero to retype their password. It still dies when the app is closed, which is what preserves the protection. `restaurarSesionDeMemoria()` is what lets an offline reload resume instead of bouncing to `/login`.

Four things that bite:

- **`enLinea` is observed connectivity, not `navigator.onLine`.** The browser flag only reports the network interface, so it stays `true` on a wifi with no internet or a dead backend — the top bar cheerfully read "En línea" while nothing worked. `lib/api.ts` flips `conexionActual()` from the outcome of real requests and publishes it via `suscribirConexion`. `hayConexion()` (still `navigator.onLine`) stays as the *gate for attempting* a request: if an observed failure suppressed attempts, nothing would ever discover the connection came back.
- **After touching `ventasPendientes`, call `refrescarEstado()`.** Subscribers only learned about queue changes from inside `sincronizar()`, and its early returns (offline, auto-sync off, already running) returned without notifying — so a sale queued offline never reached the top-bar badge. Two related traps in the same family: `historial_tickets_emitidos.tsx` keeps its local list keyed to `refrescarToken` because the tab is hidden rather than unmounted, and `emision_offline.ts` persists its negative-id counter in localStorage — when it lived in memory it reset to `-1` on reload and the next offline ticket **overwrote** the previous one in `ticketsLocales` (keyed by `id`), so the history showed only the most recent sale.

- **The backend's `ValidationPipe` uses `forbidNonWhitelisted`.** One extra field in the `POST /tickets/emitir-offline` payload returns 400 and kills the whole batch — up to 50 already-collected sales. `VentaOffline` in `tipos/index.ts` must mirror `DOCUMENTACION_ENDPOINTS.md` § 18.3 exactly. There's a comment on the type saying so; don't add "harmless" optional fields to it.

- **`public/sw.js` precaches only `/login`, `/registro-visitantes`, `/validar-ticket` and `/sincronizacion`, and its `RUTAS_APP` is paired with `disponibleSinConexion` in `componentes/modulos_navegacion.ts`.** Every other module is API-driven and would render empty offline, so instead of caching them the nav hides them while `enLinea` is false. Change one list and you must change the other, or the menu offers a destination the worker can't serve. The worker also needs its RSC branch: App Router soft navigation fetches `/<ruta>?_rsc=…`, which is *not* `mode: 'navigate'`, so a handler that only special-cases navigations lets those fall through and dumps the user on the browser's error page. `/sin-conexion.html` is the last-resort fallback. Bump `VERSION` when editing the worker, or clients keep the old one.
- **Everything offline needs a secure context.** `crypto.subtle` and Service Workers don't exist over plain `http://` outside localhost. The `allowedDevOrigins` in `next.config.mjs` let you reach the app from a LAN IP, but offline mode won't work there — it needs HTTPS.
- **Never wipe the session on a network error.** `contexto_autenticacion.tsx` used to call `limpiarSesionLocal()` whenever `getMe()` failed; offline that locked the taquillero out and destroyed the refresh token needed to upload pending sales. Same reasoning for `refrescarModulos`, which now falls back to the cached module list instead of an empty array (an empty list makes `RutaProtegida` show "sin módulos asignados").

The card-payment flow (Recurrente) is online-only by design: offline sales are cash-only and rejected otherwise.

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
