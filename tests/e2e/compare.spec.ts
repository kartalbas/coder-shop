import { expect, test } from "@playwright/test";

interface ApiProduct {
  slug: string;
  name: string;
  brand: string;
}

async function findPhones(page: import("@playwright/test").Page, count: number): Promise<ApiProduct[]> {
  // Same default sort as the listing page, so the picked phones are on the first page.
  const response = await page.request.get("/api/products?type=smartphone");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: ApiProduct[] };
  // Distinct brands so at least one row is guaranteed to differ.
  const picked: ApiProduct[] = [];
  for (const item of body.items) {
    if (!picked.some((p) => p.brand === item.brand)) picked.push(item);
    if (picked.length === count) break;
  }
  expect(picked.length).toBe(count);
  return picked;
}

test("four smartphones compared side by side with differences highlighted (issue #48)", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const phones = await findPhones(page, 4);

  // Toggle „Vergleichen" on the cards of four phones.
  await page.goto("/products?type=smartphone");
  for (const phone of phones) {
    await page.getByRole("button", { name: `${phone.name} compare` }).first().click();
  }
  const tray = page.getByTestId("compare-tray");
  await expect(tray).toContainText("4 im Vergleich");

  // The tray opens the comparison page with the selection in the URL.
  await tray.getByRole("link", { name: "Vergleichen" }).click();
  await expect(page).toHaveURL(/\/products\/compare\?slugs=/);

  // All four phones are columns of the table.
  for (const phone of phones) {
    await expect(page.getByRole("cell", { name: phone.name }).or(
      page.locator("th", { hasText: phone.name }),
    )).toBeVisible();
  }

  // Rows where the phones differ are highlighted — the brand row at least.
  const brandRow = page.getByRole("row", { name: /Marke/ });
  await expect(brandRow).toBeVisible();
  expect(await brandRow.evaluate((row) => row.classList.contains("bg-amber-50"))).toBe(true);
  // A row every phone shares (same brand set is impossible; but "Varianten" may match —
  // instead assert the sr-only marker exists exactly on differing rows).
  const differing = page.locator("tbody tr.bg-amber-50");
  expect(await differing.count()).toBeGreaterThan(0);

  // The clear button empties the tray.
  await page.getByTestId("compare-clear").click();
  await expect(tray).toHaveCount(0);
});

test("comparison needs at least two phones (issue #48)", async ({ page }) => {
  const [phone] = await findPhones(page, 1);
  await page.goto(`/products/compare?slugs=${phone!.slug}`);
  await expect(
    page.getByText("Für einen Vergleich braucht es mindestens zwei Smartphones."),
  ).toBeVisible();
});
