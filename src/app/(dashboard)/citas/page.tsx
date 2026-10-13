"use client";

/** Consulta y seguimiento de citas según el rol. El médico también administra su disponibilidad mediante ScheduleManager. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, CalendarDays, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { today, dateLabel, timeLabel } from "@/lib/app-config";
import { ScheduleManager } from "@/components/schedule-manager";
import type { Cita } from "@/types";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Badge,
  EmptyState,
  SearchInput,
  Modal,
  Field,
  Notice,
} from "@/components/ui/shared";
export default function CitasPage() {
  const { data, person, run, busy, available } = useWorkspace();
  const role = data.profile.rol;
  const [tab, setTab] = useState("Próximas"),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [date, setDate] = useState(""),
    [time, setTime] = useState("");
  const [free, setFree] = useState<string[]>([]),
    [loadingSlots, setLoadingSlots] = useState(false);
  const cita = data.citas.find((c) => c.id === selected);
  // Ofrece para reprogramar solo horas libres, excluyendo la reserva actual.
  useEffect(() => {
    let active = true;
    setFree([]);
    if (!cita || !date) return;
    setLoadingSlots(true);
    available(cita.medico_id, date, cita.id)
      .then((slots) => {
        if (active) setFree(slots);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo consultar la agenda.",
          );
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cita?.id, cita?.medico_id, date, data.horarios]);
  // Aplica periodo y búsqueda a las citas que el contexto ya limitó al rol.
  const filtered = data.citas
    .filter((c) => {
      const upcoming =
        c.fecha >= today() && !["cancelada", "completada"].includes(c.estado);
      return (
        (tab === "Todas" || (tab === "Próximas" ? upcoming : !upcoming)) &&
        `${person(c.paciente_id)} ${person(c.medico_id)} ${c.motivo}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort((a, b) =>
      tab === "Historial"
        ? (b.fecha + b.hora).localeCompare(a.fecha + a.hora)
        : (a.fecha + a.hora).localeCompare(b.fecha + b.hora),
    );
  // Envía los cambios y mantiene el diálogo abierto si la operación falla.
  async function update(fields: {
    estado?: Cita["estado"];
    fecha?: string;
    hora?: string;
  }) {
    if (!cita) return;
    setError("");
    try {
      await run({ type: "appointment.update", id: cita.id, ...fields });
      setSelected(null);
      setSuccess("La cita se actualizó correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ATENCIÓN"
        title={role === "paciente" ? "Mis citas" : "Gestión de citas"}
        description="Consulta, organiza y da seguimiento a las citas médicas."
        action={
          role !== "medico" && (
            <Button asChild>
              <Link href="/citas/nueva">
                <Plus size={17} className="mr-2" />
                Agendar cita
              </Link>
            </Button>
          )
        }
      />
      {role === "medico" && <ScheduleManager embedded />}
      {success && <Notice kind="success">{success}</Notice>}
      <section className="panel">
        <div className="table-toolbar">
          <div className="tabs" role="group" aria-label="Periodo de las citas">
            {["Próximas", "Historial", "Todas"].map((t) => (
              <button
                aria-pressed={tab === t}
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar cita o paciente…"
          />
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente / motivo</th>
                  <th>Profesional</th>
                  <th>Fecha y hora</th>
                  <th>Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{person(c.paciente_id)}</strong>
                      <small className="cell-secondary truncate-cell">
                        {c.motivo}
                      </small>
                    </td>
                    <td>{person(c.medico_id)}</td>
                    <td>
                      <span className="inline-icon">
                        <CalendarDays size={15} />
                        {dateLabel(c.fecha)}
                      </span>
                      <small className="cell-secondary">
                        {timeLabel(c.hora)}
                      </small>
                    </td>
                    <td>
                      <Badge status={c.estado} />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelected(c.id);
                          setDate(c.fecha);
                          setTime(c.hora.slice(0, 5));
                          setError("");
                        }}
                      >
                        Ver detalle <ArrowUpRight size={14} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No hay citas en esta vista"
            text="Prueba otro filtro o agenda una nueva atención."
          />
        )}
        <div className="table-footer">
          {filtered.length} cita{filtered.length !== 1 && "s"} encontrada
          {filtered.length !== 1 && "s"}
        </div>
      </section>
      <Modal
        open={!!cita}
        title="Detalle de la cita"
        onClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        {cita && (
          <>
            <dl className="detail-list">
              <div>
                <dt>Paciente</dt>
                <dd>{person(cita.paciente_id)}</dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>{person(cita.medico_id)}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{cita.motivo}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge status={cita.estado} />
                </dd>
              </div>
            </dl>
            {error && <Notice>{error}</Notice>}
            {!["cancelada", "completada"].includes(cita.estado) && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void update({ fecha: date, hora: time });
                  }}
                  className="form-stack"
                >
                  <h3>Reprogramar</h3>
                  <div className="form-grid">
                    <Field label="Nueva fecha">
                      <input
                        type="date"
                        min={today()}
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Nueva hora">
                      <select
                        required
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      >
                        <option value="">Selecciona un cupo libre</option>
                        {free.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <p className="form-hint">
                    {loadingSlots
                      ? "Consultando disponibilidad…"
                      : free.length
                        ? "Solo se muestran cupos libres publicados por el médico."
                        : "No hay cupos libres para esta fecha."}
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy || loadingSlots || !free.includes(time)}
                    type="submit"
                  >
                    Guardar nuevo horario
                  </Button>
                </form>
                <div className="actions wrap">
                  {role !== "paciente" && (
                    <>
                      {cita.estado === "pendiente" && (
                        <Button
                          disabled={busy}
                          onClick={() => void update({ estado: "confirmada" })}
                        >
                          Confirmar cita
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void update({ estado: "completada" })}
                      >
                        Marcar completada
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Confirmas que quieres cancelar esta cita?",
                        )
                      )
                        void update({ estado: "cancelada" });
                    }}
                  >
                    Cancelar cita
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
