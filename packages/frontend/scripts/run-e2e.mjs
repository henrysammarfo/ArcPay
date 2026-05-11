import { spawn } from "node:child_process";
import { join } from "node:path";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isWindows = process.platform === "win32";

const server = spawn(
  isWindows ? "npm.cmd" : "npm",
  ["run", "dev", "--", "--hostname", "127.0.0.1"],
  {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    shell: isWindows,
    stdio: "inherit",
  },
);

let exitCode = 1;

try {
  await waitForHttp(baseUrl, 120_000);
  exitCode = await runPlaywright();
} finally {
  await stopProcessTree(server);
}

process.exit(exitCode);

async function runPlaywright() {
  return new Promise((resolve) => {
    const cliPath = join(process.cwd(), "../../node_modules/@playwright/test/cli.js");
    const child = spawn(process.execPath, [cliPath, "test", "--reporter=list"], {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
      stdio: "inherit",
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
    child.on("error", () => resolve(1));
  });
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Timed out waiting for ${url}.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ""}`,
  );
}

async function stopProcessTree(child) {
  if (child.exitCode !== null) {
    return;
  }

  if (isWindows && child.pid) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2500);
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.on("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      killer.on("error", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    return;
  }

  child.kill("SIGTERM");
}
