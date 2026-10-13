"use client";

/** Consulta y edición de rangos de atención. Convierte los rangos en cupos y distingue los libres, ocupados y pasados. */
import { useEffect, useState } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { scheduleSlots } from "@/features/workspace/corrections";
import { today, dateLabel, isPastSlot } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  Field,
  Notice,
  Modal,
  SubmitButton,
  EmptyState,
} from "@/components/ui/shared";
import type { Horario } from "@/types";
export function ScheduleManager({ embedded = false }: { embedded?: boolean }) {
  const { data, person, available, run, busy } = useWorkspace();
  const own = data.profile.rol === "medico";
  const editable = own || data.profile.rol === "admin";
  const doctors = data.people.filter(
    (p) =>
      p.rol === "medico" &&
      !data.profiles.some((profile) => profile.id === p.id && !profile.activo),
  );
  const [doctor, setDoctor] = useState(
    own ? data.profile.id : doctors[0]?.id || "",
  );
  const [date, setDate] = useState(today());
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Horario | null>(null);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [loadError, setLoadError] = useState("");
  const [free, setFree] = useState<string[]>([]),
    [loading, setLoading] = useState(false);
  const rows = (data.horarios || [])
    .filter((h) => h.medico_id === doctor && h.fecha === date)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  const slots = scheduleSlots(data.horarios || [], doctor, date);
  // Vuelve a consultar cuando cambian médico, fecha, horarios o citas; ignora respuestas tardías.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setFree([]);
    if (!doctor || !date) {
      setLoading(false);
      return;
    }
    available(doctor, date)
      .then((r) => {
        if (active) setFree(r);
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "No se pudo consultar.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Solo volver a consultar cuando cambia la agenda o una cita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor, date, data.horarios, data.citas]);
  // Reutiliza el mismo formulario para publicar o modificar un rango.
  function edit(h: Horario | null) {
    setEditing(h);
    setError("");
    setOpen(true);
  }
  return (
    <section
      className="panel schedule-panel"
      aria-label="Disponibilidad de citas"
    >
      <div className="panel-heading">
        <div>
          <h2>
            {own ? "Mis horarios de atención" : "Disponibilidad de citas"}
          </h2>
          <p>
            {editable
              ? "Publica rangos de atención y administra los cupos de 30 minutos."
              : "Consulta los horarios publicados por cada médico. Hora de Colombia."}
          </p>
        </div>
        {editable && (
          <Button onClick={() => edit(null)} disabled={!doctor}>
            <Plus size={16} className="mr-2" />
            Publicar horario
          </Button>
        )}
      </div>
      <div className="schedule-body">
        {success && <Notice kind="success">{success}</Notice>}
        {loadError && <Notice>{loadError}</Notice>}
        <div className="form-grid">
          <Field label="Profesional de la agenda">
            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              disabled={own}
            >
              {!doctors.length && <option value="">Sin médicos activos</option>}
              {doctors
                .filter((p) => !own || p.id === data.profile.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {person(p.id)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Fecha de disponibilidad">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
        </div>
        <p className="form-hint">
          <CalendarDays size={15} className="inline mr-1" />
          {dateLabel(date)} ·{" "}
          {loading
            ? "Consultando cupos…"
            : loadError
              ? "Disponibilidad sin verificar"
              : `${free.length} cupos libres`}
        </p>
        {slots.length ? (
          <div className="availability-grid">
            {slots.map((time) => (
              <div
                key={time}
                className={`availability-slot ${isPastSlot(date, time) ? "past" : free.includes(time) ? "free" : "taken"}`}
              >
                <strong>{time}</strong>
                <small>
                  {loading
                    ? "Consultando"
                    : loadError
                      ? "Sin verificar"
                      : isPastSlot(date, time)
                        ? "Pasado"
                        : free.includes(time)
                          ? "Disponible"
                          : "Ocupado"}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No hay horarios publicados para esta fecha"
            text={
              editable
                ? "Publica un rango para habilitar cupos de atención."
                : "Selecciona otra fecha o consulta al médico."
            }
          />
        )}
        {(editable || !embedded) && rows.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rango de atención</th>
                  <th>Estado</th>
                  {editable && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.desde} – {h.hasta}
                    </td>
                    <td>{h.estado === "activo" ? "Publicado" : "Cancelado"}</td>
                    {editable && (
                      <td>
                        <div className="actions wrap">
                          {h.estado === "activo" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => edit(h)}
                              >
                                Editar horario
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      "¿Cancelar este horario? Si tiene citas, primero debes reprogramarlas o cancelarlas.",
                                    )
                                  )
                                    return;
                                  try {
                                    await run({
                                      type: "schedule.cancel",
                                      id: h.id,
                                    });
                                    setSuccess(
                                      "Horario cancelado. Sus cupos dejaron de estar disponibles.",
                                    );
                                    setLoadError("");
                                  } catch (e) {
                                    setLoadError(
                                      e instanceof Error
                                        ? e.message
                                        : "No se pudo cancelar.",
                                    );
                                  }
                                }}
                              >
                                Cancelar horario
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editable && (
          <p className="form-hint">
            No puedes retirar cupos con citas reservadas. Primero cancela o
            reprograma esas citas; el historial se conserva.
          </p>
        )}
      </div>
      <Modal
        open={open}
        title={editing ? "Editar horario" : "Publicar horario"}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        {open && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const selectedDate = String(f.get("fecha"));
                await run({
                  type: "schedule.save",
                  id: editing?.id,
                  medico_id: doctor,
                  fecha: selectedDate,
                  desde: String(f.get("desde")),
                  hasta: String(f.get("hasta")),
                });
                setDate(selectedDate);
                setOpen(false);
                setSuccess(
                  editing
                    ? "Horario actualizado."
                    : "Horario publicado. Los cupos ya se pueden consultar.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo guardar.",
                );
              }
            }}
          >
            <p>{person(doctor)} · Duración de cada cita: 30 minutos</p>
            <Field label="Fecha del horario">
              <input
                type="date"
                name="fecha"
                min={today()}
                defaultValue={editing?.fecha || date}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Hora de inicio">
                <input
                  type="time"
                  name="desde"
                  step={1800}
                  defaultValue={editing?.desde || "08:00"}
                  required
                />
              </Field>
              <Field label="Hora de fin">
                <input
                  type="time"
                  name="hasta"
                  step={1800}
                  defaultValue={editing?.hasta || "12:00"}
                  required
                />
              </Field>
            </div>
            <p className="form-hint">
              El inicio debe ser futuro. Un rango de 08:00 a 09:00 habilita
              citas a las 08:00 y 08:30.
            </p>
            {error && <Notice>{error}</Notice>}
            <SubmitButton busy={busy}>Guardar horario</SubmitButton>
          </form>
        )}
      </Modal>
    </section>
  );
}
