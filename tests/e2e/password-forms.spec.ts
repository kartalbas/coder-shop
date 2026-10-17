import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #60 — password forms keep the input after errors and show the rules live.

test("registration: live rule checklist and submit reflects the rules", async ({ page }) => {
  await page.goto("/account/register");
  await page.fill("#password", "kurz1");
  const hints = page.locator("#password-hints");
  await expect(hints).toContainText("mindestens 10 Zeichen");
  await expect(hints).toContainText("noch nicht erfüllt");
  await expect(page.getByRole("button", { name: "Konto erstellen" })).toBeDisabled();
  await page.fill("#password", "Gueltig1234");
  await expect(hints).toContainText("Alle Passwort-Anforderungen sind erfüllt.");
  await expect(page.getByRole("button", { name: "Konto erstellen" })).toBeEnabled();
});

test("a failed registration keeps every field and shows the error at the e-mail", async ({
  page,
}) => {
  // A one-character name fails server-side validation (a rejected registration does
  // not consume the shared per-IP rate limit, unlike a submit that reaches the core).
  const email = `neu-${Date.now()}@example.ch`;
  await page.goto("/account/register");
  await page.fill("#name", "A");
  await page.fill("#email", email);
  await page.fill("#password", "Gueltig1234");
  await page.getByLabel(/AGB/).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  // The error belongs to the name field…
  await expect(page.locator("#name-error")).toContainText("Bitte Namen angeben", {
    timeout: 30_000,
  });
  // …and nothing the user typed is lost.
  expect(await page.inputValue("#name")).toBe("A");
  expect(await page.inputValue("#email")).toBe(email);
  expect(await page.inputValue("#password")).toBe("Gueltig1234");
});

test("password reset form shows the rules live and gates the submit", async ({ page }) => {
  await page.goto("/account/reset-password?token=ungueltiger-token-1234567890");
  await page.fill("#password", "abc");
  await expect(page.locator("#password-hints")).toContainText("noch nicht erfüllt");
  await expect(page.getByRole("button", { name: "Passwort setzen" })).toBeDisabled();
  await page.fill("#password", "Gueltig1234");
  await expect(page.getByRole("button", { name: "Passwort setzen" })).toBeEnabled();
});

test("admin password form: live rules, error at the field, values kept", async ({ page }) => {
  await loginAsAdmin(page);
  const section = page.locator('section[aria-label="Passwort ändern"]');
  await section.locator("#next").fill("kurz");
  await expect(section.locator("#next-password-hints")).toContainText("noch nicht erfüllt");
  await expect(
    section.getByRole("button", { name: "Passwort ändern" }),
  ).toBeDisabled();
  await section.locator("#current").fill("FalschesAktuelles1");
  await section.locator("#next").fill("NeuesGueltig1");
  await section.locator("#confirm").fill("NeuesGueltig1");
  await section.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(section.getByRole("alert")).toContainText("aktuelle Passwort ist falsch", {
    timeout: 30_000,
  });
  // The error sits at the current-password field and every value survived.
  await expect(section.locator("#current")).toHaveAttribute("aria-invalid", "true");
  expect(await section.locator("#current").inputValue()).toBe("FalschesAktuelles1");
  expect(await section.locator("#next").inputValue()).toBe("NeuesGueltig1");
  expect(await section.locator("#confirm").inputValue()).toBe("NeuesGueltig1");
});
