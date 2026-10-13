"use client";

/** Historial administrativo con filtros y exportación CSV. Exporta solamente los eventos visibles después de filtrar. */
import { useState } from "react";
import { Download } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { dateLabel } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  SearchInput,
  EmptyState,
  Field,
} from "@/components/ui/shared";
export default function RegistrosPage() {
  const { data, person } = useWorkspace();
  const [search, setSearch] = useState(""),
    [module, setModule] = useState("todos"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const modules: Record<string, string> = {
    citas: "Citas",
    medicamentos: "Medicamentos",
    lotes: "Inventario",
    despachos: "Despachos",
    despacho_items: "Detalle de despacho",
    profiles: "Usuarios",
    sistema: "Sistema",
  };
  const localDay = (v: string) => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(v));
    return ["year", "month", "day"]
      .map((t) => p.find((x) => x.type === t)?.value)
      .join("-");
  };
  const filtered = data.auditoria.filter(
    (a) =>
      `${a.accion} ${person(a.usuario_id)}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (module === "todos" || a.tabla_afectada === module) &&
      (!from || localDay(a.created_at) >= from) &&
      (!to || localDay(a.created_at) <= to),
  );
  // Escapa celdas CSV y neutraliza valores que una hoja de cálculo podría interpretar como fórmulas.
  function exportCsv() {
    const escape = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    const rows = [
      ["Fecha", "Usuario", "Acción", "Módulo", "Registro"],
      ...filtered.map((a) => [
        a.created_at,
        person(a.usuario_id),
        a.accion,
        modules[a.tabla_afectada] || a.tabla_afectada,
        a.registro_id,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "historial-codify.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageHeader
        eyebrow="TRAZABILIDAD"
        title="Registros e historial"
        description="Consulta las acciones realizadas y sus responsables."
        action={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <Download size={16} className="mr-2" />
            Exportar vista
          </Button>
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar acción o usuario…"
          />
          <select
            className="filter-select"
            aria-label="Filtrar módulo"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          >
            <option value="todos">Todos los módulos</option>
            {Object.entries(modules).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="date-filters">
          <Field label="Desde">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setModule("todos");
              setFrom("");
              setTo("");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {dateLabel(a.created_at)}
                      <small className="cell-secondary">
                        {new Intl.DateTimeFormat("es-CO", {
                          timeZone: "America/Bogota",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(a.created_at))}
                      </small>
                    </td>
                    <td>
                      {a.usuario_id
                        ? person(a.usuario_id)
                        : "Administración del sistema"}
                    </td>
                    <td>
                      <strong>{a.accion}</strong>
                      <small className="cell-secondary">
                        Referencia: {a.registro_id.slice(0, 8)}
                      </small>
                    </td>
                    <td>
                      <span className="module-chip">
                        {modules[a.tabla_afectada] || a.tabla_afectada}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No hay movimientos con estos filtros"
            text="Las operaciones guardadas se registran automáticamente."
          />
        )}
        <div className="table-footer">
          {filtered.length} evento(s) · En Supabase se consultan los 500
          movimientos más recientes.
        </div>
      </section>
    </>
  );
}
