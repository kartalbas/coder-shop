import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Gate recovery (recurring orphaned-mongod failure): every API route reads per-request
// data, so every one must call `connection()` before touching the database. A route
// without it is prerendered at build time — which (a) bakes live configuration into
// static JSON (admin edits never arrive) and (b) boots the embedded MongoDB inside a
// build worker that is killed without cleanup, orphaning the mongod on data/mongo and
// locking out every later dev/seed/server start (/api/health 500, DBPathInUse). The
// #64 `/api/shop-settings` route is exactly how that happened; this guard keeps the
// whole surface honest (same static-check style as tests/lib-purity.test.ts, #35).

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (entry.name === "route.ts") found.push(full);
  }
  return found;
}

describe("API routes are dynamic (#37 rule, gate recovery)", () => {
  const routes = routeFiles(path.join(process.cwd(), "src/app"));

  it("finds the route handlers", () => {
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });

  it.each(routes.map((file) => [path.relative(process.cwd(), file)]))(
    "%s calls connection() before any data access",
    (relative) => {
      const source = fs.readFileSync(relative, "utf8");
      expect(source).toContain("connection()");
    },
  );
});
