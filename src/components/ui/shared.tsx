"use client";

/** Componentes compartidos de presentación y accesibilidad: campos, mensajes, estados vacíos, badges y ventanas de diálogo. */
import {
  useEffect,
  useRef,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  X,
  Search,
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Notice({
  children,
  kind = "error",
}: {
  children: React.ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return (
    <div
      className={cn("notice", kind)}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span>{children}</span>
    </div>
  );
}
export function EmptyState({
  title = "No hay registros",
  text = "Cuando agregues información, aparecerá aquí.",
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
// Asigna un id compartido a etiqueta y control; enlaza también la ayuda con aria-describedby.
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  const descriptionId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id?: string;
              "aria-describedby"?: string;
            }>,
            { id, "aria-describedby": descriptionId },
          )
        : children}
      {hint && <small id={descriptionId}>{hint}</small>}
    </div>
  );
}
export function SubmitButton({
  busy,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { busy: boolean }) {
  return (
    <Button {...props} type="submit" disabled={busy || props.disabled}>
      {busy && <Loader2 size={16} className="animate-spin mr-2" />}
      {busy ? "Guardando…" : children}
    </Button>
  );
}
const statuses: Record<string, [string, string]> = {
  pendiente: ["Pendiente", "amber"],
  confirmada: ["Confirmada", "teal"],
  completada: ["Completada", "neutral"],
  cancelada: ["Cancelada", "red"],
  entregado: ["Entregado", "teal"],
  disponible: ["Disponible", "teal"],
  bajo: ["Stock bajo", "amber"],
  agotado: ["Agotado", "red"],
  vencido: ["Vencido", "red"],
  activo: ["Activo", "teal"],
  inactivo: ["Inactivo", "neutral"],
};
export function Badge({ status }: { status: string }) {
  const value = statuses[status] || [status, "neutral"];
  return (
    <span className={cn("badge", value[1])}>
      <i />
      {value[0]}
    </span>
  );
}
export function SearchInput({
  id,
  "aria-describedby": descriptionId,
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  id?: string;
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        id={id}
        aria-describedby={descriptionId}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
// Usa dialog nativo para modal y foco; Escape pasa por onClose para respetar envíos pendientes.
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
