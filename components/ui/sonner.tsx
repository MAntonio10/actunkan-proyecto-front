'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

/**
 * Los avisos van **siempre en oscuro**, fijado a mano. Decisión del proyecto.
 *
 * Esto es una pieza de shadcn modificada: un `npx shadcn add sonner` la pisa.
 *
 * Por qué fijo y no `useTheme()`: el tema acá no decide «claro u oscuro» de la
 * aplicación —que es siempre clara— sino **cuánto color tiene el aviso**. Con
 * `richColors` (ver `app/layout.tsx`), la paleta clara de sonner pinta el éxito,
 * el error y la advertencia en tonos pálidos que apenas se distinguen entre sí;
 * la oscura los da saturados, que es como tienen que leerse de un vistazo en la
 * taquilla.
 *
 * Antes salía de `useTheme()` con 'system' por omisión, lo que hacía que el color
 * dependiera del tema del sistema operativo de cada equipo: el mismo aviso se
 * veía saturado en una tablet y pálido en otra, sin que nada en el código lo
 * explicara. Fijarlo quita esa variable.
 *
 * Tampoco se declaran `--normal-bg` ni `--normal-text`. Estaban apuntando a
 * `--popover`, el color claro de la aplicación, y con el resto de los avisos en
 * oscuro habrían dejado los de `toast.loading` claros en medio. Sin ellos,
 * sonner usa su propia paleta oscura y el conjunto queda parejo.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return <Sonner theme="dark" className="toaster group" {...props} />
}

export { Toaster }
