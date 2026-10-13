'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

// Modificado respecto de shadcn: la lista ya no tiene alto fijo y el disparador
// ya no hereda el alto de la lista.
//
// El original era `h-9` en la lista y, en el disparador, un alto de calc
// 100% menos 1px -- escrito asi y no con la sintaxis de clase porque
// Tailwind escanea los comentarios y generaria la regla sin que nadie la use.
// Con
// `h-9` (36 px) y el relleno que le ponen las pantallas (`p-1`, 8 px entre las
// dos caras) al disparador le quedaban 27 px, pero su contenido necesita 34:
// 20 de la linea de texto, 12 del `py-1.5` y 2 del borde. El icono y el texto se
// salian del recuadro, y con ellos la pastilla del activo se desbordaba del
// fondo cafe de la lista: eso era el descuadre.
//
// Ahora el disparador se mide por su contenido y la lista crece con el, asi que
// el relleno de la lista se ve parejo alrededor de la pastilla sea cual sea el
// tamano de letra o el icono. `min-h-9` conserva el alto minimo de siempre.
//
// `items-stretch` (antes `items-center`) va con lo anterior: al no tener los
// disparadores un alto impuesto, en una pantalla angosta donde una etiqueta se
// parte en dos lineas el resto quedaria mas bajo y las pastillas desparejas.
// Estirandolos todos al alto de la fila vuelven a medir igual.
// Si vuelve a generar esta pieza con `npx shadcn add`, reaplique el cambio.
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground inline-flex min-h-9 w-fit items-stretch justify-center rounded-lg p-[3px]',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-sm text-foreground hover:border-primary/60 hover:text-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
