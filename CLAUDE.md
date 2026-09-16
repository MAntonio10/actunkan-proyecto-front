# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend for **Parque Regional Municipal Actún Kan** ticketing / visitor system (Guatemala). Spanish-language UI, mobile-first PWA-style layout.

Both institutional logos (ProPetén + Actún Kan) always render together via `componentes/logos_institucionales.tsx` — don't add a bare `<Image src="/actun.png">` or `/Propeten.png` anywhere; use that component so the pair stays consistent.

El fondo del sistema (el mapa topográfico con la fauna del parque) lo pinta una sola vez `body::before` en `app/globals.css`, desde `public/fondo-sistema-1920.webp` — la versión servible del `fondo-sistema.webp` original, que pesa 3.8 MB y no se usa. No lo vuelva a colocar en una página, y **no le ponga `bg-background` a un contenedor de pantalla completa**: ese color es opaco y tapa el fondo entero. Su z-index es -30 para quedar por debajo de las capas decorativas que login, `/pago/*` y `ruta_protegida.tsx` tienen en `-z-10`. Qué tanto se nota se regula con el token `--fondo-velo`. El Service Worker lo precachea, así que cambiar su nombre obliga a tocar `OTROS_RECURSOS` en `public/sw.js`, `public/sin-conexion.html` y a subir `VERSION`.

Dos reglas que nacen de ese fondo. **Las superficies que se apoyan sobre él son opacas**: nada de `bg-card/80`, `bg-background/60` ni `bg-muted/60` — el dibujo se transparentaba a través de tarjetas y pestañas. Por lo mismo no queda ningún `backdrop-blur` sobre una superficie opaca: no se ve y obliga al navegador a componer una capa aparte. Y **las superficies del tema claro viven en el matiz café de OKLCH** (58–80), no en el verde-oliva de antes, para que no convivan dos temperaturas en pantalla; la luminosidad se mantiene alta, el café está en el matiz y el croma. El verde institucional sigue intacto en `--primary`, `--ring` y las gráficas.

Ojo con `[data-slot="card"]` en `app/globals.css`: le pone a **toda** `<Card>` un `background-image` con dos paradas opacas. Eso es lo que las mantiene sólidas, pero también tapa cualquier `bg-*` de color que se le ponga a una tarjeta (`bg-emerald-500/10` y compañía quedan invisibles). Si alguna vez hace falta una tarjeta tintada, el tinte va en ese gradiente, no en una clase de fondo.

The backend is **mostly connected**. `DOCUMENTACION_ENDPOINTS.md` (repo root) is the authoritative API contract — read it before touching any connected module.

- **Connected to the real API:** auth (with refresh tokens + sessions), usuarios, puestos, modulos, acciones, bitácora, **tickets/tarifas** (emisión, historial, validación de QR), **cajas/gastos**, **donaciones**, **actividades/sectores**, **reportes**.
- **Still in-memory demo data** (`*_DEMO` constants in `tipos/index.ts`): the legacy `Usuario`/`Ticket`/`Visitante` families, kept only by screens that predate the backend. `ESTADISTICAS_SEMANA` is gone — reportes reads the real API now.
- `/sincronizacion` is not a backend module at all: it renders IndexedDB and is gated on `EmisionTickets`.

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
- `components/` (English) — **vendored libraries only**: shadcn/ui primitives (`components/ui/*`), `theme-provider.tsx` and the Monocharts charts (`components/mono-charts/*`, see "Reportes"). Do not put feature code here. `components.json` configures shadcn so any `npx shadcn add` lands in `components/ui`.
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
- `MODULOS_BACKEND` — keyed by backend module name (`EmisionTickets`, `Usuarios`, `Cajas`, `Donaciones`, `ActividadesParque`, `Reportes`, `Bitacora`); an item shows only if `mis-modulos` returns that module. Note the names are the backend's, not the route names — e.g. `EmisionTickets` maps to `/registro-visitantes` and `Cajas` to `/cierre-diario`.
- `MODULOS_SIN_BACKEND` — screens that are not a backend module. Only `Sincronizacion` is left, and it never will be one: it renders the device's IndexedDB and is gated on `EmisionTickets`. Anything the backend does administer belongs in `MODULOS_BACKEND`.

Sub-modules without their own screen (`Puestos` under `Usuarios`, `Gastos` under `Cajas`) are deliberately absent from both halves — they live as tabs inside the parent's page, so a nav entry would duplicate a route.

### Reportes

`REPORTES_FRONTEND.md` (repo root) is the contract — read it before touching this module; the endpoints are **not** in `DOCUMENTACION_ENDPOINTS.md`.

Two vías that must not be confused: `GET /reportes/:clave` (+ `/pdf`, `/excel`) runs one of the 19 catalog reports and never leaves the network, and `POST /reportes/interpretar` translates a written request — the only route that calls an AI, rate-limited and quota-bound. **Every button and filter hits the first one.** The written box renders only when `interpretacionDisponible` is true; without a key that route is a permanent 503.

- **The menu comes from `GET /reportes`, never from a hand-written list.** That endpoint already filters by permissions — the user needs `Reportes.Ver` *and* `Ver` on the module the data belongs to — so painting the catalog as-is guarantees no button can answer 403. An empty catalog is a permissions answer, not an error.
- **`ventas-a-medida` is the one report with no fixed shape.** It groups by whatever it is asked for (`dimension`, optional `dimension2` for a cross-tab, `metrica`, `tope`), which is what covers the cuts the catalog never anticipated — by guide, by tour type, "the top 5 sellers", and the **time grains** (`dia`, `semana`, `mes`, `diaSemana`, `horaDelDia`) that answer "how many tickets in August *and* September". Without those grains the only time breakdown in the system was `ventas-resumen`'s per-day rows, which returns both months mixed together — the question asked is precisely the one it cannot answer. Time grains sort chronologically unless a `tope` asks for a ranking; `DIMENSIONES_TIEMPO` carries each one's SQL as a literal `Prisma.Sql`, never a concatenated string. The freedom is bounded by construction: the dimension is not SQL nor a column name, it is a key that only indexes `DIMENSIONES`, the closed whitelist the four "ventas por …" reports already use. Its four parameters travel as ordinary filters (`tipo: 'opciones'` carrying its own `opciones`, and `tipo: 'numero'`), so the generic form draws them with nothing hardcoded.
- **Nothing knows any report.** `componentes/tabla_reporte.tsx` and `componentes/graficas_reporte.tsx` walk `seccion.columnas` and read `fila[columna.clave]`; there is not one column key written by hand, and there must not be. Arqueo columns vanish from the response for anyone without `Cajas.Editar`, and `usuarios-permisos` generates its columns from the database (`modulo_3`, `modulo_7`…). Same reason `resultado_reporte.tsx` iterates **all** `secciones`: six reports carry more than one table.
- **Money arrives as a decimal string and percentages as fractions.** `lib/formato_reporte.ts` is the only place that formats them; totals come from `seccion.totales` and are never recomputed in the client. KPIs arrive pre-formatted — printing them verbatim is what keeps the screen and the archived PDF saying the same thing.
- **Downloads go through `fetch` + blob** (`hooks/use_descarga_reporte.ts`). `window.open` and `<a href>` answer 401: the routes need `Authorization: Bearer` and a browser navigation doesn't send it. PDF is served `inline` (opens in a tab), xlsx as `attachment` (must be saved).
- **The filter form is built from `filtro.parametros`, not `filtro.clave`** — the date range is one control and two parameters, and sending `periodo=` returns 400. If a catalog behind a combo answers 403 (a user can hold `Reportes.Ver` without `Usuarios.Ver`), the control degrades to a text field instead of disappearing: the API also resolves filters by partial name.
- Error messages are shown intact. A 422 carries the candidates when a name is ambiguous, which is precisely what the user needs to fix it.

**The dashboard tab.** `GET /reportes/dashboard` (`src/reportes/dashboard/` in the backend) returns chart-shaped data — KPIs with period-over-period variation, and series carrying their own `tipoSugerido` — for `componentes/panel_graficas.tsx`, the tab that shows only charts. It is not a report: no PDF, no Excel, no columns, and it accepts only `desde`/`hasta`. **It invents no query**: everything comes from `consultas/ventas.consulta.ts`, the same helpers the 19 reports use, which is what makes a chart and a printed PDF of the same period agree. Points carry numeric `valor` (a chart draws pixels, it does not balance books) while each series carries its own exact `total` already formatted — never sum the points. The time series are grouped by `grano` (`dia`/`semana`/`mes`), which the server picks from the period's length unless the caller forces it — a year by days is 365 unreadable points — and it reuses `DIMENSIONES_TIEMPO`, so a monthly chart and a monthly table agree on which sale falls in which month. Panels the user lacks permission for arrive in `omitidos` with a reason rather than silently missing.

The panel draws exactly **four** of those series — one line, one pie, one horizontal bars, one columns — picked by `clave` in `GRAFICAS` (`ventas-por-periodo`, `personas-por-tipo`, `top-vendedores`, `ventas-por-dia-semana`; the line falls back to `donaciones-por-periodo` for users without `EmisionTickets.Ver`). It is always one calendar month (`rangoDelMes`, cut at today for the current month so the period-over-period comparison is fair) with `grano=dia` forced; the only control is a month navigator. The free date filter lives in the other tab.

**The predefined tab** (`componentes/reportes_predeterminados.tsx`) is three steps: period (`componentes/selector_periodo.tsx`, one range shared by every report that declares `rangoFechas`, validated with the API's own rules), report card, then filters + download. PDF/Excel go straight to `/pdf`/`/excel` with the query built from the form — the on-screen preview is optional, and it is hidden behind an "actualizar" prompt once the form no longer matches it, so the preview never shows figures the buttons wouldn't download. The period is written into the `parametros` of the report's own `rangoFechas` filter, never as hardcoded `desde`/`hasta`. Per-report filter values survive switching reports (sales reports share the same seven); `construirQueryReporte` drops whatever the new report doesn't declare.

**The AI tab** deliberately looks different (`BorderBeam` from `border-beam` on its tab trigger and around the search box, violet accents inside, `ThinkingOrb` from `thinking-orbs` while waiting). Both libraries get a pinned `theme`: on `auto` they follow the OS, and since the app never applies `.dark`, a dark-OS machine would paint light dots on the light card. The three tabs are `forceMount` + `data-[state=inactive]:hidden` so switching tabs doesn't throw away an AI answer that already spent quota.

**Charts — `components/mono-charts/`.** Vendored from [Monocharts](https://github.com/Subhan-code/Monocharts) (`mono-rounded-line/bar/donut/funnel`), on recharts, which was already a dependency. They were copied by hand because the CLI the repo documents, `npx @subhanhq/amicro@latest add mono-rounded-*`, cannot run: the published package declares no `bin`, and those names are not in its `registry/` either. Upstream they are showcase pieces with the data hardcoded and only `theme`/`compact` props, so two things changed: data arrives as `MonoPoint[]`, and color comes from the theme's `--chart-1..5` / `--primary` instead of white-on-black — the same technique as `components/ui/chart.tsx`, where recharts writes the value straight into the SVG attribute. Keep this folder free of domain logic; the deduction of what to plot lives in `componentes/graficas_reporte.tsx`.

**Never put a recharts child inside a fragment.** recharts 2.15 finds its axes, bars and cells through `react-is` 18.3, which doesn't recognize React 19 elements as fragments — an `<XAxis>` wrapped in `<>…</>` is silently ignored and the chart falls back to hidden default axes (columns lose their labels, a `layout="vertical"` chart collapses into one bar). Use one conditional per element instead. The value axis sizes itself with `anchoEjeValores`; a fixed width clipped `Q1,000` to `)1,000`.

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
