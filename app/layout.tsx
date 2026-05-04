import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ProveedorAutenticacion } from "@/contexto/contexto_autenticacion";
import { BarraNavegacionInferior } from "@/componentes/barra_navegacion_inferior";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Parque Nacional Actun Kan - Sistema de Tickets",
  description:
    "Sistema de gestion de tickets y visitantes del Parque Nacional Actun Kan",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
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
    <html lang="es" className="dark">
      <body className="font-sans antialiased min-h-screen bg-background">
        <ProveedorAutenticacion>
          {children}
          <BarraNavegacionInferior />
          <Toaster position="top-center" richColors />
        </ProveedorAutenticacion>
        <Analytics />
      </body>
    </html>
  );
}
