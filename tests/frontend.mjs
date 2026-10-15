// Ejecutar con npm run test:ui (el runner inicia una app demo).
// La suite usa un contexto nuevo y datos demo: no modifica el Supabase del equipo.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "es-CO",
  timezoneId: "America/Bogota",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log(`OK ${count}: ${name}`);
}
async function open(path) {
  await page.goto(baseURL + path);
}
async function login(role) {
  await open("/login");
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Entrar a la demostración" }).click();
  await page.getByRole("heading", { name: /Hola,/ }).waitFor();
}
const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
try {
  await mkdir("test-results", { recursive: true });
  await test("Acceso y navegación principal", async () => {
    await open("/login");
    await page
      .getByRole("button", { name: "Entrar a la demostración" })
      .waitFor();
    await page.screenshot({
      path: "test-results/login.png",
      fullPage: true,
      animations: "disabled",
    });
    await login("Administrador");
    await page.screenshot({
      path: "test-results/dashboard.png",
      fullPage: true,
      animations: "disabled",
    });
    assert.ok(
      await page
        .getByRole("link", { name: "Inventario", exact: true })
        .isVisible(),
    );
  });
  await test("Paciente agenda y reprograma su cita", async () => {
    await login("Paciente");
    await open("/citas/nueva");
    await page.getByLabel("Fecha seleccionada").fill(future);
    await page.getByRole("button", { name: "14:00", exact: true }).click();
    await page
      .getByLabel("Motivo de la cita")
      .fill("Cita de prueba de interfaz");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirmar cita", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Tu solicitud quedó registrada" })
      .waitFor();
    await open("/citas");
    await page
      .getByRole("row")
      .filter({ hasText: "Cita de prueba de interfaz" })
      .getByRole("button", { name: /Ver detalle/ })
      .click();
    await page.getByLabel("Nueva hora").selectOption("14:30");
    await page.getByRole("button", { name: "Guardar nuevo horario" }).click();
    await page.getByText("La cita se actualizó correctamente.").waitFor();
    assert.match(
      await page
        .getByRole("row")
        .filter({ hasText: "Cita de prueba de interfaz" })
        .innerText(),
      /14:30/,
    );
  });
  await test("Paciente cancela y no entra al módulo de usuarios", async () => {
    await page
      .getByRole("row")
      .filter({ hasText: "Cita de prueba de interfaz" })
      .getByRole("button", { name: /Ver detalle/ })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Cancelar cita", exact: true })
      .click();
    await page.getByRole("button", { name: "Historial", exact: true }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "Cita de prueba de interfaz" })
      .waitFor();
    await open("/usuarios");
    await page
      .getByRole("heading", { name: "No tienes acceso a esta sección" })
      .waitFor();
  });
  await test("Registrar medicamento y entrada de un segundo lote", async () => {
    await login("Administrador");
    await open("/inventario/nuevo");
    await page.getByLabel("Nombre *", { exact: true }).fill("Medicamento QA");
    await page.getByLabel("Código interno *").fill("QA-01");
    await page.getByLabel("Presentación / unidad *").fill("Unidad de prueba");
    await page.getByLabel("Stock mínimo *").fill("3");
    await page.getByLabel("Número de lote *").fill("QA-A");
    await page.getByLabel("Stock inicial *").fill("18");
    await page.getByLabel("Fecha de vencimiento *").fill(future);
    await page.getByRole("button", { name: "Guardar medicamento" }).click();
    const row = page
      .locator("table")
      .first()
      .getByRole("row")
      .filter({ hasText: "Medicamento QA" });
    await row.waitFor();
    await row.getByRole("button", { name: "Ver lotes" }).click();
    await page.getByRole("button", { name: "Registrar nueva entrada" }).click();
    await page.getByLabel("Nuevo número de lote").fill("QA-B");
    await page.getByLabel("Cantidad", { exact: true }).fill("7");
    await page.getByLabel("Fecha de vencimiento", { exact: true }).fill(future);
    await page.getByRole("button", { name: "Guardar entrada" }).click();
    await page
      .getByText("Entrada registrada. Las existencias se actualizaron.")
      .waitFor();
    assert.match(await row.innerText(), /25/);
  });
  await test("Una entrega descuenta el stock y aparece en el historial", async () => {
    await open("/despacho");
    await page
      .getByLabel("Paciente y cita")
      .selectOption("10000000-0000-4000-8000-000000000010");
    const option = page
      .getByLabel("Medicamento 1", { exact: true })
      .locator("option")
      .filter({ hasText: /Medicamento QA · QA-A/ });
    const value = await option.getAttribute("value");
    assert.ok(value);
    await page.getByLabel("Medicamento 1", { exact: true }).selectOption(value);
    await page.getByLabel("Cantidad 1", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Confirmar despacho" }).click();
    await page
      .getByText(
        "Despacho registrado. Las cantidades fueron descontadas del inventario.",
      )
      .waitFor();
    await page
      .getByRole("row")
      .filter({ hasText: "Medicamento QA × 4" })
      .waitFor();
    await open("/inventario");
    assert.match(
      await page
        .locator("table")
        .first()
        .getByRole("row")
        .filter({ hasText: "Medicamento QA" })
        .innerText(),
      /21/,
    );
  });
  await test("Crear usuario y desactivarlo preserva sus datos", async () => {
    await open("/usuarios");
    await page.getByRole("button", { name: "Nuevo usuario" }).click();
    await page.getByLabel("Nombres", { exact: true }).fill("Usuario");
    await page.getByLabel("Apellidos", { exact: true }).fill("Prueba UI");
    await page
      .getByLabel("Correo electrónico", { exact: true })
      .fill("qa-ui@example.com");
    await page
      .getByLabel("Documento de identidad", { exact: true })
      .fill("QA-TEST-01");
    await page
      .getByRole("button", { name: "Crear usuario", exact: true })
      .click();
    const row = page.getByRole("row").filter({ hasText: "qa-ui@example.com" });
    await row.waitFor();
    await row.getByRole("button", { name: "Administrar" }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("false");
    await page.getByRole("button", { name: "Guardar permisos" }).click();
    await page.getByText("Permisos actualizados.").waitFor();
    assert.match(await row.innerText(), /Usuario Prueba UI/);
    assert.match(await row.innerText(), /Inactivo/);
  });
  await test("Perfil editable y cambios persistentes al recargar", async () => {
    await open("/perfil");
    await page.getByRole("button", { name: "Editar información" }).click();
    await page.getByLabel("Nombres", { exact: true }).fill("Laura QA");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page
      .getByText("Tu información se actualizó correctamente.")
      .waitFor();
    await page.reload();
    await page.getByLabel("Nombres", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Nombres", { exact: true }).inputValue(),
      "Laura QA",
    );
  });
  await test("Historial filtrable y exportación CSV", async () => {
    await open("/registros");
    await page
      .getByLabel("Buscar acción o usuario…")
      .fill("Medicamentos entregados");
    await page
      .getByRole("row")
      .filter({ hasText: "Medicamentos entregados" })
      .waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar vista" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "historial-codify.csv");
    assert.equal(await download.failure(), null);
  });
  await test("El médico consulta inventario y el auxiliar administra despachos", async () => {
    await login("Médico");
    assert.equal(
      await page.getByRole("link", { name: "Despachos", exact: true }).count(),
      0,
    );
    await open("/inventario");
    assert.equal(
      await page.getByRole("link", { name: "Registrar medicamento" }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Editar medicamento" }).count(),
      0,
    );
    await login("Auxiliar de enfermería");
    assert.equal(
      await page.getByRole("link", { name: "Usuarios", exact: true }).count(),
      0,
    );
    await page.getByRole("link", { name: "Despachos", exact: true }).click();
    await page
      .getByRole("heading", { name: "Despacho de medicamentos" })
      .waitFor();
  });
  const agendaDate = new Date(Date.now() + 86400000 * 21)
    .toISOString()
    .slice(0, 10);
  await test("Médico publica, edita y valida cruces de horarios", async () => {
    await login("Médico");
    assert.equal(await page.locator(".welcome-strip").count(), 0);
    await page
      .getByRole("link", { name: /Unidades despachadas hoy/ })
      .waitFor();
    await page.screenshot({
      path: "test-results/correcciones-inicio.png",
      fullPage: true,
      animations: "disabled",
    });
    await open("/horarios");
    await page
      .getByRole("heading", { name: "Mis horarios de atención" })
      .waitFor();
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page
      .getByRole("button", { name: "Publicar horario", exact: true })
      .click();
    await page.getByLabel("Hora de inicio").fill("18:00");
    await page.getByLabel("Hora de fin").fill("19:00");
    await page
      .getByRole("button", { name: "Guardar horario", exact: true })
      .click();
    await page
      .getByText("Horario publicado. Los cupos ya se pueden consultar.")
      .waitFor();
    await page
      .getByRole("button", { name: "Editar horario", exact: true })
      .click();
    await page.getByLabel("Hora de inicio").fill("18:30");
    await page.getByLabel("Hora de fin").fill("19:30");
    await page
      .getByRole("button", { name: "Guardar horario", exact: true })
      .click();
    await page.getByText("Horario actualizado.", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Publicar horario", exact: true })
      .click();
    await page.getByLabel("Hora de inicio").fill("19:00");
    await page.getByLabel("Hora de fin").fill("20:00");
    await page
      .getByRole("button", { name: "Guardar horario", exact: true })
      .click();
    await page
      .getByText("Este rango se cruza con otro horario publicado.")
      .waitFor();
    await page
      .getByRole("button", { name: "Cerrar ventana", exact: true })
      .click();
    await page.reload();
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page.getByText("18:30 – 19:30", { exact: true }).waitFor();
    await page.screenshot({
      path: "test-results/correcciones-agenda.png",
      fullPage: true,
      animations: "disabled",
    });
  });
  await test("Auxiliar consulta cupos sin modificar la agenda", async () => {
    await login("Auxiliar de enfermería");
    await page
      .getByRole("link", { name: "Disponibilidad", exact: true })
      .click();
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page.getByText(/2 cupos libres/).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Publicar horario", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Editar horario", exact: true })
        .count(),
      0,
    );
    await page.screenshot({
      path: "test-results/correcciones-auxiliar.png",
      fullPage: true,
      animations: "disabled",
    });
  });
  await test("Paciente reserva solamente cupos publicados y no duplica horario", async () => {
    await login("Paciente");
    await open("/citas/nueva");
    await page.getByLabel("Fecha seleccionada").fill(agendaDate);
    await page.getByRole("button", { name: "18:30", exact: true }).click();
    await page
      .getByLabel("Motivo de la cita")
      .fill("Consulta con horario publicado QA");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirmar cita", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Tu solicitud quedó registrada" })
      .waitFor();
    await open("/citas/nueva");
    await page.getByLabel("Fecha seleccionada").fill(agendaDate);
    await page.getByRole("button", { name: "19:00", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "18:30", exact: true }).count(),
      0,
    );
    await page
      .getByLabel("Fecha seleccionada")
      .fill(new Date(Date.now() + 86400000 * 22).toISOString().slice(0, 10));
    await page
      .getByText(
        "No hay cupos libres publicados para esta fecha. Selecciona otro día.",
      )
      .waitFor();
  });
  await test("La cancelación de horarios protege las citas reservadas", async () => {
    await login("Médico");
    await open("/horarios");
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Cancelar horario", exact: true })
      .click();
    await page
      .getByText(
        "Este horario tiene citas. Cancela o reprograma esas citas antes de retirar sus cupos.",
      )
      .waitFor();
    await open("/citas");
    const appointment = page
      .getByRole("row")
      .filter({ hasText: "Consulta con horario publicado QA" });
    await appointment.getByRole("button", { name: /Ver detalle/ }).click();
    await page.getByLabel("Nueva hora").selectOption("19:00");
    await page
      .getByRole("button", { name: "Guardar nuevo horario", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await appointment.getByRole("button", { name: /Ver detalle/ }).click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Cancelar cita", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    page.once("dialog", (d) => d.accept());
    await open("/horarios");
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page
      .getByRole("button", { name: "Cancelar horario", exact: true })
      .click();
    await page
      .getByText("Horario cancelado. Sus cupos dejaron de estar disponibles.")
      .waitFor();
    await login("Auxiliar de enfermería");
    await open("/horarios");
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page
      .getByRole("heading", {
        name: "No hay horarios publicados para esta fecha",
      })
      .waitFor();
  });
  await test("Auxiliar edita inventario y consulta las salidas", async () => {
    await login("Auxiliar de enfermería");
    await open("/inventario");
    const row = page
      .locator("table")
      .first()
      .getByRole("row")
      .filter({ hasText: "Medicamento QA" });
    await row
      .getByRole("button", { name: "Editar medicamento", exact: true })
      .click();
    await page
      .getByLabel("Nombre del medicamento", { exact: true })
      .fill("Medicamento QA corregido");
    await page
      .getByRole("button", { name: "Guardar medicamento", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page
      .locator("table")
      .first()
      .getByText("Medicamento QA corregido", { exact: true })
      .waitFor();
    await page.getByLabel("Tipo de movimiento").selectOption("salida");
    const movement = page
      .locator("#historial")
      .getByRole("row")
      .filter({ hasText: "Salida por despacho" });
    assert.match(await movement.innerText(), /-4/);
    await page.screenshot({
      path: "test-results/correcciones-inventario.png",
      fullPage: true,
      animations: "disabled",
    });
    await row.getByRole("button", { name: "Retirar del catálogo", exact: true }).click();
    await page.getByLabel("Escribe QA-01 para confirmar").fill("QA-01");
    await page
      .getByLabel("Motivo del retiro")
      .fill("Prueba de conservación de stock");
    await page.getByRole("button", { name: "Confirmar retiro" }).click();
    await page
      .getByText(
        "Hay existencias en sus lotes. Registra la salida o el ajuste justificado antes de retirar el medicamento del catálogo.",
      )
      .waitFor();
    await page
      .getByRole("button", { name: "Cerrar ventana", exact: true })
      .click();
  });
  await test("Ajustes justificados y retiro del catálogo conservan los registros históricos", async () => {
    const row = page
      .locator("table")
      .first()
      .getByRole("row")
      .filter({ hasText: "Medicamento QA corregido" });
    await row.getByRole("button", { name: "Ver lotes", exact: true }).click();
    for (const lot of ["QA-A", "QA-B"]) {
      await page
        .locator(".batch-list > div")
        .filter({ hasText: lot })
        .getByRole("button", { name: "Actualizar lote", exact: true })
        .click();
      await page.getByLabel("Existencias contadas").fill("0");
      await page
        .getByLabel("Motivo del ajuste")
        .fill("Baja de prueba documentada QA");
      await page
        .getByRole("button", { name: "Guardar ajuste", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Actualizar lote", exact: true })
        .waitFor({ state: "hidden" });
    }
    await page
      .getByRole("button", { name: "Cerrar ventana", exact: true })
      .click();
    await row.getByRole("button", { name: "Retirar del catálogo", exact: true }).click();
    await page.getByLabel("Escribe QA-01 para confirmar").fill("QA-01");
    await page
      .getByLabel("Motivo del retiro")
      .fill("Retiro del catálogo de prueba");
    await page.getByRole("button", { name: "Confirmar retiro" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page
      .getByRole("heading", { name: "Inventario", exact: true })
      .waitFor();
    assert.equal(await row.count(), 0);
    await page.getByLabel("Tipo de movimiento").selectOption("retiro");
    await page
      .locator("#historial")
      .getByText("Medicamento retirado del catálogo", { exact: true })
      .waitFor();
    await page.getByLabel("Tipo de movimiento").selectOption("salida");
    assert.equal(
      await page
        .locator("#historial")
        .getByRole("row")
        .filter({ hasText: "Salida por despacho" })
        .count(),
      1,
    );
    assert.equal(
      await page
        .locator("#historial")
        .getByRole("row")
        .filter({ hasText: "Lote actualizado" })
        .count(),
      2,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await open("/horarios");
    await page.getByLabel("Fecha de disponibilidad").fill(agendaDate);
    await page.screenshot({
      path: "test-results/correcciones-movil.png",
      fullPage: true,
      animations: "disabled",
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await test("Vista móvil y menú accesible sin desbordamiento de página", async () => {
    await login("Administrador");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/dashboard-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await page.getByRole("link", { name: "Inventario", exact: true }).click();
    await page
      .getByRole("heading", { name: "Inventario", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
  });
  await test("Cerrar sesión y bloquear vuelta a la pantalla protegida", async () => {
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await page.getByRole("heading", { name: "Bienvenido de nuevo" }).waitFor();
    await open("/dashboard");
    await page.getByRole("heading", { name: "Bienvenido de nuevo" }).waitFor();
  });
  assert.deepEqual(
    errors,
    [],
    "No debe haber errores de ejecución en el navegador.",
  );
  console.log(
    `\n${count} recorridos de interfaz aprobados, sin errores de ejecución.`,
  );
} catch (error) {
  await page
    .screenshot({ path: "test-results/failure.png", fullPage: true })
    .catch(() => {});
  console.error((await page.locator("body").innerText()).slice(-4500));
  throw error;
} finally {
  await browser.close();
}
