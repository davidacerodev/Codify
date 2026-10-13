/** Cliente HTTP compartido del frontend.
 * Usa cookies del mismo origen; el backend autentica y autoriza cada petición.
 * No almacena contraseñas ni claves de servicio en el navegador.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  // Distingue una integración pendiente de un inicio de sesión exitoso.
  if (response.status === 404 || response.status === 405)
    throw new ApiError(
      "Este servicio aún no está conectado al backend. Utiliza el modo demo para revisar la interfaz.",
      response.status,
    );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok)
    throw new ApiError(
      typeof result?.error === "string"
        ? result.error
        : "No se pudo completar la operación. Intenta de nuevo.",
      response.status,
    );
  return result.data as T;
}
