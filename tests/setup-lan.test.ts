import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/server/password";
import {
  parseEnvAssignments,
  planEnvFile,
  renderAdditions,
} from "../scripts/setup/env-file";

describe("env-file helpers (issue #38)", () => {
  it("parses assignments, ignoring comments and quotes, last value wins", () => {
    const values = parseEnvAssignments(
      [
        "# comment",
        "A=1",
        'B="two"',
        "export C = three ",
        "# D=commented",
        "A=2",
        "leer=",
        "KEY WITH SPACE=x",
      ].join("\n"),
    );
    expect(values).toEqual({ A: "2", B: "two", C: "three", leer: "" });
  });

  it("generates every missing required value and keeps existing ones", () => {
    let n = 0;
    const gen = () => `gen-${++n}`;
    const plan = planEnvFile(
      { SESSION_SECRET: "already-set", ADMIN_PASSWORD: "  " },
      ["SESSION_SECRET", "ADMIN_PASSWORD"],
      gen,
    );
    expect(plan.additions).toEqual([{ key: "ADMIN_PASSWORD", value: "gen-1" }]);
    expect(plan.generated).toEqual(["ADMIN_PASSWORD"]);
    expect(renderAdditions(plan.additions)).toBe("\nADMIN_PASSWORD=gen-1\n");
    expect(renderAdditions([])).toBe("");
  });
});

describe("npm run setup:lan (issue #38: repeatable LAN run)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-lan-"));
  const envFile = path.join(tmpDir, ".env.local");

  // The seed (and the server) use the "codershop" database of MONGODB_URI
  // (src/server/db.ts), not the URI's own database — read the same one here.
  let conn: mongoose.Connection;
  beforeAll(async () => {
    conn = await mongoose
      .createConnection(process.env.MONGODB_URI!, { dbName: "codershop" })
      .asPromise();
  });
  afterAll(() => conn.close());

  async function adminPasswordHash(): Promise<string | undefined> {
    const user = await conn
      .collection("users")
      .findOne<{ passwordHash?: string }>({ email: "admin@codershop.ch" });
    return user?.passwordHash;
  }

  function runSetup(): string {
    return execFileSync(
      process.execPath,
      [path.join("node_modules", ".bin", "tsx"), path.join("scripts", "setup", "setup-lan.ts")],
      {
        encoding: "utf8",
        timeout: 240_000,
        env: {
          ...process.env,
          ENV_FILE: envFile,
          ADMIN_PASSWORD: "",
          SESSION_SECRET: "",
        },
      },
    );
  }

  it("creates .env.local with a strong secret and a known password, seeds, and prints the login", async () => {
    const output = runSetup();
    const values = parseEnvAssignments(fs.readFileSync(envFile, "utf8"));
    expect((values.SESSION_SECRET ?? "").length).toBeGreaterThanOrEqual(32);
    expect((values.ADMIN_PASSWORD ?? "").length).toBeGreaterThanOrEqual(12);
    expect(output).toContain(values.ADMIN_PASSWORD);
    expect(fs.statSync(envFile).mode & 0o777).toBe(0o600);

    // The seeded admin is actually reachable with the printed password.
    const hash = await adminPasswordHash();
    expect(hash, "seeded admin user").toBeDefined();
    expect(await verifyPassword(values.ADMIN_PASSWORD, hash!)).toBe(true);
  }, 300_000);

  it("is idempotent: a second run keeps the existing secret and password", async () => {
    const before = parseEnvAssignments(fs.readFileSync(envFile, "utf8"));
    const hashBefore = await adminPasswordHash();
    const output = runSetup();
    const after = parseEnvAssignments(fs.readFileSync(envFile, "utf8"));
    expect(after.SESSION_SECRET).toBe(before.SESSION_SECRET);
    expect(after.ADMIN_PASSWORD).toBe(before.ADMIN_PASSWORD);
    expect(output).toContain("unverändert");
    // The admin password survives the re-seed.
    expect(await adminPasswordHash()).toBe(hashBefore);
  }, 300_000);
});
