import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";
import { E2E_PORT } from "./playwright.config";

// Issue #1: opened from another machine as http://<lan-ip>:4000, every admin click bounced
// back to the login. The session cookie was `Secure`, which browsers only store on
// trustworthy origins — https plus localhost/127.* — so the same build worked on
// http://localhost but not on a LAN address. This spec reproduces that: a non-localhost
// hostname (mapped to loopback by the browser, no real DNS/network needed) over plain HTTP.
const LAN_HOST = "lan-admin.test";
const LAN_BASE = `http://${LAN_HOST}:${E2E_PORT}`;

test.use({
  launchOptions: {
    args: [`--host-resolver-rules=MAP ${LAN_HOST} 127.0.0.1`],
  },
});

test("admin: session survives navigation over plain HTTP on a non-localhost host", async ({
  page,
  context,
}) => {
  await page.goto(`${LAN_BASE}/admin/login`);
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(`${LAN_BASE}/admin`, { timeout: 30_000 });

  const session = (await context.cookies(LAN_BASE)).find((c) => c.name === "admin_session");
  expect(session, "session cookie must be stored for the LAN origin").toBeDefined();
  expect(session?.secure, "Secure cookie would be dropped on plain HTTP").toBe(false);

  for (const target of ["/admin/orders", "/admin/products", "/admin/purchasing"]) {
    await page.goto(`${LAN_BASE}${target}`);
    await expect(page).toHaveURL(`${LAN_BASE}${target}`);
  }
});
