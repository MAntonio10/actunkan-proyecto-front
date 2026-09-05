// Next.js App Router: este template se monta en cada navegación.
// Sin animación de entrada a propósito: al remontarse en cada cambio de
// módulo, cualquier `initial` se repetía como si se acabara de iniciar
// sesión, y arrastraba también al encabezado y a la barra inferior.
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
