/** Diseño compartido del acceso y la recuperación de contraseña. Mantiene el contexto visual sin duplicarlo en cada formulario. */
import { Activity } from "lucide-react";
import { APP_DESCRIPTION } from "@/lib/app-config";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="brand-symbol">
          <Activity size={26} />
        </span>
        <span>
          Enfermería <strong>Unitrópico</strong>
        </span>
      </div>
      <p className="auth-description">{APP_DESCRIPTION}</p>
      {children}
      <footer>CODIFY · Facultad de Ingenierías · Proyecto académico</footer>
    </main>
  );
}
