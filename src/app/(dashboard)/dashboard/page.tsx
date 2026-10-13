"use client";

/** Resumen del espacio de atención. Calcula indicadores con los datos visibles para el rol y la fecha de Colombia. */
import Link from "next/link";
import {
  CalendarDays,
  ArrowUpRight,
  Pill,
  PackageCheck,
  Plus,
  Clock3,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { today, dateLabel, timeLabel } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, Badge } from "@/components/ui/shared";
export default function DashboardPage() {
  const { data, person, stock } = useWorkspace();
  const role = data.profile.rol;
  const upcoming = data.citas
    .filter(
      (c) =>
        c.fecha >= today() && !["cancelada", "completada"].includes(c.estado),
    )
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const activeMedicines = data.medicamentos.filter((m) => m.activo !== false);
  const low = activeMedicines.filter((m) => stock(m.id) <= m.stock_minimo);
  const dayCitas = data.citas.filter(
    (c) => c.fecha === today() && c.estado !== "cancelada",
  );
  const previewCitas = role === "paciente" ? upcoming : dayCitas;
  // Las cifras del día se calculan en Bogotá, no con la fecha UTC del navegador.
  const deliveredToday = data.despachos.filter(
    (d) =>
      d.estado === "entregado" &&
      new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(
        new Date(d.fecha),
      ) === today(),
  );
  const deliveredUnits = data.items
    .filter((i) => deliveredToday.some((d) => d.id === i.despacho_id))
    .reduce((sum, i) => sum + i.cantidad, 0);
  const stats =
    role === "paciente"
      ? [
          {
            title: "Próximas citas",
            value: upcoming.length,
            icon: CalendarDays,
            hint: "Tu agenda de atención",
            href: "/citas",
          },
          {
            title: "Por confirmar",
            value: data.citas.filter((c) => c.estado === "pendiente").length,
            icon: Clock3,
            hint: "Solicitudes pendientes",
            href: "/citas",
          },
          {
            title: "Atenciones realizadas",
            value: data.citas.filter((c) => c.estado === "completada").length,
            icon: CheckCircle2,
            hint: "Tu historial de citas",
            href: "/citas",
          },
        ]
      : [
          {
            title: "Citas de hoy",
            value: data.citas.filter(
              (c) => c.fecha === today() && c.estado !== "cancelada",
            ).length,
            icon: CalendarDays,
            hint: "Atenciones de la jornada",
            href: role === "farmaceutico" ? "/horarios" : "/citas",
          },
          {
            title: "Medicamentos disponibles",
            value: activeMedicines.filter((m) => stock(m.id) > 0).length,
            icon: Pill,
            hint: `${activeMedicines.reduce((n, m) => n + stock(m.id), 0)} unidades disponibles · ${low.length} alertas`,
            href: "/inventario",
          },
          {
            title: "Unidades despachadas hoy",
            value: deliveredUnits,
            icon: PackageCheck,
            hint: `${deliveredToday.length} entregas en los registros visibles`,
            href: "/inventario#historial",
          },
        ];
  return (
    <>
      <PageHeader
        eyebrow="VISTA GENERAL"
        title={`Hola, ${data.profile.nombre}`}
        description="Este es el resumen de tu espacio de atención."
        action={
          <Button asChild>
            <Link
              href={
                role === "farmaceutico"
                  ? "/despacho"
                  : role === "medico"
                    ? "/citas"
                    : "/citas/nueva"
              }
            >
              <Plus size={17} className="mr-2" />
              {role === "farmaceutico"
                ? "Nuevo despacho"
                : role === "medico"
                  ? "Ver mi agenda"
                  : "Agendar cita"}
            </Link>
          </Button>
        }
      />
      <div className="stats-grid">
        {stats.map((s) => (
          <Link href={s.href} key={s.title} className="stat-card">
            <div className="stat-top">
              <span className="stat-icon">
                <s.icon size={21} />
              </span>
              <ArrowUpRight size={18} />
            </div>
            <p>{s.title}</p>
            <strong>{s.value}</strong>
            <small>{s.hint}</small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{role === "paciente" ? "Próximas citas" : "Citas de hoy"}</h2>
              <p>
                {role === "paciente"
                  ? "Atenciones programadas"
                  : "Agenda de la jornada"}
              </p>
            </div>
            <Link
              href={role === "farmaceutico" ? "/horarios" : "/citas"}
              className="text-link"
            >
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          {previewCitas.length ? (
            <div className="appointment-preview">
              {previewCitas.slice(0, 4).map((c) => (
                <div className="preview-row" key={c.id}>
                  <span className="date-square">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <strong>
                      {role === "paciente"
                        ? person(c.medico_id)
                        : person(c.paciente_id)}
                    </strong>
                    <small>
                      {dateLabel(c.fecha)} · {timeLabel(c.hora)}
                    </small>
                  </div>
                  <Badge status={c.estado} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                role === "paciente"
                  ? "Tu agenda está libre"
                  : "Sin citas para hoy"
              }
              text="Consulta la agenda para revisar otras fechas."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                {role === "paciente" ? "Tu atención" : "Para tener presente"}
              </h2>
              <p>
                {role === "paciente"
                  ? "Información útil para tu próxima visita"
                  : "Revisa las existencias disponibles"}
              </p>
            </div>
          </div>
          {role === "paciente" ? (
            <div className="tip-list">
              <p>
                <CheckCircle2 size={18} />
                Revisa la fecha y hora de tu cita.
              </p>
              <p>
                <Clock3 size={18} />
                Llega unos minutos antes de la atención.
              </p>
              <p>
                <CalendarDays size={18} />
                Si no puedes asistir, cancela o reprograma.
              </p>
            </div>
          ) : low.length ? (
            <div className="stock-alerts">
              {low.slice(0, 4).map((m) => (
                <Link href="/inventario" key={m.id}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{m.nombre}</strong>
                    <small>
                      {stock(m.id)} unidades disponibles · mínimo{" "}
                      {m.stock_minimo}
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Inventario al día"
              text="No hay alertas de stock bajo en los registros visibles."
            />
          )}
        </section>
      </div>
      {role === "admin" && (
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos movimientos del sistema</p>
            </div>
            <Link className="text-link" href="/registros">
              Ver historial <ArrowRight size={14} />
            </Link>
          </div>
          {data.auditoria.slice(0, 4).map((a) => (
            <div className="activity-row" key={a.id}>
              <span className="activity-dot" />
              <div>
                <strong>{a.accion}</strong>
                <small>{person(a.usuario_id)}</small>
              </div>
              <time>{dateLabel(a.created_at)}</time>
            </div>
          ))}
          {!data.auditoria.length && (
            <EmptyState title="Aún no hay actividad" />
          )}
        </section>
      )}
    </>
  );
}
