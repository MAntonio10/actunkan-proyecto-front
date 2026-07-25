"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  Eye,
  EyeOff,
  LogIn,
  KeyRound,
  ArrowLeft,
  Mail,
  CheckCircle2,
  RefreshCw,
  Lock,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";
import { useAutenticacion } from "@/contexto/contexto_autenticacion";
import { api } from "@/lib/api";

const esquemaLogin = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Ingrese un correo válido"),
  contrasena: z.string().min(1, "La contraseña es requerida"),
  recordarme: z.boolean().optional(),
});

const esquemaSolicitarCodigo = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Ingrese un correo válido"),
});

const esquemaRestablecerContrasena = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Ingrese un correo válido"),
  codigo: z
    .string()
    .min(1, "El código es requerido")
    .length(6, "El código debe tener exactamente 6 dígitos"),
  nuevaContrasena: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmarContrasena: z.string().min(1, "Confirme la nueva contraseña"),
}).refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden",
  path: ["confirmarContrasena"],
});

type FormularioLogin = z.infer<typeof esquemaLogin>;
type FormularioSolicitarCodigo = z.infer<typeof esquemaSolicitarCodigo>;
type FormularioRestablecerContrasena = z.infer<typeof esquemaRestablecerContrasena>;

type VistaAuth = "login" | "solicitar" | "restablecer";

export default function AutenticacionPage() {
  const router = useRouter();
  const { iniciarSesion, estaAutenticado, cargando } = useAutenticacion();
  
  const [vista, setVista] = useState<VistaAuth>("login");
  const [enviando, setEnviando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  
  const [mostrarNuevaContrasena, setMostrarNuevaContrasena] = useState(false);
  const [mostrarConfirmarContrasena, setMostrarConfirmarContrasena] = useState(false);
  
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [codigoEsValido, setCodigoEsValido] = useState<boolean | null>(null);

  useEffect(() => {
    if (!cargando && estaAutenticado) {
      router.replace("/usuarios");
    }
  }, [cargando, estaAutenticado, router]);

  // Formulario Iniciar Sesión
  const formLogin = useForm<FormularioLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: {
      correo: "",
      contrasena: "",
      recordarme: false,
    },
  });

  // Formulario Solicitar Código
  const formSolicitar = useForm<FormularioSolicitarCodigo>({
    resolver: zodResolver(esquemaSolicitarCodigo),
    defaultValues: {
      correo: "",
    },
  });

  // Formulario Restablecer Contraseña
  const formRestablecer = useForm<FormularioRestablecerContrasena>({
    resolver: zodResolver(esquemaRestablecerContrasena),
    defaultValues: {
      correo: "",
      codigo: "",
      nuevaContrasena: "",
      confirmarContrasena: "",
    },
  });

  // Submit Login
  const onSubmitLogin = async (datos: FormularioLogin) => {
    setEnviando(true);
    try {
      const usuarioLogueado = await iniciarSesion(datos.correo, datos.contrasena, datos.recordarme);
      toast.success("¡Bienvenido al Sistema!", {
        description: `Sesión iniciada como ${usuarioLogueado.nombre}`,
      });
      router.push("/usuarios");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al iniciar sesión";
      toast.error("Credenciales inválidas", {
        description: mensaje,
      });
    } finally {
      setEnviando(false);
    }
  };

  // Submit Solicitar Código
  const onSubmitSolicitar = async (datos: FormularioSolicitarCodigo) => {
    setEnviando(true);
    try {
      const res = await api.auth.solicitarCodigoRestablecimiento(datos.correo);
      toast.success("Código enviado", {
        description: res.mensaje || `Se ha enviado un código a ${datos.correo}`,
      });
      formRestablecer.setValue("correo", datos.correo);
      setCodigoEsValido(null);
      setVista("restablecer");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al enviar código";
      toast.error("Error al enviar código", {
        description: mensaje,
      });
    } finally {
      setEnviando(false);
    }
  };

  // Validar código manualmente
  const handleValidarCodigo = async () => {
    const correo = formRestablecer.getValues("correo");
    const codigo = formRestablecer.getValues("codigo");

    if (!correo || !codigo || codigo.length !== 6) {
      toast.error("Ingrese correo y un código válido de 6 dígitos");
      return;
    }

    setValidandoCodigo(true);
    try {
      const res = await api.auth.validarCodigoRestablecimiento(correo, codigo);
      if (res.valido) {
        setCodigoEsValido(true);
        toast.success("Código válido", {
          description: res.mensaje || "El código ingresado es correcto.",
        });
      } else {
        setCodigoEsValido(false);
        toast.error("Código inválido", {
          description: res.mensaje || "El código es incorrecto o ha expirado.",
        });
      }
    } catch (err: unknown) {
      setCodigoEsValido(false);
      const mensaje = err instanceof Error ? err.message : "Error al validar el código";
      toast.error("Código inválido o expirado", {
        description: mensaje,
      });
    } finally {
      setValidandoCodigo(false);
    }
  };

  // Submit Restablecer Contraseña
  const onSubmitRestablecer = async (datos: FormularioRestablecerContrasena) => {
    setEnviando(true);
    try {
      const res = await api.auth.restablecerContrasena(
        datos.correo,
        datos.codigo,
        datos.nuevaContrasena
      );
      toast.success("Contraseña restablecida", {
        description: res.mensaje || "Ya puede iniciar sesión con su nueva contraseña.",
      });
      formLogin.setValue("correo", datos.correo);
      setVista("login");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al restablecer la contraseña";
      toast.error("No se pudo restablecer la contraseña", {
        description: mensaje,
      });
    } finally {
      setEnviando(false);
    }
  };

  // Reenviar código
  const handleReenviarCodigo = async () => {
    const correo = formRestablecer.getValues("correo");
    if (!correo) return;

    setEnviando(true);
    try {
      const res = await api.auth.solicitarCodigoRestablecimiento(correo);
      toast.success("Código reenviado", {
        description: res.mensaje || `Se ha enviado un nuevo código a ${correo}`,
      });
      setCodigoEsValido(null);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al reenviar código";
      toast.error("Error al reenviar código", {
        description: mensaje,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Fondo decorativo */}
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
        {/* Logo y Titular */}
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
            <h1 className="text-xl font-bold uppercase tracking-[0.35em] text-foreground">
              ACTUN KAN
            </h1>
          </div>
        </div>

        {/* VISTA 1: FORMULARIO DE LOGIN */}
        {vista === "login" && (
          <Card className="card-realzada acento-superior border-border/60 bg-card/85 backdrop-blur-md">
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="flex items-center justify-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Iniciar Sesión
              </CardTitle>
              <CardDescription>
                Ingrese sus credenciales de acceso al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={formLogin.handleSubmit(onSubmitLogin)} className="space-y-4">
                {/* Correo Electrónico */}
                <div className="space-y-2">
                  <Label
                    htmlFor="correo"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Correo Electrónico
                  </Label>
                  <Input
                    id="correo"
                    type="email"
                    placeholder="usuario@aktunkan.com"
                    className="bg-muted/50 border-border/50 h-11"
                    autoComplete="email"
                    {...formLogin.register("correo")}
                  />
                  {formLogin.formState.errors.correo && (
                    <p className="text-sm text-destructive">
                      {formLogin.formState.errors.correo.message}
                    </p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="contrasena"
                      className="text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      Contraseña
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        const correoActual = formLogin.getValues("correo");
                        if (correoActual) {
                          formSolicitar.setValue("correo", correoActual);
                        }
                        setVista("solicitar");
                      }}
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      ¿Olvidó su contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="contrasena"
                      type={mostrarContrasena ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-muted/50 border-border/50 h-11 pr-10"
                      autoComplete="current-password"
                      {...formLogin.register("contrasena")}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena(!mostrarContrasena)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {mostrarContrasena ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formLogin.formState.errors.contrasena && (
                    <p className="text-sm text-destructive">
                      {formLogin.formState.errors.contrasena.message}
                    </p>
                  )}
                </div>

                {/* Recordarme */}
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="recordarme"
                    onCheckedChange={(checked) =>
                      formLogin.setValue("recordarme", !!checked)
                    }
                  />
                  <Label htmlFor="recordarme" className="text-sm cursor-pointer">
                    Recordarme en este dispositivo
                  </Label>
                </div>

                {/* Botón de envío */}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 cursor-pointer"
                  disabled={enviando}
                >
                  {enviando ? (
                    <>
                      <Spinner className="mr-2 h-5 w-5" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      Iniciar Sesión
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* VISTA 2: SOLICITAR CÓDIGO DE RESTABLECIMIENTO */}
        {vista === "solicitar" && (
          <Card className="card-realzada acento-superior border-border/60 bg-card/85 backdrop-blur-md">
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="flex items-center justify-center gap-2 text-lg">
                <KeyRound className="h-5 w-5 text-primary" />
                ¿Olvidó su contraseña?
              </CardTitle>
              <CardDescription>
                Ingrese su correo electrónico para recibir un código de verificación de 6 dígitos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={formSolicitar.handleSubmit(onSubmitSolicitar)} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="solicitar-correo"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Correo Electrónico Registrado
                  </Label>
                  <div className="relative">
                    <Input
                      id="solicitar-correo"
                      type="email"
                      placeholder="usuario@aktunkan.com"
                      className="bg-muted/50 border-border/50 h-11 pl-10"
                      autoComplete="email"
                      {...formSolicitar.register("correo")}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {formSolicitar.formState.errors.correo && (
                    <p className="text-sm text-destructive">
                      {formSolicitar.formState.errors.correo.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 cursor-pointer"
                  disabled={enviando}
                >
                  {enviando ? (
                    <>
                      <Spinner className="mr-2 h-5 w-5" />
                      Enviando código...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-5 w-5" />
                      Enviar Código de Verificación
                    </>
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVista("login")}
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Volver a Iniciar Sesión
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* VISTA 3: VALIDAR CÓDIGO Y RESTABLECER CONTRASEÑA */}
        {vista === "restablecer" && (
          <Card className="card-realzada acento-superior border-border/60 bg-card/85 backdrop-blur-md">
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="flex items-center justify-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" />
                Restablecer Contraseña
              </CardTitle>
              <CardDescription>
                Ingrese el código de 6 dígitos enviado a su correo y establezca su nueva contraseña
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={formRestablecer.handleSubmit(onSubmitRestablecer)} className="space-y-4">
                {/* Correo Electrónico */}
                <div className="space-y-2">
                  <Label
                    htmlFor="restablecer-correo"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Correo Electrónico
                  </Label>
                  <Input
                    id="restablecer-correo"
                    type="email"
                    className="bg-muted/50 border-border/50 h-10 text-sm"
                    {...formRestablecer.register("correo")}
                  />
                  {formRestablecer.formState.errors.correo && (
                    <p className="text-xs text-destructive">
                      {formRestablecer.formState.errors.correo.message}
                    </p>
                  )}
                </div>

                {/* Código de Verificación */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="codigo"
                      className="text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      Código de 6 dígitos
                    </Label>
                    <button
                      type="button"
                      onClick={handleValidarCodigo}
                      disabled={validandoCodigo}
                      className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {validandoCodigo ? (
                        <Spinner className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Verificar código
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="codigo"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      className="bg-muted/50 border-border/50 h-11 text-center text-lg tracking-[0.3em] font-mono"
                      {...formRestablecer.register("codigo")}
                      onChange={(e) => {
                        formRestablecer.setValue("codigo", e.target.value);
                        setCodigoEsValido(null);
                      }}
                    />
                    {codigoEsValido === true && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  {formRestablecer.formState.errors.codigo && (
                    <p className="text-xs text-destructive">
                      {formRestablecer.formState.errors.codigo.message}
                    </p>
                  )}
                </div>

                {/* Nueva Contraseña */}
                <div className="space-y-2">
                  <Label
                    htmlFor="nuevaContrasena"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="nuevaContrasena"
                      type={mostrarNuevaContrasena ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-muted/50 border-border/50 h-11 pr-10"
                      {...formRestablecer.register("nuevaContrasena")}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarNuevaContrasena(!mostrarNuevaContrasena)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {mostrarNuevaContrasena ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formRestablecer.formState.errors.nuevaContrasena && (
                    <p className="text-xs text-destructive">
                      {formRestablecer.formState.errors.nuevaContrasena.message}
                    </p>
                  )}
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmarContrasena"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Confirmar Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmarContrasena"
                      type={mostrarConfirmarContrasena ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-muted/50 border-border/50 h-11 pr-10"
                      {...formRestablecer.register("confirmarContrasena")}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmarContrasena(!mostrarConfirmarContrasena)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {mostrarConfirmarContrasena ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formRestablecer.formState.errors.confirmarContrasena && (
                    <p className="text-xs text-destructive">
                      {formRestablecer.formState.errors.confirmarContrasena.message}
                    </p>
                  )}
                </div>

                {/* Botón Guardar Nueva Contraseña */}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 cursor-pointer"
                  disabled={enviando}
                >
                  {enviando ? (
                    <>
                      <Spinner className="mr-2 h-5 w-5" />
                      Restableciendo contraseña...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-5 w-5" />
                      Restablecer Contraseña
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={handleReenviarCodigo}
                    disabled={enviando}
                    className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reenviar código
                  </button>

                  <button
                    type="button"
                    onClick={() => setVista("login")}
                    className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Iniciar Sesión
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
