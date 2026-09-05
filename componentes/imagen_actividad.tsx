"use client";

import { useEffect, useState } from "react";
import { ImageOff, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { type ImagenActividad as TipoImagen } from "@/tipos";

interface Props {
  idActividad: number;
  imagen: TipoImagen;
  /** Muestra el botón de eliminar (solo el autor puede). */
  onEliminar?: (imagen: TipoImagen) => void;
  eliminando?: boolean;
  /** Al pulsar la miniatura entrega el object URL ya cargado, para ampliarla
   *  sin volver a descargar la imagen. */
  onAmpliar?: (imagen: TipoImagen, url: string) => void;
  className?: string;
}

/**
 * Renderiza una imagen de actividad.
 *
 * El endpoint exige `Authorization: Bearer`, así que un `<img src="...">`
 * directo devolvería 401: hay que pedirla con fetch, convertirla a blob y usar
 * un object URL. El object URL se revoca al desmontar para no filtrar memoria.
 */
export function ImagenActividad({
  idActividad,
  imagen,
  onEliminar,
  eliminando,
  onAmpliar,
  className,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let objectUrl: string | null = null;

    setUrl(null);
    setError(false);

    api.actividades
      .getImagen(idActividad, imagen.id)
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [idActividad, imagen.id]);

  return (
    <div
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/40",
        className,
      )}
    >
      {error ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground p-2 text-center">
          <ImageOff className="h-6 w-6 opacity-50" />
          <span className="text-[10px] leading-tight">No se pudo cargar</span>
        </div>
      ) : !url ? (
        <div className="h-full w-full flex items-center justify-center">
          <Spinner className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : (
        // Es un blob local, no una ruta remota: next/image no aporta aquí.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={imagen.nombreOriginal}
          onClick={onAmpliar ? () => onAmpliar(imagen, url) : undefined}
          className={cn(
            "h-full w-full object-cover",
            onAmpliar && "cursor-zoom-in transition-transform hover:scale-105",
          )}
          loading="lazy"
        />
      )}

      {onEliminar && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={() => onEliminar(imagen)}
          disabled={eliminando}
          className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
          aria-label={`Eliminar ${imagen.nombreOriginal}`}
        >
          {eliminando ? <Spinner className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
