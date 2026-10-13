/** Utilidad para combinar clases condicionales y resolver conflictos de Tailwind sin repetir esa lógica en los componentes. */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
