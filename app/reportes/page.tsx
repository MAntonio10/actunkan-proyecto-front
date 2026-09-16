'use client'

import { useEffect, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { BarChart3, FileBarChart, LayoutDashboard, Lock } from 'lucide-react'

import { BarraNavegacionSuperior } from '@/componentes/barra_navegacion_superior'
import { RutaProtegida } from '@/componentes/ruta_protegida'
import { PanelGraficas } from '@/componentes/panel_graficas'
import { PeticionReporteIA } from '@/componentes/peticion_reporte_ia'
import { ReportesPredeterminados } from '@/componentes/reportes_predeterminados'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAutenticacion } from '@/contexto/contexto_autenticacion'
import { api } from '@/lib/api'
import { mensajeDeError } from '@/lib/formato_reporte'
import type { RespuestaCatalogoReportes } from '@/tipos'

/**
 * Módulo de Reportes: gráficas del mes, reportes predeterminados y reportes
 * pedidos a la IA.
 *
 * El catálogo se pide acá, una vez, porque dos pestañas dependen de él: la de
 * predeterminados lo pinta y la de IA solo existe si `interpretacionDisponible`
 * (sin clave configurada esa ruta respondería 503 siempre). Ver
 * `REPORTES_FRONTEND.md`.
 *
 * Las pestañas se ocultan en vez de desmontarse (`forceMount`): cambiar de
 * pestaña no debe tirar una respuesta de la IA —que gastó cuota— ni el
 * reporte y los filtros que se estaban armando.
 */

const CLASE_PESTANA = 'mt-0 data-[state=inactive]:hidden'
// Más compactas en móvil: las tres tienen que caber en una fila de 360 px.
const CLASE_DISPARADOR = 'cursor-pointer gap-1.5 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm'

function ReportesContenido() {
  const { puedeAccion } = useAutenticacion()
  const puedeExportar = puedeAccion('Reportes', 'Exportar')

  const [catalogo, setCatalogo] = useState<RespuestaCatalogoReportes | null>(null)
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    api.reportes
      .catalogo()
      .then((respuesta) => {
        if (vigente) setCatalogo(respuesta)
      })
      .catch((error: unknown) => {
        if (vigente) {
          setErrorCatalogo(mensajeDeError(error, 'No se pudo cargar el catálogo de reportes.'))
        }
      })
      .finally(() => {
        if (vigente) setCargandoCatalogo(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  if (cargandoCatalogo) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Cargando catálogo de reportes…</p>
        </div>
      </div>
    )
  }

  if (errorCatalogo) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">No se pudo cargar el catálogo</CardTitle>
          <CardDescription>{errorCatalogo}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // El catálogo vacío no es un error: significa que le falta `Reportes.Ver` o
  // el permiso del módulo del que salen los datos.
  if (!catalogo || catalogo.datos.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Sin reportes disponibles</CardTitle>
          <CardDescription>
            Su cuenta no tiene ningún reporte habilitado. Además del permiso de Reportes hace
            falta el permiso <span className="font-medium">Ver</span> del módulo dueño de los
            datos (tickets, cajas, donaciones, bitácora, usuarios o actividades). Solicítelo al
            administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-primary" />
          Reportes
        </h1>
        <p className="text-muted-foreground">
          Gráficas del mes, reportes listos para descargar en PDF o Excel
          {catalogo.interpretacionDisponible && ' y reportes a medida con inteligencia artificial'}.
        </p>
      </div>

      <Tabs defaultValue="panel" className="space-y-6">
        {/* Con separación entre pestañas: juntas, el borde de la activa se
            pegaba al de la vecina y parecían una sola pieza. */}
        <TabsList className="h-auto w-full flex-wrap gap-1.5 p-1 sm:w-fit sm:gap-2">
          <TabsTrigger value="panel" className={CLASE_DISPARADOR}>
            <LayoutDashboard className="h-4 w-4" />
            Gráficas
          </TabsTrigger>
          <TabsTrigger value="catalogo" className={CLASE_DISPARADOR}>
            <FileBarChart className="h-4 w-4" />
            Predeterminados
          </TabsTrigger>
          {catalogo.interpretacionDisponible && (
            // El mismo halo del buscador de la IA: la distingue de las otras
            // dos sin cambiarle el color. Radix ubica sus pestañas por el DOM,
            // así que envolverla no le quita la navegación con flechas.
            // `min-w-fit`: el envoltorio recorta su contenido, y sin ancho
            // mínimo la fila lo encogía hasta cortar «Reportes con IA».
            <BorderBeam size="pulse-inner" theme="light" className="flex min-w-fit flex-1">
              <TabsTrigger value="peticion" className={CLASE_DISPARADOR}>
                <span className="sm:hidden">Con IA</span>
                <span className="hidden sm:inline">Reportes con IA</span>
              </TabsTrigger>
            </BorderBeam>
          )}
        </TabsList>

        <TabsContent value="panel" forceMount className={CLASE_PESTANA}>
          <PanelGraficas />
        </TabsContent>
        <TabsContent value="catalogo" forceMount className={CLASE_PESTANA}>
          <ReportesPredeterminados catalogo={catalogo} puedeExportar={puedeExportar} />
        </TabsContent>
        {catalogo.interpretacionDisponible && (
          <TabsContent value="peticion" forceMount className={CLASE_PESTANA}>
            <PeticionReporteIA puedeExportar={puedeExportar} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default function ReportesPage() {
  return (
    <RutaProtegida moduloRequerido="Reportes">
      <div className="min-h-screen">
        <BarraNavegacionSuperior />
        <main className="container mx-auto px-4 py-6">
          <ReportesContenido />
        </main>
      </div>
    </RutaProtegida>
  )
}
