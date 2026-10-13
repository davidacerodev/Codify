"use client";

/** Agendamiento en tres pasos: elegir un cupo publicado, confirmar los datos y mostrar el resultado de la solicitud. */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { today, isPastSlot, dateLabel } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Field,
  Notice,
  SubmitButton,
} from "@/components/ui/shared";
export default function NuevaCitaPage() {
  const { data, run, busy, person, available } = useWorkspace();
  const doctors = data.people.filter(
      (p) =>
        p.rol === "medico" &&
        !data.profiles.some(
          (profile) => profile.id === p.id && !profile.activo,
        ),
    ),
    patients = data.people.filter(
      (p) =>
        p.rol === "paciente" &&
        !data.profiles.some(
          (profile) => profile.id === p.id && !profile.activo,
        ),
    );
  const [doctor, setDoctor] = useState(doctors[0]?.id || ""),
    [patient, setPatient] = useState(
      data.profile.rol === "paciente" ? data.profile.id : "",
    );
  const [date, setDate] = useState(today()),
    [time, setTime] = useState(""),
    [reason, setReason] = useState("");
  const [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [slots, setSlots] = useState<string[]>([]),
    [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  // Descarta consultas anteriores al cambiar de médico o fecha para evitar cupos desactualizados.
  useEffect(() => {
    let active = true;
    setTime("");
    setLoading(true);
    setError("");
    if (!doctor) {
      setLoading(false);
      return;
    }
    available(doctor, date)
      .then((r) => {
        if (active) setSlots(r);
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
          setSlots([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // La consulta se renueva al cambiar profesional o fecha, no al editar otros campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor, date]);
  const first = new Date(month + "-01T12:00:00Z");
  const days = new Date(
    first.getUTCFullYear(),
    first.getUTCMonth() + 1,
    0,
  ).getDate();
  const offset = (first.getUTCDay() + 6) % 7;
  function moveMonth(amount: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + amount);
    setMonth(d.toISOString().slice(0, 7));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!time || !doctor || !patient) {
      setError("Selecciona paciente, profesional y horario.");
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    try {
      await run({
        type: "appointment.create",
        paciente_id: patient,
        medico_id: doctor,
        fecha: date,
        hora: time,
        motivo: reason,
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la cita.");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="CITAS MÉDICAS"
        title="Agendar cita"
        description="Elige un horario y confirma los datos de la atención."
        action={
          <Button asChild variant="outline">
            <Link href="/citas">
              <ArrowLeft size={16} className="mr-2" />
              Mis citas
            </Link>
          </Button>
        }
      />
      <div className="stepper">
        {["Fecha y horario", "Confirmar datos", "Cita agendada"].map((s, i) => (
          <div className={step >= i + 1 ? "current" : ""} key={s}>
            <span>{step > i + 1 ? <Check size={16} /> : i + 1}</span>
            <p>{s}</p>
          </div>
        ))}
      </div>
      {step === 3 ? (
        <section className="panel success-panel">
          <CheckCircle2 size={52} />
          <h2>Tu solicitud quedó registrada</h2>
          <p>
            {dateLabel(date)} a las {time}, con {person(doctor)}.
          </p>
          <p className="muted">
            Estado inicial: pendiente de confirmación por el personal de salud.
          </p>
          <Button asChild>
            <Link href="/citas">Ver mis citas</Link>
          </Button>
        </section>
      ) : (
        <form onSubmit={submit} className="panel form-panel">
          {error && <Notice>{error}</Notice>}
          {step === 1 ? (
            <>
              <div className="form-grid">
                <Field label="Profesional">
                  <select
                    required
                    value={doctor}
                    onChange={(e) => setDoctor(e.target.value)}
                  >
                    <option value="">Selecciona un profesional</option>
                    {doctors.map((p) => (
                      <option value={p.id} key={p.id}>
                        {person(p.id)}
                      </option>
                    ))}
                  </select>
                </Field>
                {data.profile.rol === "admin" ? (
                  <Field label="Paciente">
                    <select
                      required
                      value={patient}
                      onChange={(e) => setPatient(e.target.value)}
                    >
                      <option value="">Selecciona un paciente</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {person(p.id)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Paciente">
                    <input readOnly value={person(data.profile.id)} />
                  </Field>
                )}
              </div>
              <div className="booking-grid">
                <section className="calendar-panel">
                  <div className="calendar-title">
                    <h2>Selecciona una fecha</h2>
                    <div>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveMonth(-1)}
                        aria-label="Mes anterior"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveMonth(1)}
                        aria-label="Mes siguiente"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="calendar-month">
                    {new Intl.DateTimeFormat("es-CO", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(first)}
                  </p>
                  <div className="calendar-grid">
                    {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                      <span className="weekday" key={i}>
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: offset }, (_, i) => (
                      <span key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const value = `${month}-${String(i + 1).padStart(2, "0")}`;
                      return (
                        <button
                          type="button"
                          disabled={value < today()}
                          className={date === value ? "selected" : ""}
                          key={value}
                          onClick={() => setDate(value)}
                          aria-label={dateLabel(value)}
                          aria-pressed={date === value}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <Field label="Fecha seleccionada">
                    <input
                      type="date"
                      min={today()}
                      required
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (e.target.value)
                          setMonth(e.target.value.slice(0, 7));
                      }}
                    />
                  </Field>
                </section>
                <section className="slots-panel">
                  <h2>Horarios disponibles</h2>
                  <p className="muted">{dateLabel(date)} · Hora de Colombia</p>
                  {loading ? (
                    <p role="status">Consultando disponibilidad…</p>
                  ) : (
                    <div className="time-slots">
                      {slots.map((s) => (
                        <button
                          type="button"
                          key={s}
                          disabled={!doctor || isPastSlot(date, s)}
                          className={time === s ? "selected" : ""}
                          onClick={() => setTime(s)}
                          aria-pressed={time === s}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {!loading && !slots.length && (
                    <p className="form-hint">
                      No hay cupos libres publicados para esta fecha. Selecciona
                      otro día.
                    </p>
                  )}
                  <p className="form-hint">
                    Franjas de 30 minutos. La disponibilidad se verifica
                    nuevamente al guardar.
                  </p>
                </section>
              </div>
              <Field label="Motivo de la cita">
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe brevemente el motivo de la atención"
                />
              </Field>
            </>
          ) : (
            <>
              <h2>Revisa tu solicitud</h2>
              <dl className="detail-list">
                <div>
                  <dt>Paciente</dt>
                  <dd>{person(patient)}</dd>
                </div>
                <div>
                  <dt>Profesional</dt>
                  <dd>{person(doctor)}</dd>
                </div>
                <div>
                  <dt>Fecha y hora</dt>
                  <dd>
                    {dateLabel(date)} · {time}
                  </dd>
                </div>
                <div>
                  <dt>Motivo</dt>
                  <dd>{reason}</dd>
                </div>
              </dl>
            </>
          )}
          <div className="form-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => (step === 2 ? setStep(1) : window.history.back())}
            >
              {step === 2 ? "Volver y corregir" : "Cancelar"}
            </Button>
            <SubmitButton busy={busy} disabled={loading || !time}>
              {step === 1 ? "Continuar" : "Confirmar cita"}
              <ArrowRight size={16} className="ml-2" />
            </SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}
