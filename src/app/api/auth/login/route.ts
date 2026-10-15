import { z } from "zod";
import { apiFailure, apiSuccess, isSameOriginRequest, parseJson } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

const loginSchema = z
  .object({
    email: z.string().trim().email("Escribe un correo válido.").max(254),
    password: z.string().min(1, "Escribe tu contraseña.").max(72),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  const parsed = await parseJson(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.value);

    if (error || !data.user) {
      return apiFailure("Correo o contraseña incorrectos.", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, activo")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.activo) {
      await supabase.auth.signOut({ scope: "local" });
      return apiFailure(
        "La cuenta no tiene un perfil activo para acceder al sistema.",
        403,
      );
    }

    return apiSuccess({ authenticated: true });
  } catch {
    return apiFailure("El servicio de autenticación no está disponible.", 503);
  }
}
