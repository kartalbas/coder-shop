import { expect, test } from "@playwright/test";

// Issue #3: order numbers are sequential and the confirmation page used to render every
// customer's name, address, e-mail and phone for anyone who guessed one. Now a stranger
// only sees the e-mail verification form; the buyer (checkout cookie) or the verified
// e-mail unlocks the details.
test("order confirmation: PII is hidden until the buyer proves ownership", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/bestellung/B-2026-000001");
  await expect(page.getByRole("heading", { name: "Bestellung B-2026-000001" })).toBeVisible();
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();

  const html = await page.content();
  expect(html).not.toContain("lena.meier@example.ch");
  expect(html).not.toContain("Bahnhofstrasse");
  expect(html).not.toContain("Lieferadresse");

  await page.getByLabel("E-Mail-Adresse").fill("falsch@example.ch");
  await page.getByRole("button", { name: "Bestellung anzeigen" }).click();
  await expect(page.getByText("stimmen nicht überein")).toBeVisible();

  await page.getByLabel("E-Mail-Adresse").fill("lena.meier@example.ch");
  await page.getByRole("button", { name: "Bestellung anzeigen" }).click();
  await expect(page.getByText("Lieferadresse")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Bahnhofstrasse 12")).toBeVisible();
  await expect(page.getByText("lena.meier@example.ch")).toBeVisible();

  // The access cookie persists: a reload keeps the details without re-verifying.
  await page.reload();
  await expect(page.getByText("Bahnhofstrasse 12")).toBeVisible();

  await context.close();
});
