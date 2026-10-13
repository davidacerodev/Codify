/** Página para rutas inexistentes. Proporciona una salida al panel para evitar dejar al usuario en una pantalla vacía. */
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>Esta página no existe</h1>
      <p>Revisa la dirección o vuelve al inicio.</p>
      <Link href="/dashboard" className="text-link">
        Volver al inicio
      </Link>
    </main>
  );
}
