import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.TEST_PORT || "3101";
const baseURL = process.env.API_TEST_BASE_URL || `http://localhost:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
let testExitCode = 1;
server.stdout.on("data", (chunk) => (log = (log + chunk).slice(-5000)));
server.stderr.on("data", (chunk) => (log = (log + chunk).slice(-5000)));

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`Next terminó al iniciar.\n${log}`);
    try {
      const response = await fetch(`${baseURL}/login`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Next aún está compilando.
    }
    await delay(500);
  }
  if (!ready) throw new Error(`Next no quedó disponible.\n${log}`);

  const test = spawn(process.execPath, ["tests/api-integration.mjs"], {
    env: { ...process.env, API_TEST_BASE_URL: baseURL },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    test.on("error", reject);
    test.on("exit", (code) => resolve(code ?? 1));
  });
  testExitCode = exitCode;
} finally {
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(4000),
  ]);
  const reset = spawn(
    "node_modules/.bin/supabase",
    ["db", "reset", "--local", "--yes"],
    { env: process.env, stdio: "ignore" },
  );
  const resetCode = await new Promise((resolve) =>
    reset.on("exit", (code) => resolve(code ?? 1)),
  );
  if (resetCode !== 0) {
    console.error("No se pudo restablecer Supabase local después de las pruebas.");
    process.exitCode = 1;
  } else {
    console.log("Supabase local restablecido; datos sintéticos retirados.");
  }
}
if (process.exitCode !== 1) process.exitCode = testExitCode;
