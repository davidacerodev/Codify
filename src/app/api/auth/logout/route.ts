import { apiFailure, apiSuccess, isSameOriginRequest } from "@/lib/api/http";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return apiFailure("No se pudo cerrar la sesión.", 503);
    return apiSuccess({ authenticated: false });
  } catch {
    return apiFailure("El servicio de autenticación no está disponible.", 503);
  }
}
