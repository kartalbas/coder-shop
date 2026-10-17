import { existsSync } from "node:fs";
import path from "node:path";

// Issue #38: repeatable LAN runs keep SESSION_SECRET and ADMIN_PASSWORD in `.env.local`
// (gitignored). `next start` loads that file itself; the tsx scripts do it here.
// Variables already present in the environment win over the file (Node's --env-file rule).
const file = process.env.ENV_FILE ?? path.resolve(process.cwd(), ".env.local");
if (existsSync(file)) process.loadEnvFile(file);
