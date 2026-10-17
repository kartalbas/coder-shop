import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    globalSetup: ["src/test/setup.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
