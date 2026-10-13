"use client";

/** Acciones de inventario e historial compartidos. La eliminación conserva trazabilidad y los ajustes registran un motivo. */
import { useState } from "react";
import { useWorkspace } from "@/features/workspace/provider";
import type { Medicamento, Lote } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Field,
  Modal,
  Notice,
  SubmitButton,
  SearchInput,
  EmptyState,
} from "@/components/ui/shared";
import { dateLabel } from "@/lib/app-config";
// Edita datos del medicamento o solicita la baja lógica con confirmación de código y motivo.
export function InventoryActions({
  medication: m,
}: {
  medication: Medicamento;
}) {
  const { run, busy } = useWorkspace();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null),
    [error, setError] = useState("");
  return (
    <>
      <div className="actions wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setMode("edit");
            setError("");
          }}
        >
          Editar medicamento
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setMode("delete");
            setError("");
          }}
        >
          Eliminar
        </Button>
      </div>
      <Modal
        open={!!mode}
        title={
          mode === "delete" ? "Eliminar medicamento" : "Editar medicamento"
        }
        onClose={() => {
          if (!busy) setMode(null);
        }}
      >
        {mode && (
          <form
            key={mode}
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                if (mode === "delete") {
                  if (String(f.get("confirmacion")) !== m.codigo)
                    throw new Error("Escribe el código exacto para confirmar.");
                  await run({
                    type: "medication.delete",
                    id: m.id,
                    motivo: String(f.get("motivo")),
                  });
                } else
                  await run({
                    type: "medication.update",
                    id: m.id,
                    nombre: String(f.get("nombre")),
                    codigo: String(f.get("codigo")),
                    unidad_medida: String(f.get("unidad")),
                    stock_minimo: Number(f.get("minimo")),
                    descripcion: String(f.get("descripcion")),
                  });
                setMode(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo guardar.",
                );
              }
            }}
          >
            {mode === "edit" ? (
              <>
                <Field label="Nombre del medicamento">
                  <input
                    name="nombre"
                    defaultValue={m.nombre}
                    required
                    maxLength={120}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Código del medicamento">
                    <input
                      name="codigo"
                      defaultValue={m.codigo}
                      required
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Presentación">
                    <input
                      name="unidad"
                      defaultValue={m.unidad_medida}
                      required
                      maxLength={60}
                    />
                  </Field>
                </div>
                <Field label="Stock mínimo">
                  <input
                    name="minimo"
                    type="number"
                    min={0}
                    max={100000}
                    step={1}
                    defaultValue={m.stock_minimo}
                    required
                  />
                </Field>
                <Field label="Descripción">
                  <textarea
                    name="descripcion"
                    defaultValue={m.descripcion || ""}
                    maxLength={500}
                  />
                </Field>
              </>
            ) : (
              <>
                <p>
                  Se retirará <strong>{m.nombre}</strong> del catálogo activo.
                  Sus lotes y movimientos se conservarán en el historial.
                </p>
                <Notice kind="info">
                  Solo se puede eliminar cuando todos sus lotes están en cero,
                  incluidos los vencidos. Registra primero la salida o el ajuste
                  correspondiente.
                </Notice>
                <Field label={`Escribe ${m.codigo} para confirmar`}>
                  <input name="confirmacion" autoComplete="off" required />
                </Field>
                <Field label="Motivo de eliminación">
                  <textarea name="motivo" required maxLength={300} />
                </Field>
              </>
            )}
            {error && <Notice>{error}</Notice>}
            <SubmitButton busy={busy}>
              {mode === "delete"
                ? "Confirmar eliminación"
                : "Guardar medicamento"}
            </SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
// El valor ingresado es la existencia total contada; se registra la diferencia como ajuste.
export function BatchEditor({ lot }: { lot: Lote }) {
  const { run, busy } = useWorkspace();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Actualizar lote
      </Button>
      <Modal
        open={open}
        title="Actualizar lote"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        {open && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setError("");
              try {
                await run({
                  type: "batch.update",
                  id: lot.id,
                  numero_lote: String(f.get("lote")),
                  cantidad: Number(f.get("cantidad")),
                  fecha_vencimiento: String(f.get("vencimiento")),
                  motivo: String(f.get("motivo")),
                });
                setOpen(false);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo actualizar.",
                );
              }
            }}
          >
            <Field label="Número de lote">
              <input
                name="lote"
                defaultValue={lot.numero_lote}
                required
                maxLength={60}
              />
            </Field>
            <div className="form-grid">
              <Field label="Existencias contadas">
                <input
                  name="cantidad"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  defaultValue={lot.cantidad}
                  required
                />
              </Field>
              <Field label="Vencimiento del lote">
                <input
                  type="date"
                  name="vencimiento"
                  defaultValue={lot.fecha_vencimiento}
                  required
                />
              </Field>
            </div>
            <p className="form-hint">
              Escribe la cantidad total contada, no la cantidad a sumar. La
              diferencia se registrará como entrada o salida por ajuste.
            </p>
            <Field label="Motivo del ajuste">
              <textarea name="motivo" required maxLength={300} />
            </Field>
            {error && <Notice>{error}</Notice>}
            <SubmitButton busy={busy}>Guardar ajuste</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
type Event = {
  id: string;
  date: string;
  kind: string;
  action: string;
  medicine: string;
  lot: string;
  quantity: string;
  actor: string;
  detail: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};
// Combina eventos de inventario e ítems entregados sin duplicar las salidas por despacho.
export function InventoryHistory() {
  const { data, person } = useWorkspace();
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("todos"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [selected, setSelected] = useState<Event | null>(null);
  const events: Event[] = (data.inventoryHistory || [])
    .filter((a) => a.tabla_afectada !== "despachos")
    .map((a) => {
      const n = a.datos_nuevos || {},
        b = a.datos_anteriores || {};
      const lot = data.lotes.find((l) => l.id === a.registro_id);
      const med = data.medicamentos.find(
        (m) =>
          m.id === (n.medicamento_id || lot?.medicamento_id || a.registro_id),
      );
      const delta =
        typeof n.delta === "number"
          ? n.delta
          : a.accion.includes("registrad") && typeof n.cantidad === "number"
            ? n.cantidad
            : null;
      const deleted = a.accion.includes("eliminado");
      return {
        id: a.id,
        date: a.created_at,
        kind: deleted
          ? "eliminacion"
          : delta !== null && delta < 0
            ? "salida"
            : delta !== null && delta > 0
              ? "entrada"
              : "cambio",
        action: a.accion,
        medicine: String(
          n.nombre || med?.nombre || b.nombre || "Registro anterior",
        ),
        lot: String(n.numero_lote || lot?.numero_lote || "—"),
        quantity: delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`,
        actor: person(a.usuario_id),
        detail: String(
          n.motivo ||
            (Object.keys(n).length
              ? "Cambio registrado en el inventario."
              : "Registro anterior sin detalle de cantidades."),
        ),
        before: a.datos_anteriores,
        after: a.datos_nuevos,
      };
    });
  for (const item of data.items) {
    const dispatch = data.despachos.find(
      (d) => d.id === item.despacho_id && d.estado === "entregado",
    );
    if (!dispatch) continue;
    events.push({
      id: item.id,
      date: dispatch.fecha,
      kind: "salida",
      action: "Salida por despacho",
      medicine:
        data.medicamentos.find((m) => m.id === item.medicamento_id)?.nombre ||
        "Medicamento histórico",
      lot:
        data.lotes.find((l) => l.id === item.lote_id)?.numero_lote ||
        "Lote histórico",
      quantity: `-${item.cantidad}`,
      actor: person(dispatch.farmaceutico_id),
      detail: `Entrega ${dispatch.id.slice(0, 8)} · Paciente: ${person(dispatch.paciente_id)}`,
    });
  }
  const visible = events
    .filter((e) => {
      const day = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Bogota",
      }).format(new Date(e.date));
      return (
        (kind === "todos" || e.kind === kind) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        `${e.medicine} ${e.lot} ${e.action} ${e.actor}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const labels: Record<string, string> = {
    nombre: "Nombre",
    codigo: "Código",
    unidad_medida: "Presentación",
    stock_minimo: "Stock mínimo",
    descripcion: "Descripción",
    numero_lote: "Lote",
    fecha_vencimiento: "Vencimiento",
    cantidad: "Cantidad",
    activo: "En catálogo",
  };
  return (
    <section className="panel inventory-history" id="historial">
      <div className="panel-heading">
        <div>
          <h2>Historial de inventario</h2>
          <p>
            Entradas, ajustes, eliminaciones y registros de salida por despacho.
          </p>
        </div>
      </div>
      <div className="schedule-body">
        <div className="history-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar movimiento, medicamento o lote…"
          />
          <Field label="Tipo de movimiento">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="todos">Todos los movimientos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="cambio">Cambios</option>
              <option value="eliminacion">Eliminaciones</option>
            </select>
          </Field>
          <Field label="Movimientos desde">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Movimientos hasta">
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      </div>
      {visible.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Medicamento / lote</th>
                <th>Unidades</th>
                <th>Responsable</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>
                    {dateLabel(e.date)}
                    <small className="cell-secondary">
                      {new Intl.DateTimeFormat("es-CO", {
                        timeZone: "America/Bogota",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(e.date))}
                    </small>
                  </td>
                  <td>{e.action}</td>
                  <td>
                    <strong>{e.medicine}</strong>
                    <small className="cell-secondary">{e.lot}</small>
                  </td>
                  <td>{e.quantity}</td>
                  <td>{e.actor}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelected(e)}
                    >
                      Ver movimiento
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No hay movimientos para estos filtros"
          text="Los cambios y despachos registrados aparecerán aquí."
        />
      )}
      <div className="table-footer">
        {visible.length} movimiento(s) · Los registros históricos se conservan
        al eliminar un medicamento.
      </div>
      <Modal
        open={!!selected}
        title="Detalle del movimiento"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <p>
              <strong>{selected.medicine}</strong> · {selected.action}
            </p>
            <p className="muted">{selected.detail}</p>
            {(selected.before || selected.after) && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Antes</th>
                      <th>Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(labels)
                      .filter(
                        ([k]) =>
                          selected.before?.[k] !== undefined ||
                          selected.after?.[k] !== undefined,
                      )
                      .map(([key, label]) => (
                        <tr key={key}>
                          <td>{label}</td>
                          <td>{String(selected.before?.[key] ?? "—")}</td>
                          <td>{String(selected.after?.[key] ?? "—")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}
