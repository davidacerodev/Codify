"use client";

/** Pantalla de acceso. En demo selecciona una identidad ficticia; en modo real envía las credenciales al cliente HTTP de autenticación. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  Pill,
  UserRound,
} from "lucide-react";
import { DEMO_MODE, roleLabels } from "@/lib/app-config";
import {
  DEMO_SESSION,
  DEMO_STORAGE,
  demoIds,
  seedDemo,
} from "@/features/workspace/demo";
import { signIn } from "@/features/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Notice, SubmitButton, Modal } from "@/components/ui/shared";
import type { Role } from "@/types";
const roles = [
  { value: "admin", icon: ShieldCheck },
  { value: "medico", icon: Stethoscope },
  { value: "farmaceutico", icon: Pill },
  { value: "paciente", icon: UserRound },
] as const;
export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("admin"),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false);
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "config")
      setError("El servicio de acceso todavía no está configurado.");
    if (reason === "session")
      setError("Tu sesión terminó. Inicia sesión de nuevo.");
    if (reason === "profile")
      setError(
        "No se encontró un perfil activo. Consulta al administrador de la aplicación.",
      );
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (DEMO_MODE) {
        if (!localStorage.getItem(DEMO_STORAGE))
          localStorage.setItem(DEMO_STORAGE, JSON.stringify(seedDemo()));
        sessionStorage.setItem(DEMO_SESSION, demoIds[role]);
      } else {
        const result = await signIn(email, password);
        if (!result.ok) throw new Error(result.error);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="auth-card">
        <span className="auth-icon">
          <LockKeyhole size={23} />
        </span>
        <h1>Bienvenido de nuevo</h1>
        <p className="muted">Ingresa a tu espacio de atención y gestión.</p>
        <form className="form-stack" onSubmit={submit}>
          {DEMO_MODE ? (
            <>
              <div className="demo-label">VERSIÓN DE DEMOSTRACIÓN</div>
              <p className="form-hint">
                Elige un rol para recorrer las pantallas. Utiliza únicamente
                datos ficticios.
              </p>
              <div className="role-options">
                {roles.map((r) => (
                  <button
                    className={role === r.value ? "selected" : ""}
                    type="button"
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                  >
                    <r.icon size={20} />
                    {roleLabels[r.value]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Field label="Correo electrónico">
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Escribe tu contraseña"
                />
              </Field>
            </>
          )}
          {error && <Notice>{error}</Notice>}
          <SubmitButton busy={busy} className="w-full">
            {DEMO_MODE ? "Entrar a la demostración" : "Iniciar sesión"}
            <ArrowRight size={17} className="ml-2" />
          </SubmitButton>
          <Link className="text-link auth-link" href="/recuperar-contrasena">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
        {DEMO_MODE && (
          <button className="reset-link" onClick={() => setReset(true)}>
            Restablecer datos de ejemplo
          </button>
        )}
      </section>
      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title="Restablecer demostración"
      >
        <p>
          Se reemplazarán los cambios de esta demostración por los datos de
          ejemplo.
        </p>
        <div className="actions">
          <Button variant="outline" onClick={() => setReset(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              try {
                localStorage.setItem(DEMO_STORAGE, JSON.stringify(seedDemo()));
                setReset(false);
                setError("");
              } catch {
                setError("El navegador no permite guardar los datos.");
                setReset(false);
              }
            }}
          >
            Restablecer
          </Button>
        </div>
      </Modal>
    </>
  );
}
