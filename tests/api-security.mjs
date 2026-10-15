import assert from "node:assert/strict";

const baseURL = process.env.API_TEST_BASE_URL || "http://localhost:3000";
const origin = new URL(baseURL).origin;
const checks = [];

async function expectStatus(name, request, status) {
  const response = await fetch(new URL(request.path, baseURL), {
    method: request.method || "GET",
    headers: request.headers,
    body: request.body,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = response.headers.get("content-type") || "";
  assert.match(contentType, /application\/json/i, `${name}: response is JSON`);
  assert.equal(response.status, status, `${name}: HTTP status`);
  const payload = await response.json();
  assert.equal(typeof payload.ok, "boolean", `${name}: API envelope`);
  if (!payload.ok) {
    assert.equal(typeof payload.error, "string", `${name}: safe error message`);
    assert.doesNotMatch(
      payload.error,
      /service[_ -]?role|password|token|postgres|stack|secret/i,
      `${name}: no internal details in response`,
    );
  }
  checks.push(name);
}

const sameOrigin = { "content-type": "application/json", origin };
const id = "00000000-0000-4000-8000-000000000001";

await expectStatus(
  "workspace requiere sesión",
  { path: "/api/frontend/workspace" },
  401,
);
await expectStatus(
  "disponibilidad requiere sesión",
  {
    path: `/api/frontend/disponibilidad?medico=${id}&fecha=2026-10-16`,
  },
  401,
);

for (const [name, command] of [
  ["perfil", { type: "profile.update", nombre: "QA", apellido: "Sintético", telefono: "" }],
  ["cita", { type: "appointment.create", paciente_id: id, medico_id: id, fecha: "2026-10-16", hora: "09:00", motivo: "QA sintético" }],
  ["medicamento", { type: "medication.create", nombre: "QA", codigo: "QA", descripcion: "", unidad_medida: "unidad", stock_minimo: 0, numero_lote: "QA", fecha_vencimiento: "2027-01-01", cantidad: 1 }],
  ["usuario", { type: "user.create", email: "qa@example.invalid", password: "not-a-real-account", nombre: "QA", apellido: "Sintético", telefono: "", documento_identidad: "QA", rol: "paciente" }],
]) {
  await expectStatus(
    `mutación de ${name} requiere sesión`,
    {
      path: "/api/frontend/workspace",
      method: "POST",
      headers: sameOrigin,
      body: JSON.stringify(command),
    },
    401,
  );
}

await expectStatus(
  "origen cruzado bloqueado antes de autenticar",
  {
    path: "/api/frontend/workspace",
    method: "POST",
    headers: { ...sameOrigin, origin: "https://attacker.invalid" },
    body: JSON.stringify({ type: "profile.update" }),
  },
  403,
);
await expectStatus(
  "formato de acceso inválido rechazado",
  {
    path: "/api/auth/login",
    method: "POST",
    headers: sameOrigin,
    body: JSON.stringify({ email: "invalid", password: "x" }),
  },
  400,
);
await expectStatus(
  "payload JSON malformado rechazado",
  {
    path: "/api/auth/login",
    method: "POST",
    headers: sameOrigin,
    body: "{not-json",
  },
  400,
);
await expectStatus(
  "payload sobredimensionado rechazado",
  {
    path: "/api/auth/login",
    method: "POST",
    headers: sameOrigin,
    body: JSON.stringify({ email: "qa@example.invalid", password: "x".repeat(17_000) }),
  },
  413,
);

console.log(`${checks.length} comprobaciones de autenticación y seguridad API aprobadas.`);
