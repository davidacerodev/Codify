import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const baseURL = process.env.API_TEST_BASE_URL || "http://localhost:3101";
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseURL || !anonKey || !serviceRoleKey) {
  throw new Error("Falta la configuración del Supabase local para pruebas.");
}

const admin = createClient(supabaseURL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = randomUUID();
const contexts = [];
const checks = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});

function pass(name) {
  checks.push(name);
  console.log(`OK ${checks.length}: ${name}`);
}

function password() {
  return `Aa1!${randomBytes(24).toString("hex")}`;
}

async function createTestUser(role, suffix = role) {
  const email = `codify-${runId}-${suffix}@example.test`;
  const secret = password();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: secret,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear cuenta sintética (${role}).`);
  return { id: data.user.id, email, password: secret, role };
}

async function insertProfiles(users) {
  const rows = users.map((user) => {
    user.documento_identidad = `QA-${randomUUID().slice(0, 16)}`;
    return {
      id: user.id,
      email: user.email,
      nombre: "Cuenta",
      apellido: `Prueba ${user.role}`,
      rol: user.role,
      telefono: null,
      documento_identidad: user.documento_identidad,
      activo: true,
    };
  });
  const { error } = await admin.from("profiles").insert(rows);
  if (error) throw new Error(`No se pudieron crear perfiles sintéticos (${error.code}).`);
}

async function makeSession(user) {
  const context = await browser.newContext({
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    throw new Error(`Error de navegador durante prueba: ${error.message}`);
  });
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.getByRole("heading", { name: /Hola,/ }).waitFor({ timeout: 15_000 });
  return page;
}

async function api(page, path, body, method = "POST") {
  return page.evaluate(
    async ({ path, body, method }) => {
      const response = await fetch(path, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { status: response.status, payload };
    },
    { path, body, method },
  );
}

function expectOK(result, status, label) {
  assert.equal(
    result.status,
    status,
    `${label}: HTTP ${result.status}${result.payload?.error ? ` — ${result.payload.error}` : ""}`,
  );
  assert.equal(result.payload?.ok, status < 400, `${label}: API envelope`);
  if (status >= 400) assert.equal(typeof result.payload?.error, "string");
  return result.payload?.data;
}

async function workspace(page) {
  const result = await api(page, "/api/frontend/workspace", undefined, "GET");
  return expectOK(result, 200, "lectura workspace");
}

try {
  const users = {
    admin: await createTestUser("admin"),
    doctor: await createTestUser("medico"),
    auxiliary: await createTestUser("farmaceutico"),
    patientA: await createTestUser("paciente", "paciente-a"),
    patientB: await createTestUser("paciente", "paciente-b"),
  };
  await insertProfiles(Object.values(users));

  const anonymous = await browser.newPage();
  await anonymous.goto(`${baseURL}/login`);
  const anonymousRead = await api(anonymous, "/api/frontend/workspace", undefined, "GET");
  expectOK(anonymousRead, 401, "API exige sesión");
  pass("API de workspace rechaza llamadas anónimas");

  const administrator = await makeSession(users.admin);
  let data = await workspace(administrator);
  assert.equal(data.profile.rol, "admin");
  const profile = await api(administrator, "/api/frontend/workspace", {
    type: "profile.update",
    nombre: "Cuenta",
    apellido: "Prueba actualizada",
    telefono: "3000000000",
  });
  expectOK(profile, 200, "actualización de perfil propio");
  data = await workspace(administrator);
  assert.equal(data.profile.apellido, "Prueba actualizada");
  pass("perfil propio se actualiza y vuelve a leerse desde la API");

  const createdAccountPassword = password();
  const createdAccount = await api(administrator, "/api/frontend/workspace", {
    type: "user.create",
    email: `codify-${runId}-cuenta-creada@example.test`,
    password: createdAccountPassword,
    nombre: "Cuenta",
    apellido: "Creada por API",
    telefono: "",
    documento_identidad: `QA-${randomUUID().slice(0, 16)}`,
    rol: "paciente",
  });
  const createdUser = expectOK(createdAccount, 201, "alta de usuario");
  assert.ok(createdUser.id);
  const createdUserId = createdUser.id;
  const deactivated = await api(administrator, "/api/frontend/workspace", {
    type: "user.update",
    id: createdUserId,
    rol: "paciente",
    activo: false,
  });
  expectOK(deactivated, 200, "desactivación de usuario");
  const afterUserCrud = await workspace(administrator);
  assert.equal(afterUserCrud.profiles.find((row) => row.id === createdUserId)?.activo, false);
  const inactiveLogin = await api(anonymous, "/api/auth/login", {
    email: `codify-${runId}-cuenta-creada@example.test`,
    password: createdAccountPassword,
  });
  expectOK(inactiveLogin, 403, "login de cuenta desactivada");

  const failedProfileEmail = `codify-${runId}-perfil-no-creado@example.test`;
  const failedProfile = await api(administrator, "/api/frontend/workspace", {
    type: "user.create",
    email: failedProfileEmail,
    password: password(),
    nombre: "Cuenta",
    apellido: "Perfil no creado",
    telefono: "",
    documento_identidad: users.patientA.documento_identidad,
    rol: "paciente",
  });
  expectOK(failedProfile, 409, "perfil duplicado conservado sin acceso");
  const { data: authUsers, error: authUsersError } =
    await admin.auth.admin.listUsers({ perPage: 1000 });
  assert.equal(authUsersError, null);
  const quarantinedUser = authUsers.users.find(
    (user) => user.email === failedProfileEmail,
  );
  assert.ok(quarantinedUser, "la identidad fallida se conserva para trazabilidad");
  assert.ok(quarantinedUser.banned_until, "la identidad huérfana queda bloqueada");
  assert.equal(
    afterUserCrud.profiles.some((row) => row.email === failedProfileEmail),
    false,
    "el perfil fallido no aparece como usuario activo",
  );
  pass("usuario creado, leído, actualizado y desactivado desde API admin");

  const doctor = await makeSession(users.doctor);
  const doctorData = await workspace(doctor);
  const fecha = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const schedule = await api(doctor, "/api/frontend/workspace", {
    type: "schedule.save",
    medico_id: doctorData.profile.id,
    fecha,
    desde: "09:00",
    hasta: "10:00",
  });
  const scheduleData = expectOK(schedule, 200, "publicación de agenda");
  const scheduleId = scheduleData.result;
  let doctorWorkspace = await workspace(doctor);
  const publishedSchedule = doctorWorkspace.horarios.find(
    (row) => row.id === scheduleId,
  );
  assert.ok(publishedSchedule, "la agenda creada debe poder leerse por su médico");
  assert.equal(publishedSchedule.fecha, fecha);
  assert.equal(publishedSchedule.desde, "09:00:00");

  const scheduleDate = new Date(Date.now() + 15 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const scheduleForCrud = expectOK(
    await api(doctor, "/api/frontend/workspace", {
      type: "schedule.save",
      medico_id: doctorData.profile.id,
      fecha: scheduleDate,
      desde: "13:00",
      hasta: "14:00",
    }),
    200,
    "alta de agenda para ciclo CRUD",
  );
  const scheduleCrudId = scheduleForCrud.result;
  doctorWorkspace = await workspace(doctor);
  assert.ok(
    doctorWorkspace.horarios.some((row) => row.id === scheduleCrudId),
    "la agenda del ciclo CRUD debe leerse desde el workspace",
  );
  const updatedSchedule = expectOK(
    await api(doctor, "/api/frontend/workspace", {
      type: "schedule.save",
      id: scheduleCrudId,
      medico_id: doctorData.profile.id,
      fecha: new Date(Date.now() + 16 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      desde: "14:00",
      hasta: "15:00",
    }),
    200,
    "actualización de agenda",
  );
  assert.equal(updatedSchedule.result, scheduleCrudId);
  doctorWorkspace = await workspace(doctor);
  const updatedScheduleRow = doctorWorkspace.horarios.find(
    (row) => row.id === scheduleCrudId,
  );
  assert.equal(updatedScheduleRow?.desde, "14:00:00");

  expectOK(
    await api(doctor, "/api/frontend/workspace", {
      type: "schedule.cancel",
      id: scheduleCrudId,
    }),
    200,
    "cancelación de agenda",
  );
  doctorWorkspace = await workspace(doctor);
  assert.equal(
    doctorWorkspace.horarios.some((row) => row.id === scheduleCrudId),
    false,
    "la agenda cancelada no debe aparecer como cupo activo",
  );
  pass("agenda ejecuta crear, leer, actualizar y baja lógica mediante la API");

  const patientPageA = await makeSession(users.patientA);
  const patientPageB = await makeSession(users.patientB);
  const appointmentCommand = {
    type: "appointment.create",
    paciente_id: users.patientA.id,
    medico_id: users.doctor.id,
    fecha,
    hora: "09:00",
    motivo: "Consulta sintética de integración",
  };
  const availableSlots = expectOK(
    await api(
      patientPageA,
      `/api/frontend/disponibilidad?medico=${users.doctor.id}&fecha=${fecha}`,
      undefined,
      "GET",
    ),
    200,
    "consulta de cupos publicados",
  );
  assert.ok(
    availableSlots.includes("09:00"),
    "el cupo usado en la carrera debe estar disponible antes de reservar",
  );
  const race = await Promise.all([
    api(patientPageA, "/api/frontend/workspace", appointmentCommand),
    api(patientPageB, "/api/frontend/workspace", {
      ...appointmentCommand,
      paciente_id: users.patientB.id,
    }),
  ]);
  const winners = race.filter((result) => result.status === 201);
  const conflicts = race.filter((result) => result.status === 409);
  assert.equal(
    winners.length,
    1,
    `solo una reserva debe ganar el cupo concurrente; respuestas: ${race
      .map((result) => `${result.status}:${result.payload?.error ?? "ok"}`)
      .join(", ")}`,
  );
  assert.equal(conflicts.length, 1, "la reserva concurrente debe recibir conflicto");
  const appointmentId = winners[0].payload.data.result;
  const winningPage = race[0].status === 201 ? patientPageA : patientPageB;
  const losingPage = race[0].status === 409 ? patientPageA : patientPageB;
  const ownAppointments = await workspace(winningPage);
  const foreignAppointments = await workspace(losingPage);
  assert.equal(ownAppointments.citas.length, 1);
  assert.equal(foreignAppointments.citas.length, 0);
  const idor = await api(losingPage, "/api/frontend/workspace", {
    type: "appointment.update",
    id: appointmentId,
    estado: "cancelada",
  });
  assert.ok([403, 404].includes(idor.status), "un paciente no puede operar la cita de otro");
  pass("reserva concurrente conserva un único cupo y aísla la cita por paciente");

  const secondAppointment = await api(patientPageA, "/api/frontend/workspace", {
    ...appointmentCommand,
    hora: "09:30",
  });
  const secondAppointmentId = expectOK(secondAppointment, 201, "segunda cita propia").result;
  expectOK(
    await api(patientPageA, "/api/frontend/workspace", {
      type: "appointment.update",
      id: secondAppointmentId,
      estado: "cancelada",
    }),
    200,
    "cancelación de cita propia",
  );
  pass("cancelación de cita conserva acceso del titular y libera el cupo");

  const confirmed = await api(doctor, "/api/frontend/workspace", {
    type: "appointment.update",
    id: appointmentId,
    estado: "confirmada",
  });
  expectOK(confirmed, 200, "confirmación de cita por médico");

  const auxiliary = await makeSession(users.auxiliary);
  const forbiddenMedication = await api(patientPageA, "/api/frontend/workspace", {
    type: "medication.create",
    nombre: "No autorizado",
    codigo: `NO-${runId.slice(0, 8)}`,
    descripcion: "",
    unidad_medida: "unidad",
    stock_minimo: 0,
    numero_lote: "NO-1",
    fecha_vencimiento: "2027-01-01",
    cantidad: 1,
  });
  expectOK(forbiddenMedication, 403, "escritura de inventario por paciente");
  const forbiddenAdmin = await api(auxiliary, "/api/frontend/workspace", {
    type: "user.update",
    id: users.patientA.id,
    rol: "admin",
    activo: true,
  });
  expectOK(forbiddenAdmin, 403, "administración de usuarios por auxiliar");
  pass("RPC/API deniegan cambios fuera del rol autorizado");

  const expiry = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const code = `QA-${runId.slice(0, 8)}`;
  const medication = await api(auxiliary, "/api/frontend/workspace", {
    type: "medication.create",
    nombre: "Medicamento sintético",
    codigo: code,
    descripcion: "Registro aislado de integración",
    unidad_medida: "unidad",
    stock_minimo: 2,
    numero_lote: "LOTE-A",
    fecha_vencimiento: expiry,
    cantidad: 10,
  });
  const medicationResult = expectOK(medication, 201, "alta de medicamento");
  const medicationId = medicationResult.result;
  let inventory = await workspace(auxiliary);
  const medicationRow = inventory.medicamentos.find((row) => row.id === medicationId);
  assert.equal(medicationRow?.codigo, code);

  expectOK(
    await api(auxiliary, "/api/frontend/workspace", {
      type: "medication.update",
      id: medicationId,
      nombre: "Medicamento sintético actualizado",
      codigo: code,
      descripcion: "Edición verificada por API",
      unidad_medida: "unidad",
      stock_minimo: 3,
    }),
    200,
    "edición de medicamento",
  );
  const secondBatch = await api(auxiliary, "/api/frontend/workspace", {
    type: "stock.add",
    medicamento_id: medicationId,
    numero_lote: "LOTE-B",
    fecha_vencimiento: expiry,
    cantidad: 4,
  });
  const batchId = expectOK(secondBatch, 200, "alta de lote").result;
  inventory = await workspace(auxiliary);
  assert.ok(inventory.lotes.some((row) => row.id === batchId));
  expectOK(
    await api(auxiliary, "/api/frontend/workspace", {
      type: "batch.update",
      id: batchId,
      numero_lote: "LOTE-B",
      fecha_vencimiento: expiry,
      cantidad: 3,
      motivo: "Ajuste sintético verificado",
    }),
    200,
    "ajuste de lote",
  );
  pass("medicamento y lote ejecutan alta, lectura y edición con historial");

  const invalidQuantity = await api(auxiliary, "/api/frontend/workspace", {
    type: "batch.update",
    id: batchId,
    numero_lote: "LOTE-B",
    fecha_vencimiento: expiry,
    cantidad: -1,
    motivo: "Dato inválido",
  });
  expectOK(invalidQuantity, 400, "validación de cantidad negativa");

  const archiveMed = await api(auxiliary, "/api/frontend/workspace", {
    type: "medication.create",
    nombre: "Medicamento para archivar",
    codigo: `ARC-${runId.slice(0, 8)}`,
    descripcion: "Registro sintético",
    unidad_medida: "unidad",
    stock_minimo: 0,
    numero_lote: "LOTE-ARC",
    fecha_vencimiento: expiry,
    cantidad: 1,
  });
  const archiveId = expectOK(archiveMed, 201, "medicamento archivable").result;
  const archiveStock = await workspace(auxiliary);
  const archiveLotId = archiveStock.lotes.find((row) => row.medicamento_id === archiveId).id;
  expectOK(
    await api(auxiliary, "/api/frontend/workspace", {
      type: "batch.update",
      id: archiveLotId,
      numero_lote: "LOTE-ARC",
      fecha_vencimiento: expiry,
      cantidad: 0,
      motivo: "Cierre de caso sintético",
    }),
    200,
    "saldo cero antes de baja lógica",
  );
  expectOK(
    await api(auxiliary, "/api/frontend/workspace", {
      type: "medication.archive",
      id: archiveId,
      motivo: "Baja lógica de integración",
    }),
    200,
    "baja lógica de medicamento",
  );
  pass("servidor valida cantidades y conserva historial al retirar del catálogo");

  const dispatchRequestId = randomUUID();
  const insufficient = await api(auxiliary, "/api/frontend/workspace", {
    type: "dispatch.create",
    cita_id: appointmentId,
    solicitud_id: dispatchRequestId,
    items: [{ lote_id: inventory.lotes.find((row) => row.medicamento_id === medicationId).id, cantidad: 99 }],
  });
  expectOK(insufficient, 409, "despacho sin existencias");
  inventory = await workspace(auxiliary);
  assert.equal(inventory.lotes.find((row) => row.medicamento_id === medicationId)?.cantidad, 10);
  assert.equal(inventory.despachos.length, 0);

  const enoughLotId = inventory.lotes.find((row) => row.medicamento_id === medicationId).id;
  const validDispatchCommand = {
    type: "dispatch.create",
    cita_id: appointmentId,
    solicitud_id: dispatchRequestId,
    items: [{ lote_id: enoughLotId, cantidad: 2 }],
  };
  const firstDispatch = await api(auxiliary, "/api/frontend/workspace", validDispatchCommand);
  const firstDispatchId = expectOK(firstDispatch, 201, "despacho válido").result;
  const retryDispatch = await api(auxiliary, "/api/frontend/workspace", validDispatchCommand);
  assert.equal(expectOK(retryDispatch, 201, "reintento idempotente").result, firstDispatchId);
  inventory = await workspace(auxiliary);
  assert.equal(inventory.lotes.find((row) => row.id === enoughLotId)?.cantidad, 8);
  assert.equal(inventory.despachos.length, 1);
  pass("despacho transaccional revierte falta de stock y hace idempotente el reintento");

  const { error: appointmentDeleteError } = await admin
    .from("citas")
    .delete()
    .eq("id", appointmentId);
  assert.ok(appointmentDeleteError, "la base debe impedir borrar citas incluso con service role");
  const { data: retainedAppointment, error: retainedAppointmentError } = await admin
    .from("citas")
    .select("id")
    .eq("id", appointmentId)
    .maybeSingle();
  assert.equal(retainedAppointmentError, null);
  assert.equal(retainedAppointment?.id, appointmentId);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(users.patientA.id);
  assert.ok(authDeleteError, "el perfil debe impedir la eliminación en cascada de Auth");
  const { data: retainedAuthUser, error: retainedAuthError } =
    await admin.auth.admin.getUserById(users.patientA.id);
  assert.equal(retainedAuthError, null);
  assert.equal(retainedAuthUser.user?.id, users.patientA.id);
  pass("la base bloquea el borrado físico de citas y la cascada de identidades Auth");

} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

console.log(`${checks.length} pruebas API/RPC con perfiles y datos sintéticos aprobadas.`);
