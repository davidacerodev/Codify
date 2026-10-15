import { z } from "zod";
import { apiFailure, apiSuccess } from "@/lib/api/http";
import { getActiveAccount } from "@/lib/api/session";
import type { NextRequest } from "next/server";

const querySchema = z.object({
  medico: z.string().uuid(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T12:00:00Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Selecciona una fecha válida."),
  excluir: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const account = await getActiveAccount();
  if (!account.ok) return account.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return apiFailure("Los parámetros de disponibilidad no son válidos.", 400);
  }

  if (!['admin', 'medico', 'paciente'].includes(account.profile.rol)) {
    return apiFailure("No tienes permiso para consultar horarios.", 403);
  }

  const { data, error } = await account.supabase.rpc("get_available_slots", {
    p_medico_id: parsed.data.medico,
    p_fecha: parsed.data.fecha,
    p_excluir_cita_id: parsed.data.excluir ?? null,
  });

  if (error) {
    if (error.code === "42501") {
      return apiFailure("No tienes permiso para consultar ese horario.", 403);
    }
    if (error.code === "22023") {
      return apiFailure("Los parámetros de disponibilidad no son válidos.", 400);
    }
    // Keep database details out of the client response and application logs.
    return apiFailure("No se pudo consultar la disponibilidad.", 503);
  }

  const slots = ((data ?? []) as Array<{ hora: string }>)
    .map((slot) => String(slot.hora).slice(0, 5))
    .filter((slot) => /^([01]\d|2[0-3]):(00|30)$/.test(slot));

  return apiSuccess(slots);
}
