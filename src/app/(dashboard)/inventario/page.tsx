"use client";

/** Catálogo de medicamentos activos, búsqueda, alertas y consulta de lotes. Reutiliza los editores e historial de inventario. */
import Link from "next/link";
import {
  InventoryActions,
  BatchEditor,
  InventoryHistory,
} from "@/components/inventory-corrections";
import { useState } from "react";
import { Plus, PackagePlus, Pill, AlertTriangle, Boxes } from "lucide-react";
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
  Modal,
  SearchInput,
} from "@/components/ui/shared";
export default function InventarioPage() {
  const { data, stock, run, busy } = useWorkspace();
  const editable = ["admin", "medico", "farmaceutico"].includes(
    data.profile.rol,
  );
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("todos"),
    [selected, setSelected] = useState<string | null>(null),
    [entry, setEntry] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const activeMedicines = data.medicamentos.filter((m) => m.activo !== false);
  const medication = data.medicamentos.find((m) => m.id === selected);
  const state = (id: string, min: number) =>
    stock(id) === 0 ? "agotado" : stock(id) <= min ? "bajo" : "disponible";
  const filtered = activeMedicines.filter(
    (m) =>
      `${m.nombre} ${m.codigo} ${m.unidad_medida}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "todos" || state(m.id, m.stock_minimo) === status),
  );
  const expired = data.lotes.filter(
    (l) => l.fecha_vencimiento < today() && l.cantidad > 0,
  );
  return (
    <>
      <PageHeader
        eyebrow="MEDICAMENTOS E INSUMOS"
        title="Inventario"
        description="Consulta existencias, lotes y fechas de vencimiento."
        action={
          editable && (
            <Button asChild>
              <Link href="/inventario/nuevo">
                <Plus size={17} className="mr-2" />
                Registrar medicamento
              </Link>
            </Button>
          )
        }
      />
      <div className="compact-stats">
        <div>
          <Pill size={19} />
          <span>
            Referencias<strong>{activeMedicines.length}</strong>
          </span>
        </div>
        <div>
          <Boxes size={19} />
          <span>
            Unidades disponibles
            <strong>
              {activeMedicines.reduce((n, m) => n + stock(m.id), 0)}
            </strong>
          </span>
        </div>
        <div>
          <AlertTriangle size={19} />
          <span>
            Stock bajo o agotado
            <strong>
              {
                activeMedicines.filter((m) => stock(m.id) <= m.stock_minimo)
                  .length
              }
            </strong>
          </span>
        </div>
      </div>
      {success && <Notice kind="success">{success}</Notice>}
      {expired.length > 0 && (
        <Notice kind="info">
          Hay {expired.length} lote(s) vencido(s). Sus unidades no se cuentan
          como disponibles y no se pueden despachar.
        </Notice>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar medicamento o código…"
          />
          <select
            aria-label="Filtrar por stock"
            className="filter-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="bajo">Stock bajo</option>
            <option value="agotado">Agotado</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Presentación</th>
                  <th>Stock disponible</th>
                  <th>Estado</th>
                  <th>Lotes y acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.nombre}</strong>
                      <small className="cell-secondary">{m.codigo}</small>
                    </td>
                    <td>{m.unidad_medida}</td>
                    <td>
                      <strong className="stock-number">{stock(m.id)}</strong>
                      <small className="cell-secondary">
                        Mínimo {m.stock_minimo}
                      </small>
                    </td>
                    <td>
                      <Badge status={state(m.id, m.stock_minimo)} />
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected(m.id);
                          setEntry(false);
                          setError("");
                        }}
                      >
                        Ver lotes
                      </Button>
                      {editable && <InventoryActions medication={m} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No encontramos medicamentos"
            text="Cambia los filtros o registra un nuevo medicamento."
          />
        )}
        <div className="table-footer">
          {filtered.length} referencia(s) · El stock excluye lotes vencidos.
        </div>
      </section>
      <InventoryHistory />
      <Modal
        open={!!medication}
        title={
          entry
            ? "Registrar entrada de inventario"
            : medication?.nombre || "Lotes"
        }
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        {medication && (
          <>
            {error && <Notice>{error}</Notice>}
            {entry ? (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setError("");
                  try {
                    await run({
                      type: "stock.add",
                      medicamento_id: medication.id,
                      numero_lote: String(f.get("lote")),
                      cantidad: Number(f.get("cantidad")),
                      fecha_vencimiento: String(f.get("vencimiento")),
                    });
                    setSelected(null);
                    setSuccess(
                      "Entrada registrada. Las existencias se actualizaron.",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo registrar.",
                    );
                  }
                }}
              >
                <p>
                  {medication.nombre} · {medication.unidad_medida}
                </p>
                <Field label="Nuevo número de lote">
                  <input name="lote" required maxLength={60} />
                </Field>
                <div className="form-grid">
                  <Field label="Cantidad">
                    <input
                      name="cantidad"
                      type="number"
                      required
                      min={1}
                      max={100000}
                      step={1}
                    />
                  </Field>
                  <Field label="Fecha de vencimiento">
                    <input
                      name="vencimiento"
                      type="date"
                      required
                      min={today()}
                    />
                  </Field>
                </div>
                <div className="actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEntry(false)}
                  >
                    Volver
                  </Button>
                  <SubmitButton busy={busy}>Guardar entrada</SubmitButton>
                </div>
              </form>
            ) : (
              <>
                <p className="muted">
                  {medication.unidad_medida} · {medication.codigo}
                </p>
                <div className="batch-list">
                  {data.lotes
                    .filter((l) => l.medicamento_id === medication.id)
                    .map((l) => (
                      <div key={l.id}>
                        <div>
                          <strong>{l.numero_lote}</strong>
                          <small>Vence: {dateLabel(l.fecha_vencimiento)}</small>
                        </div>
                        <strong>{l.cantidad} uds.</strong>
                        {editable && <BatchEditor lot={l} />}
                        <Badge
                          status={
                            l.fecha_vencimiento < today()
                              ? "vencido"
                              : l.cantidad
                                ? "disponible"
                                : "agotado"
                          }
                        />
                      </div>
                    ))}
                </div>
                {editable && (
                  <Button onClick={() => setEntry(true)}>
                    <PackagePlus size={16} className="mr-2" />
                    Registrar nueva entrada
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
