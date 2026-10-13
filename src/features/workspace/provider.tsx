"use client";

/** Estado compartido y operaciones del frontend. La demo persiste datos ficticios; el modo real depende exclusivamente de la API del equipo. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/types";
import { DEMO_MODE, today } from "@/lib/app-config";
import {
  applyDemo,
  demoView,
  seedDemo,
  DEMO_SESSION,
  DEMO_STORAGE,
} from "./demo";
import { ApiError } from "@/lib/api-client";
import { signOut } from "@/features/auth/client";
import {
  applyCorrection,
  ensureDemoSchedules,
  freeSlots,
  isCorrection,
  type CorrectionCommand,
} from "./corrections";
import {
  readFrontendWorkspace,
  sendFrontendCommand,
  readFreeSlots,
} from "./frontend-api";
import type { Command } from "./schemas";
import { Notice } from "@/components/ui/shared";
import { Button } from "@/components/ui/button";

type ContextValue = {
  data: Workspace;
  busy: boolean;
  demo: boolean;
  run: (command: Command | CorrectionCommand) => Promise<void>;
  refresh: () => Promise<void>;
  available: (
    doctor: string,
    date: string,
    except?: string,
  ) => Promise<string[]>;
  person: (id: string) => string;
  stock: (id: string) => number;
  logout: () => void;
};
const Context = createContext<ContextValue | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const all = useRef<Workspace | null>(null),
    session = useRef("");
  const router = useRouter();
  // Recupera una sesión demo o solicita únicamente datos autorizados por la API.
  const refresh = useCallback(async () => {
    setError("");
    if (DEMO_MODE) {
      const id = sessionStorage.getItem(DEMO_SESSION);
      if (!id) {
        router.replace("/login");
        return;
      }
      session.current = id;
      const saved = localStorage.getItem(DEMO_STORAGE);
      const parsed = ensureDemoSchedules(
        saved ? (JSON.parse(saved) as Workspace) : seedDemo(),
      );
      if (
        !Array.isArray(parsed.profiles) ||
        !Array.isArray(parsed.citas) ||
        !Array.isArray(parsed.lotes)
      )
        throw new Error(
          "Los datos de demostración no son válidos. Reinícialos desde el acceso.",
        );
      localStorage.setItem(DEMO_STORAGE, JSON.stringify(parsed));
      all.current = parsed;
      setData(demoView(parsed, id));
    } else {
      try {
        setData(await readFrontendWorkspace());
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setData(null);
          router.replace("/login?reason=session");
          return;
        }
        throw error;
      }
    }
  }, [router]);
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message));
  }, [refresh]);
  // Evita doble envío en esta pestaña y actualiza la vista después de cada operación.
  const run = async (command: Command | CorrectionCommand) => {
    if (lock.current)
      throw new Error("Espera a que termine la operación anterior.");
    lock.current = true;
    setBusy(true);
    try {
      if (DEMO_MODE) {
        if (!all.current) throw new Error("No hay datos cargados.");
        const saved = localStorage.getItem(DEMO_STORAGE);
        const latest = saved ? (JSON.parse(saved) as Workspace) : all.current;
        const updated = isCorrection(command)
          ? applyCorrection(latest, session.current, command)
          : applyDemo(latest, session.current, command);
        localStorage.setItem(DEMO_STORAGE, JSON.stringify(updated));
        all.current = updated;
        setData(demoView(updated, session.current));
      } else {
        await sendFrontendCommand(command);
        // Una escritura exitosa no se presenta como fallida si falla la recarga.
        try {
          await refresh();
        } catch {
          setError(
            "La operación se guardó, pero no se pudo actualizar la vista. Pulsa Actualizar; no repitas el envío.",
          );
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  // En modo real solo cierra la vista si el servidor confirmó el cierre de sesión.
  const logout = async () => {
    if (lock.current) return;
    if (DEMO_MODE) {
      sessionStorage.removeItem(DEMO_SESSION);
    } else {
      const result = await signOut();
      if (!result.ok) {
        setError(result.error);
        return;
      }
    }
    setData(null);
    router.replace("/login");
  };
  if (!data)
    return (
      <main className="loading-screen">
        {error ? (
          <>
            <Notice>{error}</Notice>
            <div className="actions">
              <Button
                onClick={() =>
                  void refresh().catch((e: Error) => setError(e.message))
                }
              >
                Reintentar
              </Button>
              <Link href="/login" className="text-link">
                Volver al acceso
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="loading-mark" />
            <p>Cargando tu espacio de trabajo…</p>
          </>
        )}
      </main>
    );
  // Para reservar se consulta el estado más reciente, no solo el calendario ya dibujado.
  const available = async (doctor: string, date: string, except?: string) => {
    if (DEMO_MODE) {
      const saved = localStorage.getItem(DEMO_STORAGE);
      const latest = saved
        ? ensureDemoSchedules(JSON.parse(saved))
        : all.current;
      return latest ? freeSlots(latest, doctor, date, except) : [];
    }
    return readFreeSlots(doctor, date, except);
  };
  return (
    <Context.Provider
      value={{
        data,
        busy,
        demo: DEMO_MODE,
        run,
        refresh,
        available,
        logout,
        person: (id) => {
          const p =
            data.people.find((p) => p.id === id) ||
            data.profiles.find((p) => p.id === id);
          return p ? `${p.nombre} ${p.apellido}` : "Usuario no disponible";
        },
        stock: (id) =>
          data.lotes
            .filter(
              (l) => l.medicamento_id === id && l.fecha_vencimiento >= today(),
            )
            .reduce((sum, l) => sum + l.cantidad, 0),
      }}
    >
      {error && (
        <div className="global-alert">
          <Notice>{error}</Notice>
          <Button
            onClick={() =>
              void refresh().catch((e: Error) => setError(e.message))
            }
          >
            Actualizar
          </Button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Falta WorkspaceProvider.");
  return context;
}
