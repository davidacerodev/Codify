import { createClient } from "@/lib/supabase/server";
import { apiFailure } from "./http";

export async function getActiveAccount() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false as const,
      response: apiFailure("Debes iniciar sesión.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false as const,
      response: apiFailure("El perfil no está disponible.", 503),
    };
  }

  if (!profile || !profile.activo) {
    return {
      ok: false as const,
      response: apiFailure("La cuenta no tiene acceso al sistema.", 403),
    };
  }

  return { ok: true as const, supabase, user, profile };
}
