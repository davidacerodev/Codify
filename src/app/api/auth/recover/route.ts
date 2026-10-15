import { z } from "zod";
import { apiFailure, apiSuccess, isSameOriginRequest, parseJson } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

const recoverySchema = z
  .object({
    email: z.string().trim().email("Escribe un correo válido.").max(254),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  const parsed = await parseJson(request, recoverySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      console.error("[auth.recover] NEXT_PUBLIC_SITE_URL is not configured");
      return apiFailure("El servicio de recuperación no está disponible.", 503);
    }

    const redirectTo = new URL("/actualizar-contrasena", siteUrl).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.value.email, {
      redirectTo,
    });

    if (error) {
      // Do not expose whether the address exists or provider-specific details.
      console.error("[auth.recover] Supabase recovery request failed", {
        status: error.status,
        name: error.name,
      });
    }
  } catch {
    console.error("[auth.recover] Recovery request could not be processed");
  }

  return apiSuccess({
    message:
      "Si el correo corresponde a una cuenta, recibirás instrucciones para continuar.",
  });
}
