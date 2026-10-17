import path from "node:path";
import { defineConfig } from "@playwright/test";

const here = __dirname;
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: here,
  testMatch: "*.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: path.join(here, "global-setup.ts"),
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
