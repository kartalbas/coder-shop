import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Issue #35: ARCHITECTURE §2 promises `src/lib` is pure domain logic — no I/O, no
// mongoose, nothing from `src/models` or `src/server`. This broke once via
// `lib/menu.ts → models/product`; this guard keeps it fixed.

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return entry.endsWith(".ts") && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

describe("src/lib purity (ARCHITECTURE §2)", () => {
  const files = tsFiles(path.join(__dirname, "../src/lib"));

  it("covers a meaningful part of the lib", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file)]))("%s imports nothing impure", (rel) => {
    const source = readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(source).not.toMatch(/from "@\/models/);
    expect(source).not.toMatch(/from "@\/server/);
    expect(source).not.toMatch(/from "mongoose"/);
    expect(source).not.toMatch(/from "node:/);
  });
});
