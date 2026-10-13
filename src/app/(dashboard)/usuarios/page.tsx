"use client";

/** Administración de cuentas, roles y estado activo. La matriz muestra accesos de navegación; el backend debe autorizar las operaciones reales. */
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { roleLabels, allRoles, routeRoles } from "@/lib/app-config";
import type { Role } from "@/types";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  SearchInput,
  Badge,
  EmptyState,
  Modal,
  Field,
  SubmitButton,
  Notice,
} from "@/components/ui/shared";
export default function UsuariosPage() {
  const { data, person, run, busy, demo } = useWorkspace();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("todos"),
    [open, setOpen] = useState(false),
    [permissions, setPermissions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const user = data.profiles.find((p) => p.id === selected);
  const filtered = data.profiles.filter(
    (p) =>
      `${p.nombre} ${p.apellido} ${p.email} ${p.documento_identidad}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "todos" || p.rol === filter),
  );
  const close = () => {
    if (!busy) {
      setOpen(false);
      setSelected(null);
      setError("");
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRACIÓN"
        title="Gestión de usuarios"
        description="Administra las cuentas y los perfiles de acceso."
        action={
          <div className="actions">
            <Button variant="outline" onClick={() => setPermissions(true)}>
              <ShieldCheck size={16} className="mr-2" />
              Ver permisos
            </Button>
            <Button
              onClick={() => {
                setSelected(null);
                setError("");
                setOpen(true);
              }}
            >
              <Plus size={17} className="mr-2" />
              Nuevo usuario
            </Button>
          </div>
        }
      />
      {success && <Notice kind="success">{success}</Notice>}
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar nombre, correo o documento…"
          />
          <select
            className="filter-select"
            aria-label="Filtrar por rol"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="todos">Todos los roles</option>
            {allRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Documento</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{person(p.id)}</strong>
                      <small className="cell-secondary">{p.email}</small>
                    </td>
                    <td>{p.documento_identidad}</td>
                    <td>{roleLabels[p.rol]}</td>
                    <td>
                      <Badge status={p.activo ? "activo" : "inactivo"} />
                    </td>
                    <td>
                      {p.id === data.profile.id ? (
                        <span className="muted">Tu cuenta</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(p.id);
                            setError("");
                            setOpen(true);
                          }}
                        >
                          Administrar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay usuarios con ese filtro" />
        )}
        <div className="table-footer">
          {filtered.length} cuenta(s) encontrada(s)
        </div>
      </section>
      <Modal
        open={open}
        onClose={close}
        title={user ? "Administrar usuario" : "Crear usuario"}
      >
        <form
          key={selected || "new"}
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              if (user)
                await run({
                  type: "user.update",
                  id: user.id,
                  rol: String(f.get("rol")) as Role,
                  activo: f.get("activo") === "true",
                });
              else
                await run({
                  type: "user.create",
                  nombre: String(f.get("nombre")),
                  apellido: String(f.get("apellido")),
                  email: String(f.get("email")),
                  telefono: String(f.get("telefono")),
                  documento_identidad: String(f.get("documento")),
                  rol: String(f.get("rol")) as Role,
                  password: demo ? "Demo-only-1234" : String(f.get("password")),
                });
              setOpen(false);
              setSelected(null);
              setSuccess(
                user
                  ? "Permisos actualizados."
                  : "Usuario creado correctamente.",
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo guardar.");
            }
          }}
        >
          {user ? (
            <p>
              <strong>{person(user.id)}</strong>
              <br />
              <span className="muted">{user.email}</span>
            </p>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Nombres">
                  <input
                    name="nombre"
                    required
                    maxLength={80}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Apellidos">
                  <input
                    name="apellido"
                    required
                    maxLength={80}
                    autoComplete="off"
                  />
                </Field>
              </div>
              <Field label="Correo electrónico">
                <input name="email" type="email" required autoComplete="off" />
              </Field>
              <div className="form-grid">
                <Field label="Documento de identidad">
                  <input name="documento" required maxLength={30} />
                </Field>
                <Field label="Teléfono (opcional)">
                  <input name="telefono" type="tel" maxLength={25} />
                </Field>
              </div>
              {!demo && (
                <Field
                  label="Contraseña inicial"
                  hint="Entrégala por un canal privado y pide al usuario cambiarla desde su perfil."
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                  />
                </Field>
              )}
            </>
          )}
          <Field label="Rol">
            <select name="rol" defaultValue={user?.rol || "paciente"} required>
              {allRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </Field>
          {user && (
            <Field label="Estado">
              <select name="activo" defaultValue={String(user.activo)}>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Field>
          )}
          {error && <Notice>{error}</Notice>}
          <div className="actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </Button>
            <SubmitButton busy={busy}>
              {user ? "Guardar permisos" : "Crear usuario"}
            </SubmitButton>
          </div>
        </form>
      </Modal>
      <Modal
        open={permissions}
        title="Acceso por rol"
        onClose={() => setPermissions(false)}
      >
        <p className="muted">
          Los permisos se verifican también en el servidor y en la base de
          datos.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pantalla</th>
                {allRoles.map((r) => (
                  <th key={r}>{roleLabels[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(routeRoles).map(([route, roles]) => (
                <tr key={route}>
                  <td>{route}</td>
                  {allRoles.map((r) => (
                    <td key={r}>{roles.includes(r) ? "Sí" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
