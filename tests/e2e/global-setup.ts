import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const REPO_ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.E2E_PORT ?? 3100);
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;

function run(bin: string, args: string[], env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${path.basename(bin)} exited with code ${code}`)),
    );
  });
}

async function waitForHealth(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no attempt yet";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL);
      const body = (await response.json()) as { ok?: boolean };
      if (body.ok) return;
      lastError = JSON.stringify(body);
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become healthy at ${HEALTH_URL}: ${lastError}`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (!fs.existsSync(path.join(REPO_ROOT, ".next", "BUILD_ID"))) {
    throw new Error(
      "No production build found — run `npm run build` before `npm run test:e2e`.",
    );
  }

  console.log("[e2e] starting throw-away MongoDB replica set…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const mongoUri = replSet.getUri("codershop-e2e");
  process.env.MONGODB_URI = mongoUri;

  console.log("[e2e] seeding a fresh database…");
  await run(path.join(REPO_ROOT, "node_modules", ".bin", "tsx"), ["scripts/seed/seed.ts", "--fresh"], {
    MONGODB_URI: mongoUri,
  });

  console.log(`[e2e] starting production build on port ${PORT}…`);
  const server: ChildProcess = spawn(
    process.execPath,
    [
      path.join(REPO_ROOT, "node_modules", "next", "dist", "bin", "next"),
      "start",
      "-p",
      String(PORT),
      "-H",
      "127.0.0.1",
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        MONGODB_URI: mongoUri,
        SESSION_SECRET: randomBytes(48).toString("base64"),
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (chunk: Buffer) => process.stdout.write(`[server] ${chunk}`));
  server.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[server] ${chunk}`));
  const serverExit = new Promise<never>((_, reject) =>
    server.on("exit", (code) => reject(new Error(`next start exited early (code ${code})`))),
  );
  await Promise.race([waitForHealth(), serverExit]);

  return async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.on("exit", resolve);
      setTimeout(() => server.kill("SIGKILL"), 10_000).unref();
    });
    await replSet.stop();
    delete process.env.MONGODB_URI;
    console.log("[e2e] server and database stopped");
  };
}
