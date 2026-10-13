"use client";

/** Ruta de disponibilidad. Reutiliza la agenda que el médico ve en Citas y que el auxiliar puede consultar sin editar. */
import { ScheduleManager } from "@/components/schedule-manager";
import { PageHeader } from "@/components/ui/shared";
export default function HorariosPage() {
  return (
    <>
      <PageHeader
        eyebrow="AGENDA"
        title="Horarios de atención"
        description="Disponibilidad publicada por el personal médico."
      />
      <ScheduleManager />
    </>
  );
}
