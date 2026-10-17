// Issue #38: one repeatable command to run the shop for the user on the LAN.
// Ensures `.env.local` (gitignored, mode 600) holds a strong SESSION_SECRET and a
// known ADMIN_PASSWORD, seeds the database with them, and prints how to start.
import "../load-env";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseEnvAssignments, planEnvFile, renderAdditions } from "./env-file";

const REQUIRED = ["SESSION_SECRET", "ADMIN_PASSWORD"] as const;
const ENV_FILE = process.env.ENV_FILE ?? path.resolve(".env.local");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@codershop.ch";

function generate(key: string): string {
  // SESSION_SECRET must satisfy the production minimum (≥ 32 chars); 48 random
  // bytes base64url give 64. The admin password gets 16 URL-safe characters.
  const bytes = key === "SESSION_SECRET" ? 48 : 12;
  return randomBytes(bytes).toString("base64url");
}

const existingText = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
const plan = planEnvFile(parseEnvAssignments(existingText), REQUIRED, generate);
if (plan.additions.length > 0) {
  fs.appendFileSync(ENV_FILE, renderAdditions(plan.additions));
  fs.chmodSync(ENV_FILE, 0o600);
  console.log(`.env.local ergänzt: ${plan.generated.join(", ")} (Datei ist gitignored)`);
} else {
  console.log(".env.local enthält bereits SESSION_SECRET und ADMIN_PASSWORD — unverändert.");
}

const values = parseEnvAssignments(fs.readFileSync(ENV_FILE, "utf8"));

console.log("Seed mit den Werten aus .env.local…");
const seed = spawn(
  process.execPath,
  [path.join("node_modules", ".bin", "tsx"), path.join("scripts", "seed", "seed.ts")],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // The seed script skips main() when VITEST is set (tests import it) — a test
      // spawning this setup must not accidentally disable the seed it is verifying.
      VITEST: undefined,
      SESSION_SECRET: values.SESSION_SECRET,
      ADMIN_PASSWORD: values.ADMIN_PASSWORD,
    },
  },
);
seed.on("exit", (code) => {
  if (code !== 0) {
    console.error("Seed fehlgeschlagen — siehe Ausgabe oben.");
    process.exit(code ?? 1);
  }
  console.log(`
Shop im Netz starten (Produktion):
  npm run build
  npm run start -- -H 0.0.0.0 -p 4000

Öffnen:  http://<IP dieses Rechners>:4000   (Admin: /admin)
Login:   ${ADMIN_EMAIL} / ${values.ADMIN_PASSWORD}
(Beides steht in ${ENV_FILE}; das Passwort lässt sich im Admin-Dashboard ändern.)
`);
});
