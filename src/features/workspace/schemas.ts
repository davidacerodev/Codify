/** Contrato y validación de los comandos de interfaz mediante Zod. La validación del navegador también debe repetirse en el servidor. */
import { z } from "zod";
import { isPastSlot } from "@/lib/app-config";

const id = z.string().uuid("Identificador inválido.");
const text = (max = 100) =>
  z.string().trim().min(1, "Completa los campos obligatorios.").max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida.")
  .refine((v) => {
    const parsed = new Date(v + "T12:00:00Z");
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === v
    );
  }, "Fecha inválida.");
const time = z
  .string()
  .refine(
    (v) => /^([01]\d|2[0-3]):(00|30)$/.test(v),
    "Selecciona un horario de atención.",
  );
const role = z.enum(["admin", "medico", "farmaceutico", "paciente"]);
const positive = z.number().int().min(1).max(100000);
const batch = {
  numero_lote: text(60),
  fecha_vencimiento: date,
  cantidad: positive,
};
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("appointment.create"),
    paciente_id: id,
    medico_id: id,
    fecha: date,
    hora: time,
    motivo: text(500),
  }),
  z.object({
    type: z.literal("appointment.update"),
    id,
    estado: z
      .enum(["pendiente", "confirmada", "cancelada", "completada"])
      .optional(),
    fecha: date.optional(),
    hora: time.optional(),
  }),
  z.object({
    type: z.literal("medication.create"),
    nombre: text(120),
    codigo: text(40),
    descripcion: z.string().trim().max(500),
    unidad_medida: text(60),
    stock_minimo: z.number().int().min(0).max(100000),
    ...batch,
  }),
  z.object({ type: z.literal("stock.add"), medicamento_id: id, ...batch }),
  z.object({
    type: z.literal("dispatch.create"),
    cita_id: id,
    solicitud_id: id,
    items: z
      .array(z.object({ lote_id: id, cantidad: positive }))
      .min(1, "Agrega al menos un medicamento.")
      .max(30),
  }),
  z.object({
    type: z.literal("profile.update"),
    nombre: text(80),
    apellido: text(80),
    telefono: z.string().trim().max(25),
  }),
  z.object({
    type: z.literal("user.create"),
    email: z.string().trim().email(),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72),
    nombre: text(80),
    apellido: text(80),
    telefono: z.string().trim().max(25),
    documento_identidad: text(30),
    rol: role,
  }),
  z.object({
    type: z.literal("user.update"),
    id,
    rol: role,
    activo: z.boolean(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
export function validateCommand(input: unknown): Command {
  const result = commandSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0].message);
  const cmd = result.data;
  if (
    (cmd.type === "appointment.create" || cmd.type === "appointment.update") &&
    cmd.fecha &&
    cmd.hora &&
    isPastSlot(cmd.fecha, cmd.hora)
  ) {
    throw new Error("Elige una fecha y hora futuras.");
  }
  return cmd;
}
