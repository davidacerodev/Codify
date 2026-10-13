"use client";

/** Construye una entrega vinculada a una cita. Permite varios lotes y reutiliza el identificador de solicitud en los reintentos. */
import { useState } from "react";
import { Plus, Trash2, PackageCheck } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { dateLabel, today } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Field,
  Notice,
  SubmitButton,
  Badge,
  EmptyState,
  SearchInput,
} from "@/components/ui/shared";
type Row = { key: string; lote_id: string; cantidad: number };
export default function DespachoPage() {
  const { data, person, run, busy } = useWorkspace();
  const [search, setSearch] = useState(""),
    [citaId, setCitaId] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { key: "first", lote_id: "", cantidad: 1 },
  ]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const appointments = data.citas.filter(
    (c) =>
      ["confirmada", "completada"].includes(c.estado) &&
      person(c.paciente_id).toLowerCase().includes(search.toLowerCase()),
  );
  // Solo ofrece lotes con existencias, sin vencer y de medicamentos activos.
  const lots = data.lotes
    .filter(
      (l) =>
        l.cantidad > 0 &&
        l.fecha_vencimiento >= today() &&
        data.medicamentos.some(
          (m) => m.id === l.medicamento_id && m.activo !== false,
        ),
    )
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  const medication = (id: string) => data.medicamentos.find((m) => m.id === id);
  function edit(key: string, patch: Partial<Row>) {
    setRows((values) =>
      values.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  // Un mismo identificador se conserva hasta que la entrega se confirma; el backend debe hacerlo idempotente.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await run({
        type: "dispatch.create",
        cita_id: citaId,
        solicitud_id: requestId,
        items: rows.map(({ lote_id, cantidad }) => ({ lote_id, cantidad })),
      });
      setSuccess(
        "Despacho registrado. Las cantidades fueron descontadas del inventario.",
      );
      setRows([{ key: crypto.randomUUID(), lote_id: "", cantidad: 1 }]);
      setCitaId("");
      setSearch("");
      setRequestId(crypto.randomUUID());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar el despacho.",
      );
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ENTREGA Y TRAZABILIDAD"
        title="Despacho de medicamentos"
        description="Registra la entrega y actualiza las existencias en una sola operación."
      />
      {success && <Notice kind="success">{success}</Notice>}
      <form className="panel form-panel" onSubmit={submit}>
        <div className="section-title">
          <span className="stat-icon">
            <PackageCheck size={22} />
          </span>
          <div>
            <h2>Nueva entrega</h2>
            <p>Selecciona una cita confirmada o completada.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Buscar paciente">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Nombre del paciente…"
            />
          </Field>
          <Field label="Paciente y cita">
            <select
              required
              value={citaId}
              onChange={(e) => setCitaId(e.target.value)}
            >
              <option value="">Selecciona la atención</option>
              {appointments.map((c) => (
                <option key={c.id} value={c.id}>
                  {person(c.paciente_id)} · {dateLabel(c.fecha)} ·{" "}
                  {c.hora.slice(0, 5)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="table-scroll">
          <table className="dispatch-table">
            <thead>
              <tr>
                <th>Medicamento y lote</th>
                <th>Cantidad</th>
                <th>Disponible</th>
                <th>
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const lot = lots.find((l) => l.id === r.lote_id);
                return (
                  <tr key={r.key}>
                    <td>
                      <select
                        aria-label={`Medicamento ${i + 1}`}
                        required
                        value={r.lote_id}
                        onChange={(e) =>
                          edit(r.key, { lote_id: e.target.value })
                        }
                      >
                        <option value="">Selecciona un lote disponible</option>
                        {lots
                          .filter(
                            (l) =>
                              !rows.some(
                                (other) =>
                                  other.key !== r.key && other.lote_id === l.id,
                              ),
                          )
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {medication(l.medicamento_id)?.nombre} ·{" "}
                              {l.numero_lote} · vence{" "}
                              {dateLabel(l.fecha_vencimiento)}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Cantidad ${i + 1}`}
                        type="number"
                        min={1}
                        max={lot?.cantidad || 100000}
                        step={1}
                        required
                        value={r.cantidad || ""}
                        onChange={(e) =>
                          edit(r.key, { cantidad: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td>{lot ? `${lot.cantidad} uds.` : "—"}</td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Quitar medicamento ${i + 1}`}
                        className="icon-button danger-text"
                        disabled={rows.length === 1 || busy}
                        onClick={() =>
                          setRows(rows.filter((other) => other.key !== r.key))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || rows.length >= 30}
          onClick={() =>
            setRows([
              ...rows,
              { key: crypto.randomUUID(), lote_id: "", cantidad: 1 },
            ])
          }
        >
          <Plus size={16} className="mr-2" />
          Agregar medicamento
        </Button>
        <p className="form-hint">
          Los lotes se ordenan por vencimiento más próximo. Las cantidades se
          validan nuevamente al confirmar.
        </p>
        {error && <Notice>{error}</Notice>}
        <div className="form-footer">
          <span className="muted">
            {rows.reduce((sum, r) => sum + r.cantidad, 0)} unidad(es) en la
            entrega
          </span>
          <SubmitButton busy={busy} disabled={!citaId}>
            Confirmar despacho
          </SubmitButton>
        </div>
      </form>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Historial de despachos</h2>
            <p>Entregas registradas en el sistema</p>
          </div>
        </div>
        {data.despachos.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Medicamentos</th>
                  <th>Responsable</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.despachos.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{person(d.paciente_id)}</strong>
                    </td>
                    <td>
                      {data.items
                        .filter((item) => item.despacho_id === d.id)
                        .map((item) => (
                          <small className="cell-secondary" key={item.id}>
                            {medication(item.medicamento_id)?.nombre} ×{" "}
                            {item.cantidad}
                          </small>
                        ))}
                    </td>
                    <td>{person(d.farmaceutico_id)}</td>
                    <td>{dateLabel(d.fecha)}</td>
                    <td>
                      <Badge status={d.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aún no hay despachos"
            text="Las entregas confirmadas aparecerán aquí con su responsable."
          />
        )}
      </section>
    </>
  );
}
