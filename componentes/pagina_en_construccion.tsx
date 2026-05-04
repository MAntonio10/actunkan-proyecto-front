import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PaginaEnConstruccionProps {
  titulo: string
  descripcion: string
}

export function PaginaEnConstruccion({ titulo, descripcion }: PaginaEnConstruccionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Modulo en Construccion</h2>
          <p className="text-muted-foreground max-w-md">
            Este modulo esta siendo desarrollado. Pronto estara disponible con todas
            sus funcionalidades.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
