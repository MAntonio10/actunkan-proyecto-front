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
import { LogoActunKan } from "@/componentes/logo_actun_kan";
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo y titulo */}
        <div className="text-center space-y-2">
          <LogoActunKan className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">PARQUE NACIONAL</h1>
          <p className="text-primary font-semibold tracking-wider">ACTUN KAN</p>
        </div>

        {/* Formulario de login */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="text-center pb-2">
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
                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
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
        <Card className="bg-muted/30 border-dashed border-border/50">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Credenciales de prueba:
            </p>
            <div className="text-xs text-center space-y-1">
              <p>
                <span className="text-foreground font-medium">luis.ramos</span>{" "}
                / 1234 (Taquillero)
              </p>
              <p>
                <span className="text-foreground font-medium">admin</span> /
                admin (Administrador)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
