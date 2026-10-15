import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ProveedorAutenticacion } from "@/contexto/contexto_autenticacion";
import { BarraNavegacionInferior } from "@/componentes/barra_navegacion_inferior";
import { RegistroServiceWorker } from "@/componentes/registro_service_worker";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Parque Regional Municipal Actún Kan - Sistema de Tickets",
  description:
    "Sistema de gestión de tickets y visitantes del Parque Regional Municipal Actún Kan",
  manifest: "/manifest.json",
  // Ícono de ProPetén en la pestaña, generado desde public/Propeten.png.
  icons: {
    icon: [
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  // La interfaz ya está en español: la traducción automática del navegador
  // reescribe el DOM por debajo de React y rompe la página.
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#5a8557",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" translate="no" className="notranslate">
      {/* dvh y no vh: en el celular 100vh incluye la barra del navegador y el
          body quedaba más alto que la pantalla, con scroll en el login. */}
      <body className="font-sans antialiased min-h-dvh bg-background">
        <ProveedorAutenticacion>
          {children}
          <BarraNavegacionInferior />
          <Toaster position="top-center" richColors />
          <RegistroServiceWorker />
        </ProveedorAutenticacion>
        <Analytics />
      </body>
    </html>
  );
}
