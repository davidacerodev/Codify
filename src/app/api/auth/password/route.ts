import { z } from "zod";
import { apiFailure, apiSuccess, isSameOriginRequest, parseJson } from "@/lib/api/http";
import { getActiveAccount } from "@/lib/api/session";
import type { NextRequest } from "next/server";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  const parsed = await parseJson(request, passwordSchema);
  if (!parsed.ok) return parsed.response;

  const account = await getActiveAccount();
  if (!account.ok) return account.response;

  try {
    const { error } = await account.supabase.auth.updateUser({
      password: parsed.value.password,
    });
    if (error) return apiFailure("No se pudo actualizar la contraseña.", 400);
    return apiSuccess({ updated: true });
  } catch {
    return apiFailure("El servicio de autenticación no está disponible.", 503);
  }
}
