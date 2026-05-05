"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Eye, EyeOff, LogIn, History } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { type RolUsuario } from "@/tipos";
import Link from "next/link";

const esquemaLogin = z.object({
  usuario: z.string().min(3, "Usuario requerido"),
  contrasena: z.string().min(4, "Contrasena requerida"),
  rol: z.enum([
    "administrador",
    "taquillero",
    "supervisor",
    "guardia",
  ] as const),
  recordarme: z.boolean().optional(),
});

type FormularioLogin = z.infer<typeof esquemaLogin>;

// Usuarios demo para pruebas
const USUARIOS_DEMO = [
  {
    usuario: "luis.ramos",
    contrasena: "1234",
    rol: "taquillero",
    nombre: "Luis Ramos",
  },
  {
    usuario: "admin",
    contrasena: "admin",
    rol: "administrador",
    nombre: "Administrador",
  },
  {
    usuario: "supervisor",
    contrasena: "1234",
    rol: "supervisor",
    nombre: "Maria Garcia",
  },
];

export default function AutenticacionPage() {
  const router = useRouter();
  const { iniciarSesion } = useAutenticacion();
  const [enviando, setEnviando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormularioLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: {
      usuario: "",
      contrasena: "",
      rol: "taquillero",
      recordarme: false,
    },
  });

  const onSubmit = async (datos: FormularioLogin) => {
    setEnviando(true);

    // Simular autenticacion
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const usuarioEncontrado = USUARIOS_DEMO.find(
      (u) => u.usuario === datos.usuario && u.contrasena === datos.contrasena,
    );

    if (usuarioEncontrado) {
      iniciarSesion({
        id: Math.random().toString(36).substr(2, 9),
        nombre: usuarioEncontrado.nombre,
        rol: usuarioEncontrado.rol as RolUsuario,
        taquilla: usuarioEncontrado.rol === "taquillero" ? 1 : undefined,
        activo: true,
      });

      toast.success("Bienvenido", {
        description: `Sesion iniciada como ${usuarioEncontrado.nombre}`,
      });

      router.push("/registro-visitantes");
    } else {
      toast.error("Credenciales invalidas", {
        description: "Usuario o contrasena incorrectos",
      });
    }

    setEnviando(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Fondo decorativo: blobs organicos + viñeta calida */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 15% 10%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%),
            radial-gradient(ellipse 55% 50% at 90% 95%, color-mix(in oklch, var(--accent) 28%, transparent), transparent 65%),
            radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in oklch, var(--background) 80%, transparent), transparent 80%)
          `,
        }}
      />
      {/* Curva decorativa inferior */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-[420px] w-[150%] -translate-x-1/2 opacity-40"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
      >
        <path
          d="M0,260 C300,360 500,180 720,220 C940,260 1080,340 1200,300 L1200,400 L0,400 Z"
          fill="color-mix(in oklch, var(--primary) 18%, transparent)"
        />
        <path
          d="M0,320 C260,380 540,260 760,300 C980,340 1100,360 1200,340 L1200,400 L0,400 Z"
          fill="color-mix(in oklch, var(--accent) 22%, transparent)"
        />
      </svg>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo y titulo: medallon con anillo y resplandor */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-fit">
            <div
              aria-hidden
              className="absolute inset-0 -m-2 rounded-full blur-2xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)",
              }}
            />
            <div className="relative rounded-full bg-card/90 p-3 ring-2 ring-primary/30 shadow-lg shadow-primary/10 backdrop-blur">
              <Image
                src="/Propeten.png"
                alt="ProPeten"
                width={120}
                height={120}
                priority
                className="h-19 w-19 object-contain"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
              Parque Nacional
            </p>
            <h1 className="text-xl font-medium uppercase tracking-[0.35em] text-muted-foreground">
              ACTUN KAN
            </h1>
          </div>
        </div>

        {/* Formulario de login */}
        <Card className="card-realzada acento-superior border-border/60 bg-card/85 backdrop-blur-md">
          <CardHeader className="text-center pb-2 pt-6">
            <CardTitle className="flex items-center justify-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Iniciar Sesion
            </CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Usuario */}
              <div className="space-y-2">
                <Label
                  htmlFor="usuario"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Usuario
                </Label>
                <Input
                  id="usuario"
                  placeholder="nombre.usuario"
                  className="bg-muted/50 border-border/50 h-11"
                  autoComplete="username"
                  {...register("usuario")}
                />
                {errors.usuario && (
                  <p className="text-sm text-destructive">
                    {errors.usuario.message}
                  </p>
                )}
              </div>

              {/* Contrasena */}
              <div className="space-y-2">
                <Label
                  htmlFor="contrasena"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Contrasena
                </Label>
                <div className="relative">
                  <Input
                    id="contrasena"
                    type={mostrarContrasena ? "text" : "password"}
                    placeholder="********"
                    className="bg-muted/50 border-border/50 h-11 pr-10"
                    autoComplete="current-password"
                    {...register("contrasena")}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena(!mostrarContrasena)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {mostrarContrasena ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.contrasena && (
                  <p className="text-sm text-destructive">
                    {errors.contrasena.message}
                  </p>
                )}
              </div>

              {/* Rol */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Rol
                </Label>
                <Select
                  defaultValue="taquillero"
                  onValueChange={(valor) =>
                    setValue("rol", valor as RolUsuario)
                  }
                >
                  <SelectTrigger className="bg-muted/50 border-border/50 h-11">
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taquillero">Taquillero</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="guardia">Guardia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recordarme */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recordarme"
                  onCheckedChange={(checked) =>
                    setValue("recordarme", !!checked)
                  }
                />
                <Label htmlFor="recordarme" className="text-sm cursor-pointer">
                  Recordarme en este dispositivo
                </Label>
              </div>

              {/* Boton de envio */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold text-primary-foreground bg-gradient-to-r from-primary via-primary to-accent shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 hover:brightness-105"
                disabled={enviando}
              >
                {enviando ? (
                  <>
                    <Spinner className="mr-2 h-5 w-5" />
                    Iniciando sesion...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Iniciar Sesion
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Enlace a auditoria */}
        <div className="text-center">
          <Link
            href="/auditoria"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <History className="h-4 w-4" />
            Ver registro de auditoria
          </Link>
        </div>

        {/* Credenciales demo */}
        <Card className="border-dashed border-accent/40 bg-accent/10 backdrop-blur-sm">
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wider text-accent-foreground/80 text-center mb-2 font-semibold">
              Credenciales de prueba
            </p>
            <div className="text-xs text-center space-y-1">
              <p>
                <span className="font-mono font-semibold text-foreground">
                  luis.ramos
                </span>{" "}
                <span className="text-muted-foreground">/</span>{" "}
                <span className="font-mono">1234</span>{" "}
                <span className="text-muted-foreground">(Taquillero)</span>
              </p>
              <p>
                <span className="font-mono font-semibold text-foreground">
                  admin
                </span>{" "}
                <span className="text-muted-foreground">/</span>{" "}
                <span className="font-mono">admin</span>{" "}
                <span className="text-muted-foreground">(Administrador)</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
