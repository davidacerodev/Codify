"use client";

/** Formulario para registrar un medicamento junto con su primer lote. Envía un único comando para evitar registros incompletos. */
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { useWorkspace } from "@/features/workspace/provider";
import { today } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  Field,
  Notice,
  SubmitButton,
} from "@/components/ui/shared";
export default function NuevoMedicamentoPage() {
  const { run, busy } = useWorkspace();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="INVENTARIO"
        title="Registrar medicamento"
        description="Agrega el medicamento y su primer lote al inventario."
        action={
          <Button asChild variant="outline">
            <Link href="/inventario">
              <ArrowLeft size={16} className="mr-2" />
              Inventario
            </Link>
          </Button>
        }
      />
      <form
        className="panel form-panel narrow-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await run({
              type: "medication.create",
              nombre: String(f.get("nombre")),
              codigo: String(f.get("codigo")),
              descripcion: String(f.get("descripcion")),
              unidad_medida: String(f.get("unidad")),
              stock_minimo: Number(f.get("minimo")),
              numero_lote: String(f.get("lote")),
              cantidad: Number(f.get("cantidad")),
              fecha_vencimiento: String(f.get("vencimiento")),
            });
            router.push("/inventario?created=1");
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
          }
        }}
      >
        <div className="section-title">
          <span className="stat-icon">
            <PackagePlus size={21} />
          </span>
          <div>
            <h2>Datos del medicamento</h2>
            <p>Los campos con * son obligatorios.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Nombre *">
            <input
              name="nombre"
              required
              maxLength={120}
              placeholder="Ej. Acetaminofén"
            />
          </Field>
          <Field label="Código interno *">
            <input
              name="codigo"
              required
              maxLength={40}
              placeholder="Ej. MED-005"
            />
          </Field>
          <Field label="Presentación / unidad *">
            <input
              name="unidad"
              required
              maxLength={60}
              placeholder="Ej. Tableta 500 mg"
            />
          </Field>
          <Field label="Stock mínimo *">
            <input
              name="minimo"
              type="number"
              required
              min={0}
              max={100000}
              step={1}
              defaultValue={10}
            />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea
            name="descripcion"
            rows={3}
            maxLength={500}
            placeholder="Información adicional del registro"
          />
        </Field>
        <hr />
        <h2>Primer lote</h2>
        <div className="form-grid">
          <Field label="Número de lote *">
            <input
              name="lote"
              required
              maxLength={60}
              placeholder="Código del empaque"
            />
          </Field>
          <Field label="Stock inicial *">
            <input
              name="cantidad"
              type="number"
              required
              min={1}
              max={100000}
              step={1}
              placeholder="Cantidad de unidades"
            />
          </Field>
          <Field label="Fecha de vencimiento *">
            <input name="vencimiento" type="date" required min={today()} />
          </Field>
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="form-footer">
          <Button asChild variant="outline">
            <Link href="/inventario">Cancelar</Link>
          </Button>
          <SubmitButton busy={busy}>Guardar medicamento</SubmitButton>
        </div>
      </form>
    </>
  );
}
