/** Configuración compartida de la interfaz: modo demo explícito, nombres de roles, rutas y fechas de Colombia. */
import type { Role } from "@/types";

// La demostración se habilita de forma explícita. Nunca depende de que falten claves.
export const DEMO_MODE =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const APP_NAME = "Enfermería Unitrópico";
export const APP_DESCRIPTION =
  "Sistema de información web para la gestión integral de servicios de salud";
export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  medico: "Médico",
  farmaceutico: "Auxiliar de enfermería",
  paciente: "Paciente",
};
export const allRoles: Role[] = ["admin", "medico", "farmaceutico", "paciente"];
export const routeRoles: Record<string, Role[]> = {
  "/dashboard": allRoles,
  "/citas": ["admin", "medico", "paciente"],
  "/horarios": ["admin", "medico", "farmaceutico", "paciente"],
  "/citas/nueva": ["admin", "paciente"],
  "/inventario": ["admin", "medico", "farmaceutico"],
  "/inventario/nuevo": ["admin", "medico", "farmaceutico"],
  "/despacho": ["admin", "farmaceutico"],
  "/usuarios": ["admin"],
  "/registros": ["admin"],
  "/perfil": allRoles,
};
// Compara primero la ruta más específica; /inventario/nuevo puede tener permisos distintos.
export function canVisit(path: string, role: Role) {
  const key = Object.keys(routeRoles)
    .sort((a, b) => b.length - a.length)
    .find((p) => path === p || path.startsWith(p + "/"));
  return key ? routeRoles[key].includes(role) : true;
}
// Construye la fecha por partes para no depender del formato regional del dispositivo.
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("-");
}
export function isPastSlot(date: string, time: string) {
  return (
    new Date(`${date}T${time.slice(0, 5)}:00-05:00`).getTime() <= Date.now()
  );
}
export function dateLabel(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "America/Bogota",
  }).format(new Date(value.length === 10 ? value + "T12:00:00-05:00" : value));
}
export function timeLabel(value: string) {
  return value.slice(0, 5);
}
export const APPOINTMENT_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];
