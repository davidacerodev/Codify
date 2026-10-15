"use client";

/** Formulario de nueva contraseña. Comprueba coincidencia y longitud antes de delegar la actualización al backend. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { changePassword } from "@/features/auth/client";
import { Field, Notice, SubmitButton } from "@/components/ui/shared";
import { createClient } from "@/lib/supabase/client";
export default function ActualizarContrasenaPage() {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recoveryReady, setRecoveryReady] = useState(false),
    [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setRecoveryReady(Boolean(session));
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError(
          "El enlace no es válido o venció. Solicita uno nuevo y ábrelo en este navegador.",
        );
        return;
      }
      setRecoveryReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="auth-card">
      <h1>Nueva contraseña</h1>
      <p className="muted">Usa al menos 8 caracteres.</p>
      {!recoveryReady && !error && (
        <Notice>Verificando el enlace de recuperación…</Notice>
      )}
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (password !== repeat) {
            setError("Las contraseñas no coinciden.");
            return;
          }
          setBusy(true);
          try {
            const r = await changePassword(password);
            if (!r.ok) throw new Error(r.error);
            setDone(true);
            setPassword("");
            setRepeat("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo actualizar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {!done && (
          <>
            <Field label="Nueva contraseña">
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmar contraseña">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </Field>
          </>
        )}
        {error && <Notice>{error}</Notice>}
        {done ? (
          <Notice kind="success">
            Contraseña actualizada. Ya puedes volver a tu espacio.
          </Notice>
        ) : (
          <SubmitButton busy={busy || !recoveryReady}>
            Guardar contraseña
          </SubmitButton>
        )}
        <Link className="text-link" href={done ? "/dashboard" : "/login"}>
          {done ? "Ir al inicio" : "Volver al acceso"}
        </Link>
      </form>
    </section>
  );
}
