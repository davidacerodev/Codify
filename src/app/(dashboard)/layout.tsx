import { WorkspaceProvider } from "@/features/workspace/provider";
import { AppShell } from "@/components/app-shell";

/** Envuelve las páginas en el estado compartido y la navegación por rol.
 * En modo real, WorkspaceProvider solo muestra datos tras consultar una sesión
 * validada por el backend. Este layout no sustituye la autorización del servidor.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
