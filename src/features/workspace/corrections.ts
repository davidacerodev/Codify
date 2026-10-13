/** Reglas de presentación y simulación de horarios y CRUD de inventario. Mantiene reservas e historial al modificar o retirar registros. */
import { z } from "zod";
import type { Workspace, Horario } from "@/types";
import { isPastSlot, today } from "@/lib/app-config";

const id = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha inválida.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|30)$/, "Usa franjas de 30 minutos.");
const text = (max: number) =>
  z.string().trim().min(1, "Completa los campos obligatorios.").max(max);
// Valida límites y formatos antes de aplicar los comandos añadidos en las correcciones.
export const correctionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("schedule.save"),
    id: id.optional(),
    medico_id: id,
    fecha: date,
    desde: time,
    hasta: time,
  }),
  z.object({ type: z.literal("schedule.cancel"), id }),
  z.object({
    type: z.literal("medication.update"),
    id,
    nombre: text(120),
    codigo: text(40),
    descripcion: z.string().trim().max(500),
    unidad_medida: text(60),
    stock_minimo: z.number().int().min(0).max(100000),
  }),
  z.object({ type: z.literal("medication.delete"), id, motivo: text(300) }),
  z.object({
    type: z.literal("batch.update"),
    id,
    numero_lote: text(60),
    fecha_vencimiento: date,
    cantidad: z.number().int().min(0).max(100000),
    motivo: text(300),
  }),
]);
export type CorrectionCommand = z.infer<typeof correctionSchema>;
export function isCorrection(command: {
  type: string;
}): command is CorrectionCommand {
  return [
    "schedule.save",
    "schedule.cancel",
    "medication.update",
    "medication.delete",
    "batch.update",
  ].includes(command.type);
}
// Expande cada rango activo: la hora final es exclusiva y cada cupo dura 30 minutos.
export function scheduleSlots(
  horarios: Horario[],
  doctor: string,
  date: string,
) {
  const result = new Set<string>();
  for (const h of horarios.filter(
    (h) => h.medico_id === doctor && h.fecha === date && h.estado === "activo",
  )) {
    for (let n = minutes(h.desde); n < minutes(h.hasta); n += 30)
      result.add(
        `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`,
      );
  }
  return Array.from(result).sort();
}
function minutes(v: string) {
  return Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
}
// Retira cupos pasados o reservados; except permite reprogramar la propia cita.
export function freeSlots(
  data: Workspace,
  doctor: string,
  date: string,
  except?: string,
) {
  return scheduleSlots(data.horarios || [], doctor, date).filter(
    (time) =>
      !isPastSlot(date, time) &&
      !data.citas.some(
        (c) =>
          c.id !== except &&
          c.medico_id === doctor &&
          c.fecha === date &&
          c.hora.slice(0, 5) === time &&
          c.estado !== "cancelada",
      ),
  );
}
// Solo para demostración. Migración de las sesiones locales de la entrega anterior.
export function ensureDemoSchedules(data: Workspace): Workspace {
  if (data.horarios) return data;
  const horarios: Horario[] = [];
  for (const doctor of data.profiles.filter(
    (p) => p.rol === "medico" && p.activo,
  )) {
    for (let offset = 0; offset < 14; offset++) {
      const d = new Date(today() + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + offset);
      for (const [desde, hasta] of [
        ["08:00", "12:00"],
        ["14:00", "17:00"],
      ])
        horarios.push({
          id: crypto.randomUUID(),
          medico_id: doctor.id,
          fecha: d.toISOString().slice(0, 10),
          desde,
          hasta,
          estado: "activo",
        });
    }
  }
  return { ...data, horarios };
}
// Aplica cambios a una copia, valida rol/recurso y añade evidencia antes/después.
export function applyCorrection(
  all: Workspace,
  actorId: string,
  input: CorrectionCommand,
): Workspace {
  const checked = correctionSchema.safeParse(input);
  if (!checked.success) throw new Error(checked.error.issues[0].message);
  const cmd = checked.data;
  const data: Workspace = structuredClone(ensureDemoSchedules(all));
  const actor = data.profiles.find((p) => p.id === actorId && p.activo);
  if (!actor) throw new Error("La sesión no está activa.");
  const now = new Date().toISOString();
  let table = "horarios",
    record = "",
    action = "",
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined;
  if (cmd.type === "schedule.save" || cmd.type === "schedule.cancel") {
    const existing = data.horarios!.find((h) => h.id === cmd.id);
    if (cmd.id && !existing) throw new Error("Horario no encontrado.");
    const doctor =
      cmd.type === "schedule.save" ? cmd.medico_id : existing!.medico_id;
    if (
      actor.rol !== "admin" &&
      !(actor.rol === "medico" && actor.id === doctor)
    )
      throw new Error("Solo puedes administrar tus propios horarios.");
    if (existing && existing.medico_id !== doctor)
      throw new Error("No puedes transferir el horario a otro médico.");
    if (
      !data.profiles.some(
        (p) => p.id === doctor && p.rol === "medico" && p.activo,
      )
    )
      throw new Error("Selecciona un médico activo.");
    if (existing?.estado === "cancelado")
      throw new Error("El horario está cancelado. Publica uno nuevo.");
    const next: Horario =
      cmd.type === "schedule.save"
        ? {
            id: existing?.id || crypto.randomUUID(),
            medico_id: doctor,
            fecha: cmd.fecha,
            desde: cmd.desde,
            hasta: cmd.hasta,
            estado: "activo",
          }
        : { ...existing!, estado: "cancelado" };
    if (cmd.type === "schedule.save") {
      if (cmd.desde >= cmd.hasta || isPastSlot(cmd.fecha, cmd.desde))
        throw new Error(
          "El inicio debe ser futuro y anterior a la hora final.",
        );
      if (
        data.horarios!.some(
          (h) =>
            h.id !== next.id &&
            h.estado === "activo" &&
            h.medico_id === doctor &&
            h.fecha === next.fecha &&
            h.desde < next.hasta &&
            h.hasta > next.desde,
        )
      )
        throw new Error("Este rango se cruza con otro horario publicado.");
    }
    if (
      existing &&
      data.citas.some(
        (c) =>
          c.medico_id === doctor &&
          c.fecha === existing.fecha &&
          c.hora.slice(0, 5) >= existing.desde &&
          c.hora.slice(0, 5) < existing.hasta &&
          c.estado !== "cancelada" &&
          (next.estado === "cancelado" ||
            c.fecha !== next.fecha ||
            c.hora.slice(0, 5) < next.desde ||
            c.hora.slice(0, 5) >= next.hasta),
      )
    )
      throw new Error(
        "Este horario tiene citas. Cancela o reprograma esas citas antes de retirar sus cupos.",
      );
    before = existing ? { ...existing } : undefined;
    after = { ...next };
    record = next.id;
    if (existing) Object.assign(existing, next);
    else data.horarios!.push(next);
    action =
      cmd.type === "schedule.cancel"
        ? "Horario cancelado"
        : existing
          ? "Horario actualizado"
          : "Horario publicado";
  } else {
    if (!["admin", "medico", "farmaceutico"].includes(actor.rol))
      throw new Error("No tienes acceso al inventario.");
    if (cmd.type === "batch.update") {
      const lot = data.lotes.find((l) => l.id === cmd.id);
      const med = data.medicamentos.find(
        (m) => m.id === lot?.medicamento_id && m.activo !== false,
      );
      if (!lot || !med) throw new Error("Lote no disponible.");
      if (
        data.lotes.some(
          (l) =>
            l.id !== lot.id &&
            l.medicamento_id === lot.medicamento_id &&
            l.numero_lote.toLowerCase() === cmd.numero_lote.toLowerCase(),
        )
      )
        throw new Error("El número de lote ya existe.");
      before = { ...lot };
      const delta = cmd.cantidad - lot.cantidad;
      Object.assign(lot, {
        numero_lote: cmd.numero_lote,
        fecha_vencimiento: cmd.fecha_vencimiento,
        cantidad: cmd.cantidad,
        updated_at: now,
      });
      after = { ...lot, delta, motivo: cmd.motivo, nombre: med.nombre };
      record = lot.id;
      table = "lotes";
      action = "Lote actualizado";
    } else {
      const med = data.medicamentos.find(
        (m) => m.id === cmd.id && m.activo !== false,
      );
      if (!med) throw new Error("Medicamento no disponible.");
      before = { ...med };
      record = med.id;
      table = "medicamentos";
      if (cmd.type === "medication.delete") {
        if (
          data.lotes.some((l) => l.medicamento_id === med.id && l.cantidad > 0)
        )
          throw new Error(
            "Hay existencias en sus lotes. Registra la salida o un ajuste justificado antes de eliminar.",
          );
        med.activo = false;
        med.updated_at = now;
        after = { ...med, motivo: cmd.motivo };
        action = "Medicamento eliminado del catálogo";
      } else {
        if (
          data.medicamentos.some(
            (m) =>
              m.id !== med.id &&
              m.codigo.toLowerCase() === cmd.codigo.toLowerCase(),
          )
        )
          throw new Error("Ese código ya existe.");
        const { type: _type, id: _id, ...fields } = cmd;
        Object.assign(med, fields, { updated_at: now });
        after = { ...med };
        action = "Medicamento actualizado";
      }
    }
  }
  data.auditoria.unshift({
    id: crypto.randomUUID(),
    usuario_id: actorId,
    accion: action,
    tabla_afectada: table,
    registro_id: record,
    datos_anteriores: before,
    datos_nuevos: after,
    created_at: now,
  });
  return data;
}
