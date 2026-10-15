import type { Auditoria, Cita, Profile, Workspace } from "@/types";
import {
  apiFailure,
  apiSuccess,
  isSameOriginRequest,
  parseJson,
} from "@/lib/api/http";
import { getActiveAccount } from "@/lib/api/session";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { commandSchema } from "@/features/workspace/schemas";
import { correctionSchema } from "@/features/workspace/corrections";
import { createAdminClient } from "@/lib/supabase/admin";

const commandRecordSchema = z.record(z.unknown());

function rpcFailure(error: { code?: string } | null) {
  if (error?.code === "42501") {
    return apiFailure("No tienes permiso para realizar esta operación.", 403);
  }
  if (error?.code === "P0002") {
    return apiFailure("El registro solicitado ya no está disponible.", 404);
  }
  if (error?.code === "22023") {
    return apiFailure("Los datos de la operación no son válidos.", 400);
  }
  if (error?.code === "23505" || error?.code === "P0001") {
    return apiFailure("La operación entra en conflicto con el estado actual.", 409);
  }
  if (error) {
    console.error("[api.appointments] operation failed", { code: error.code });
    return apiFailure("No se pudo guardar la cita.", 503);
  }
  return null;
}

function failedQuery(error: { code?: string } | null) {
  if (!error) return false;
  console.error("[api.workspace] query failed", { code: error.code });
  return true;
}

export async function GET() {
  const account = await getActiveAccount();
  if (!account.ok) return account.response;

  const { supabase, user, profile: accessProfile } = account;
  const [profileResult, citasResult, despachosResult, horariosResult] =
    await Promise.all([
      supabase.rpc("get_own_profile"),
      accessProfile.rol === "farmaceutico"
        ? supabase.rpc("get_dispensing_appointments")
        : supabase
            .from("citas")
            .select("*")
            .order("fecha", { ascending: false })
            .limit(500),
      supabase
        .from("despachos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      accessProfile.rol === "farmaceutico"
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("horarios")
            .select("id, medico_id, fecha, desde, hasta, estado")
            .eq("estado", "activo")
            .order("fecha", { ascending: true })
            .limit(500),
    ]);

  if (
    failedQuery(profileResult.error) ||
    failedQuery(citasResult.error) ||
    failedQuery(despachosResult.error) ||
    failedQuery(horariosResult.error) ||
    !profileResult.data?.[0]
  ) {
    return apiFailure(
      "La base de datos no está lista para cargar el espacio de trabajo.",
      503,
    );
  }

  const profile = profileResult.data[0] as Profile;
  const role = profile.rol;
  const isStaff =
    role === "admin" || role === "medico" || role === "farmaceutico";

  const [
    medicamentosResult,
    lotesResult,
    itemsResult,
    auditoriaResult,
    movementsResult,
  ] =
    await Promise.all([
      isStaff
        ? supabase
            .from("medicamentos")
            .select("*")
            .order("nombre")
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      isStaff
        ? supabase
            .from("lotes")
            .select(
              "id, medicamento_id, numero_lote, fecha_vencimiento, cantidad, created_at, updated_at",
            )
            .order("fecha_vencimiento")
            .limit(1000)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("despacho_items").select("*").limit(1000),
      role === "admin"
        ? supabase
            .from("auditoria")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      isStaff
        ? supabase
            .from("inventory_movements")
            .select(
              "id, medicamento_id, lote_id, tipo, cantidad_delta, motivo, referencia_id, usuario_id, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    failedQuery(medicamentosResult.error) ||
    failedQuery(lotesResult.error) ||
    failedQuery(itemsResult.error) ||
    failedQuery(auditoriaResult.error) ||
    failedQuery(movementsResult.error)
  ) {
    return apiFailure(
      "La base de datos no está lista para cargar el espacio de trabajo.",
      503,
    );
  }

  const citaRows = (citasResult.data ?? []) as Cita[];
  const citas: Cita[] = citaRows.map((cita) => ({
    ...cita,
    motivo: "motivo" in cita ? cita.motivo : "",
  }));
  const despachos = despachosResult.data ?? [];
  const relatedIds = new Set<string>([user.id]);
  citas.forEach((cita) => {
    relatedIds.add(cita.paciente_id);
    relatedIds.add(cita.medico_id);
  });
  despachos.forEach((despacho) => {
    relatedIds.add(despacho.paciente_id);
    relatedIds.add(despacho.farmaceutico_id);
  });

  const [relatedPeopleResult, adminProfilesResult] = await Promise.all([
    role === "farmaceutico"
      ? supabase.rpc("get_dispensing_people", { p_ids: Array.from(relatedIds) })
      : supabase.rpc("get_workspace_people", {
          p_ids: Array.from(relatedIds),
          p_include_doctor_directory: role === "paciente",
        }),
    role === "admin"
      ? supabase.rpc("get_admin_profiles")
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (
    failedQuery(relatedPeopleResult.error) ||
    failedQuery(adminProfilesResult.error)
  ) {
    return apiFailure(
      "La base de datos no está lista para cargar el espacio de trabajo.",
      503,
    );
  }

  const peopleById = new Map<
    string,
    { id: string; nombre: string; apellido: string; rol: Profile["rol"] }
  >();
  for (const person of relatedPeopleResult.data ?? []) {
    peopleById.set(person.id, person);
  }
  const movements = (movementsResult.data ?? []) as Array<{
    id: string;
    medicamento_id: string;
    lote_id: string | null;
    tipo: string;
    cantidad_delta: number;
    motivo: string;
    referencia_id: string | null;
    usuario_id: string;
    created_at: string;
  }>;
  const inventoryHistory: Auditoria[] = movements.map((movement) => ({
    id: movement.id,
    usuario_id: movement.usuario_id,
    accion: movement.tipo,
    tabla_afectada: "inventory_movements",
    registro_id: movement.medicamento_id,
    datos_nuevos: {
      lote_id: movement.lote_id,
      cantidad_delta: movement.cantidad_delta,
      motivo: movement.motivo,
      referencia_id: movement.referencia_id,
    },
    created_at: movement.created_at,
  }));

  const workspace: Workspace = {
    profile,
    profiles:
      role === "admin"
        ? ((adminProfilesResult.data ?? []) as Profile[])
        : [profile],
    people: Array.from(peopleById.values()),
    citas,
    medicamentos: medicamentosResult.data ?? [],
    lotes: lotesResult.data ?? [],
    despachos,
    items: itemsResult.data ?? [],
    auditoria: auditoriaResult.data ?? [],
    horarios: horariosResult.data ?? [],
    inventoryHistory,
  };

  return apiSuccess(workspace);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  const account = await getActiveAccount();
  if (!account.ok) return account.response;

  const body = await parseJson(request, commandRecordSchema);
  if (!body.ok) return body.response;
  const parsedCommand = commandSchema.safeParse(body.value);
  const parsedCorrection = parsedCommand.success
    ? null
    : correctionSchema.safeParse(body.value);
  let command: z.infer<typeof commandSchema> | z.infer<typeof correctionSchema>;
  if (parsedCommand.success) {
    command = parsedCommand.data;
  } else if (parsedCorrection?.success) {
    command = parsedCorrection.data;
  } else {
    const issue = parsedCommand.error.issues[0] ?? parsedCorrection?.error.issues[0];
    return apiFailure(issue?.message ?? "Los datos de la operación no son válidos.", 400);
  }
  const db = account.supabase;
  let result: { data: unknown; error: { code?: string } | null };

  switch (command.type) {
    case "appointment.create":
      result = await db.rpc("create_appointment", {
        p_paciente_id: command.paciente_id, p_medico_id: command.medico_id,
        p_fecha: command.fecha, p_hora: command.hora, p_motivo: command.motivo,
      });
      break;
    case "appointment.update":
      result = await db.rpc("update_appointment", {
        p_cita_id: command.id, p_new_estado: command.estado ?? null,
        p_new_fecha: command.fecha ?? null, p_new_hora: command.hora ?? null,
      });
      break;
    case "profile.update":
      result = await db.rpc("update_own_profile", {
        p_nombre: command.nombre, p_apellido: command.apellido, p_telefono: command.telefono,
      });
      break;
    case "medication.create":
      result = await db.rpc("create_medication", {
        p_nombre: command.nombre, p_codigo: command.codigo, p_descripcion: command.descripcion,
        p_unidad_medida: command.unidad_medida, p_stock_minimo: command.stock_minimo,
        p_numero_lote: command.numero_lote, p_fecha_vencimiento: command.fecha_vencimiento,
        p_cantidad: command.cantidad,
      });
      break;
    case "stock.add":
      result = await db.rpc("add_stock", {
        p_medicamento_id: command.medicamento_id, p_numero_lote: command.numero_lote,
        p_fecha_vencimiento: command.fecha_vencimiento, p_cantidad: command.cantidad,
      });
      break;
    case "dispatch.create":
      result = await db.rpc("create_dispatch", {
        p_cita_id: command.cita_id, p_solicitud_id: command.solicitud_id, p_items: command.items,
      });
      break;
    case "user.create": {
      if (account.profile.rol !== "admin") return apiFailure("No tienes permiso para administrar usuarios.", 403);
      let admin;
      try { admin = createAdminClient(); }
      catch { return apiFailure("La administración de usuarios requiere configurar la clave de servicio en el contenedor.", 503); }
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: command.email, password: command.password, email_confirm: true,
      });
      if (createError || !created.user) {
        return apiFailure(createError?.code === "email_exists" ? "Ese correo ya está registrado." : "No se pudo crear la cuenta.", createError?.code === "email_exists" ? 409 : 503);
      }
      const { error: profileError } = await admin.rpc("create_profile_admin", {
        p_actor_id: account.user.id, p_user_id: created.user.id, p_email: command.email,
        p_nombre: command.nombre, p_apellido: command.apellido, p_telefono: command.telefono,
        p_documento: command.documento_identidad, p_rol: command.rol,
      });
      if (profileError) {
        const { error: quarantineError } = await admin.auth.admin.updateUserById(
          created.user.id,
          { ban_duration: "876000h" },
        );
        if (quarantineError) {
          console.error("[api.users] orphan auth account could not be disabled", {
            code: quarantineError.code,
          });
        } else {
          console.error("[api.users] orphan auth account disabled after profile failure", {
            code: profileError.code,
          });
        }
        if (profileError.code === "23505") return apiFailure("El correo o documento ya está registrado.", 409);
        console.error("[api.users] profile creation failed", { code: profileError.code });
        return apiFailure("No se pudo completar el perfil de la cuenta.", 503);
      }
      return apiSuccess({ id: created.user.id }, 201);
    }
    case "user.update":
      result = await db.rpc("update_user_admin", { p_id: command.id, p_rol: command.rol, p_activo: command.activo });
      break;
    case "medication.update":
      result = await db.rpc("update_medication", {
        p_id: command.id, p_nombre: command.nombre, p_codigo: command.codigo,
        p_descripcion: command.descripcion, p_unidad_medida: command.unidad_medida,
        p_stock_minimo: command.stock_minimo,
      });
      break;
    case "medication.archive":
      result = await db.rpc("archive_medication", { p_id: command.id, p_motivo: command.motivo });
      break;
    case "batch.update":
      result = await db.rpc("update_batch", {
        p_id: command.id, p_numero_lote: command.numero_lote,
        p_fecha_vencimiento: command.fecha_vencimiento, p_cantidad: command.cantidad,
        p_motivo: command.motivo,
      });
      break;
    case "schedule.save":
      result = await db.rpc("save_schedule", {
        p_id: command.id ?? null, p_medico_id: command.medico_id, p_fecha: command.fecha,
        p_desde: command.desde, p_hasta: command.hasta,
      });
      break;
    case "schedule.cancel":
      result = await db.rpc("cancel_schedule", { p_id: command.id });
      break;
    default:
      return apiFailure("Esta operación aún no está disponible.", 501);
  }

  const failure = rpcFailure(result.error);
  if (failure) return failure;
  if (result.error) return apiFailure("No se pudo guardar la operación.", 503);
  return apiSuccess({ result: result.data ?? true }, command.type.endsWith(".create") ? 201 : 200);
}
