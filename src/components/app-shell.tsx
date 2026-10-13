"use client";

/** Estructura del panel: menú, encabezado, sesión y navegación móvil. Ocultar enlaces por rol no sustituye los permisos del backend. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Pill,
  PackageCheck,
  Users,
  History,
  UserRound,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import {
  APP_NAME,
  APP_DESCRIPTION,
  canVisit,
  roleLabels,
  today,
  dateLabel,
} from "@/lib/app-config";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/shared";
const nav = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/citas", label: "Citas médicas", icon: CalendarDays },
  { href: "/horarios", label: "Disponibilidad", icon: CalendarDays },
  { href: "/inventario", label: "Inventario", icon: Pill },
  { href: "/despacho", label: "Despachos", icon: PackageCheck },
  { href: "/usuarios", label: "Usuarios", icon: Users },
  { href: "/registros", label: "Registros", icon: History },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    data: { profile },
    demo,
    logout,
  } = useWorkspace();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  const current =
    nav.find((n) => path.startsWith(n.href))?.label || "Mi perfil";
  return (
    <div className="app-layout">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`} id="menu-principal">
        <Link href="/dashboard" className="brand">
          <span className="brand-symbol">
            <Activity size={25} />
          </span>
          <span>
            Enfermería<strong>UNITRÓPICO</strong>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
        <p className="sidebar-caption">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          {nav
            .filter((n) => canVisit(n.href, profile.rol))
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${path.startsWith(n.href) ? "active" : ""}`}
                aria-current={path.startsWith(n.href) ? "page" : undefined}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {path.startsWith(n.href) && <span className="nav-dot" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <p>
              Tu espacio, organizado.
              <small>Citas, medicamentos y atención en un solo lugar.</small>
            </p>
          </div>
          <Link
            href="/perfil"
            className={`nav-link ${path === "/perfil" ? "active" : ""}`}
          >
            <UserRound size={19} />
            Mi perfil
          </Link>
          <button className="nav-link logout" onClick={logout}>
            <LogOut size={19} />
            Cerrar sesión
          </button>
        </div>
        <p className="sidebar-footer">
          CODIFY <span>Proyecto académico</span>
        </p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-toggle icon-button"
              onClick={() => setOpen(!open)}
              aria-label="Abrir menú"
              aria-controls="menu-principal"
              aria-expanded={open}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-root">{APP_NAME}</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <Link href="/perfil" className="profile-chip">
            <span className="avatar small">
              {profile.nombre[0]}
              {profile.apellido[0]}
            </span>
            <span>
              {profile.nombre}
              <small>{roleLabels[profile.rol]}</small>
            </span>
          </Link>
        </header>
        {demo && (
          <div className="demo-banner">
            <span className="demo-dot" />
            Demostración · Datos ficticios guardados en este navegador.
            <Link href="/login">Cambiar rol</Link>
          </div>
        )}
        <main id="contenido" className="main-content" tabIndex={-1}>
          {canVisit(path, profile.rol) ? (
            children
          ) : (
            <EmptyState
              title="No tienes acceso a esta sección"
              text="Tu rol no tiene habilitado este módulo."
              action={
                <Button asChild>
                  <Link href="/dashboard">Volver al inicio</Link>
                </Button>
              }
            />
          )}
        </main>
        <footer className="workspace-footer">
          <span>{APP_DESCRIPTION}</span>
          <time>{dateLabel(today())}</time>
        </footer>
      </div>
    </div>
  );
}
