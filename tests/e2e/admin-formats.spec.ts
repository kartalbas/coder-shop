import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 admin formats slice: the admin's amounts, dates and weights follow the
// intlLocale of the chosen language row, not the base locale. The assertions use the
// two renderings that genuinely differ between de-CH and fr-CH — the CHF position
// (prefix vs suffix) and the month name's case ("Oktober" vs "octobre") — so the spec
// fails on the pre-change build, where the admin answered de-CH in every language.
// The month names are never pinned: the seed dates orders relative to the wall clock
// (now − up to 14 days), so the spec derives the long month names of that window per
// locale via Intl and asserts against the set (a 15-day window spans at most two
// months) — the request-language.test.ts discipline, no vocabulary pinned.

const DAY_MS = 24 * 60 * 60 * 1000;

function monthNamesOfRecentDays(intlLocale: string, days = 15): string[] {
  const names = new Set<string>();
  const now = Date.now();
  for (let day = 0; day <= days; day++) {
    const formatted = new Intl.DateTimeFormat(intlLocale, { month: "long" }).format(
      new Date(now - day * DAY_MS),
    );
    names.add(formatted);
  }
  return [...names];
}

// Case-sensitive, word-bounded match (getByText with a string is case-insensitive);
// the fr/de names only stay distinguishable by case ("octobre" vs "Oktober").
function namePattern(name: string): RegExp {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u");
}

function anyNamePattern(names: string[]): RegExp {
  return new RegExp(`\\b(?:${names.join("|")})\\b`, "u");
}

test("the admin formats amounts and dates in the chosen language", async ({ page }) => {
  test.setTimeout(120_000);

  const frMonths = monthNamesOfRecentDays("fr-CH");
  const deMonths = monthNamesOfRecentDays("de-CH");

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Dashboard: every CHF carries the French suffix form, none the German prefix.
    await expect(page.getByText(/CHF$/).first()).toBeVisible();
    await expect(page.getByText(/^CHF\s/)).toHaveCount(0);
    // Recent-order dates carry a French month of the seed window, never a German one.
    await expect(page.getByText(anyNamePattern(frMonths)).first()).toBeVisible();
    for (const name of deMonths) {
      await expect(page.getByText(namePattern(name))).toHaveCount(0);
    }

    // Orders list: same French formats.
    await page.goto("/admin/orders");
    await expect(page.getByText(anyNamePattern(frMonths)).first()).toBeVisible();
    for (const name of deMonths) {
      await expect(page.getByText(namePattern(name))).toHaveCount(0);
    }
    await expect(page.getByText(/^CHF\s/)).toHaveCount(0);
  } finally {
    // Still on the orders list — the German heading and formats must answer there.
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("heading", { name: "Bestellungen" })).toBeVisible({
      timeout: 30_000,
    });
    // Back on the base locale the German forms answer again.
    await expect(page.getByText(/^CHF\s/).first()).toBeVisible();
    await expect(page.getByText(anyNamePattern(deMonths)).first()).toBeVisible();
    for (const name of frMonths) {
      await expect(page.getByText(namePattern(name))).toHaveCount(0);
    }
  }
});
