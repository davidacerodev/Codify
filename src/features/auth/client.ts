/** Formularios de autenticación: validación de entrada y llamadas HTTP.
 * La creación de sesión, cookies y correos pertenece al backend del equipo.
 * La demo no envía correos ni crea usuarios reales.
 */
import { z } from "zod";
import { DEMO_MODE } from "@/lib/app-config";
import { apiRequest } from "@/lib/api-client";
import type { ActionResult } from "@/features/workspace/schemas";

// Mantiene un resultado uniforme para que cada formulario muestre sus errores.
async function perform(operation: () => Promise<void>): Promise<ActionResult> {
  try {
    await operation();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : "No se pudo completar la solicitud.",
    };
  }
}
export function signIn(email: string, password: string) {
  return perform(async () => {
    if (DEMO_MODE)
      throw new Error("Usa el selector de roles de la demostración.");
    const input = z
      .object({
        email: z.string().trim().email("Escribe un correo válido."),
        password: z.string().min(1, "Escribe tu contraseña."),
      })
      .parse({ email, password });
    await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  });
}
export function requestPasswordReset(email: string) {
  return perform(async () => {
    const address = z
      .string()
      .trim()
      .email("Escribe un correo válido.")
      .parse(email);
    if (!DEMO_MODE)
      await apiRequest("/api/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email: address }),
      });
  });
}
export function changePassword(password: string) {
  return perform(async () => {
    z.string().min(8, "Usa al menos 8 caracteres.").max(72).parse(password);
    if (DEMO_MODE)
      throw new Error("Las cuentas de demostración no tienen contraseña.");
    await apiRequest("/api/auth/password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  });
}
export function signOut() {
  return perform(async () => {
    await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
  });
}
