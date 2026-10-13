"use client";

/** Límite de errores del panel. Permite reintentar la vista sin revelar detalles internos al usuario. */
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>No pudimos abrir esta pantalla</h1>
      <p>Vuelve a intentarlo. Tus datos guardados no se modificaron.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
