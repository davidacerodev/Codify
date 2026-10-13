/** Adaptador de lectura, escritura y disponibilidad. Describe llamadas HTTP del frontend; no implementa los endpoints del backend. */
// Adaptador del frontend. Los endpoints se implementan en la rama backend.
import type { Workspace } from "@/types";
import type { Command } from "./schemas";
import type { CorrectionCommand } from "./corrections";
import { apiRequest } from "@/lib/api-client";

// Rechaza respuestas incompletas para no tratar una lista vacía o mal formada como estado válido.
export async function readFrontendWorkspace() {
  const data = await apiRequest<Workspace>("/api/frontend/workspace");
  if (
    !data?.profile ||
    !Array.isArray(data.horarios) ||
    !Array.isArray(data.citas) ||
    !Array.isArray(data.medicamentos) ||
    !Array.isArray(data.lotes) ||
    !Array.isArray(data.inventoryHistory) ||
    !Array.isArray(data.despachos) ||
    !Array.isArray(data.items) ||
    !Array.isArray(data.people) ||
    !Array.isArray(data.profiles) ||
    !Array.isArray(data.auditoria)
  )
    throw new Error(
      "La respuesta del servidor no coincide con el contrato de frontend.",
    );
  return data;
}
// El backend vuelve a validar el comando, el rol y la transacción antes de responder.
export async function sendFrontendCommand(
  command: Command | CorrectionCommand,
) {
  await apiRequest<unknown>("/api/frontend/workspace", {
    method: "POST",
    body: JSON.stringify(command),
  });
}
export async function readFreeSlots(
  doctor: string,
  date: string,
  except?: string,
) {
  const query = new URLSearchParams({ medico: doctor, fecha: date });
  if (except) query.set("excluir", except);
  const slots = await apiRequest<string[]>(
    `/api/frontend/disponibilidad?${query}`,
  );
  if (
    !Array.isArray(slots) ||
    slots.some((s) => !/^([01]\d|2[0-3]):(00|30)$/.test(s))
  )
    throw new Error("Respuesta de disponibilidad inválida.");
  return slots;
}
