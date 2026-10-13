"use client";

/** Formulario para solicitar un enlace de recuperación. Distingue el envío real del resultado simulado de la demo. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_MODE } from "@/lib/app-config";
import { requestPasswordReset } from "@/features/auth/client";
import { Field, Notice, SubmitButton } from "@/components/ui/shared";
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  useEffect(() => {
    if (window.location.search.includes("invalid=1"))
      setError(
        "El enlace no es válido o venció. Solicita uno nuevo y ábrelo en este navegador.",
      );
  }, []);
  return (
    <section className="auth-card">
      <h1>Recupera tu acceso</h1>
      <p className="muted">
        Te enviaremos un enlace para crear una nueva contraseña.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await requestPasswordReset(email);
            if (!r.ok) throw new Error(r.error);
            setSent(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo enviar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Correo electrónico">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {error && <Notice>{error}</Notice>}
        {sent && (
          <Notice kind="success">
            {DEMO_MODE
              ? "Flujo simulado: en demostración no se envían correos."
              : "Si existe una cuenta con ese correo, recibirás un enlace. Ábrelo en este navegador."}
          </Notice>
        )}
        <SubmitButton busy={busy} className="w-full">
          Enviar enlace
        </SubmitButton>
        <Link href="/login" className="text-link auth-link">
          Volver al inicio de sesión
        </Link>
      </form>
    </section>
  );
}
