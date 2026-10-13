"use client";

/** Consulta y edición del perfil propio. El correo, documento y rol se muestran sin permitir cambiarlos desde esta pantalla. */
import Link from "next/link";
import { useState } from "react";
import {
  Pencil,
  ShieldCheck,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { roleLabels, dateLabel } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Field,
  Notice,
  SubmitButton,
  Badge,
} from "@/components/ui/shared";
export default function PerfilPage() {
  const {
    data: { profile },
    run,
    busy,
    demo,
  } = useWorkspace();
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="MI CUENTA"
        title="Perfil de usuario"
        description="Consulta tu información y mantén tus datos de contacto al día."
      />
      <div className="profile-grid">
        <section className="panel profile-summary">
          <span className="avatar large">
            {profile.nombre[0]}
            {profile.apellido[0]}
          </span>
          <h2>
            {profile.nombre} {profile.apellido}
          </h2>
          <p>{roleLabels[profile.rol]}</p>
          <Badge status="activo" />
          <hr />
          <div className="inline-icon">
            <ShieldCheck size={17} />
            <span>Enfermería Unitrópico</span>
          </div>
          <small className="muted">
            Cuenta creada el {dateLabel(profile.created_at)}
          </small>
        </section>
        <section className="panel form-panel">
          <div className="panel-title-row">
            <h2>Información personal</h2>
            {!editing && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
              >
                <Pencil size={15} className="mr-2" />
                Editar información
              </Button>
            )}
          </div>
          {success && <Notice kind="success">{success}</Notice>}
          {error && <Notice>{error}</Notice>}
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await run({
                  type: "profile.update",
                  nombre: String(f.get("nombre")),
                  apellido: String(f.get("apellido")),
                  telefono: String(f.get("telefono")),
                });
                setEditing(false);
                setSuccess("Tu información se actualizó correctamente.");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo guardar.",
                );
              }
            }}
          >
            <div className="form-grid">
              <Field label="Nombres">
                <input
                  key={profile.nombre + String(editing)}
                  name="nombre"
                  required
                  readOnly={!editing}
                  maxLength={80}
                  defaultValue={profile.nombre}
                />
              </Field>
              <Field label="Apellidos">
                <input
                  key={profile.apellido + String(editing)}
                  name="apellido"
                  required
                  readOnly={!editing}
                  maxLength={80}
                  defaultValue={profile.apellido}
                />
              </Field>
              <Field label="Correo electrónico">
                <input type="email" value={profile.email} readOnly />
              </Field>
              <Field label="Documento de identidad">
                <input value={profile.documento_identidad} readOnly />
              </Field>
              <Field label="Teléfono">
                <input
                  key={(profile.telefono || "") + String(editing)}
                  name="telefono"
                  type="tel"
                  maxLength={25}
                  readOnly={!editing}
                  defaultValue={profile.telefono || ""}
                  placeholder="Sin registrar"
                />
              </Field>
              <Field label="Rol del sistema">
                <input value={roleLabels[profile.rol]} readOnly />
              </Field>
            </div>
            {editing && (
              <>
                <p className="form-hint">
                  El correo, el documento y los permisos los administra el
                  responsable del sistema.
                </p>
                <div className="form-footer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setError("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <SubmitButton busy={busy}>Guardar cambios</SubmitButton>
                </div>
              </>
            )}
          </form>
        </section>
      </div>
      <section className="panel security-panel">
        <span className="stat-icon">
          <LockKeyhole size={21} />
        </span>
        <div>
          <h2>Seguridad de la cuenta</h2>
          <p className="muted">
            {demo
              ? "Las cuentas de demostración no utilizan contraseñas reales."
              : "Actualiza tu contraseña cuando lo necesites."}
          </p>
        </div>
        {!demo && (
          <Button asChild variant="outline">
            <Link href="/actualizar-contrasena">Cambiar contraseña</Link>
          </Button>
        )}
      </section>
    </>
  );
}
