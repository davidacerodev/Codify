// Mantiene el servidor y el navegador en el mismo proceso de prueba.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.TEST_PORT || "3100";
const suppliedURL = process.env.TEST_BASE_URL;
const url = suppliedURL || `http://127.0.0.1:${port}`;
let server;
let log = "";
try {
  if (!suppliedURL) {
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        port,
      ],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_DEMO_MODE: "true",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout.on("data", (chunk) => {
      log = (log + chunk).slice(-6000);
    });
    server.stderr.on("data", (chunk) => {
      log = (log + chunk).slice(-6000);
    });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null)
        throw new Error(`El servidor terminó antes de iniciar.\n${log}`);
      try {
        const response = await fetch(url + "/login", {
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Aún compilando. */
      }
      await delay(500);
    }
    if (!ready) throw new Error(`El servidor de prueba no respondió.\n${log}`);
  }
  const test = spawn(process.execPath, ["tests/frontend.mjs"], {
    env: { ...process.env, TEST_BASE_URL: url },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    test.on("error", reject);
    test.on("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(4000),
    ]);
  }
}
