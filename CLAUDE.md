# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend for **Parque Nacional Actun Kan** ticketing / visitor system (Guatemala). Spanish-language UI, mobile-first PWA-style layout. There is **no backend**: all data is in-memory React state seeded from demo constants. Login, sync status, and audit logs are all mocked.

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
- `componentes/` (Spanish) — **domain/feature components** specific to this app (forms, ticket pass preview, nav bars, QR code, etc.). New domain components go here, in Spanish snake_case filenames.
- `components/` (English) — **shadcn/ui primitives only** (`components/ui/*`) plus `theme-provider.tsx`. Treat this as a vendored library; do not put feature code here. `components.json` configures shadcn so any `npx shadcn add` lands in `components/ui`.
- `contexto/` — React context providers (auth lives here).
- `tipos/index.ts` — **single source of truth** for domain types AND seed/demo data. All `*_DEMO` constants and lookup tables (`TIPOS_ACCESO`, `NACIONALIDADES`, `MODULOS_SISTEMA`, `USUARIOS_DEMO`, etc.) live here. Pages import these directly instead of fetching.
- `hooks/`, `lib/utils.ts` — small utilities (`cn` for class merging, `useToast`, `useMobile`).
- `styles/globals.css` — older copy; the live stylesheet imported by `app/layout.tsx` is `app/globals.css` (Tailwind v4 `@import 'tailwindcss'` + custom OKLCH "forest green" theme tokens).

### Auth & state model
`contexto/contexto_autenticacion.tsx` exposes `useAutenticacion()` — `usuario`, `estaAutenticado`, `iniciarSesion`, `cerrarSesion`, `historialAuditoria`, `registrarAuditoria`. The provider seeds state with `USUARIO_DEMO`, so the app boots already "logged in" for development. State is component-tree only — nothing is persisted to localStorage/IndexedDB. When adding a new "operation", call `registrarAuditoria` so it shows up in the auditoria module.

### Navigation
`BarraNavegacionInferior` (rendered by the root layout) is the primary mobile nav: 4 main routes + an expanding panel for secondary modules. It hides itself on `/login` via `usePathname()`. Desktop pages typically render `BarraNavegacionSuperior` themselves at the top of the page. New top-level modules need to be wired into one or both of these bars.

### Conventions
- Domain code is Spanish (variables, types, file names: `formulario_visitante_completo.tsx`, `usuario`, `cierre_diario`). Keep it Spanish — do not translate to English. shadcn primitives stay in English because they're vendored.
- Forms use react-hook-form + a zod schema declared at the top of the file (see `app/login/page.tsx`).
- Toasts: `sonner` (`Toaster` is mounted in the root layout); call `toast(...)` from `sonner`.
- Icons: `lucide-react`.
- Dark mode is hard-coded via `<html className="dark">` in `app/layout.tsx`; `next-themes` is installed but not currently driving the theme.
