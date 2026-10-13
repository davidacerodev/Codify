/** Entrada de la aplicación. Dirige al panel; el contexto de sesión conduce al acceso cuando no hay una identidad válida. */
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
