import { expect, test, type Page } from "@playwright/test";

// Issue #59 — calm, stable layout: navigation never moves the page and
// notifications never cover buttons.

async function snapshotGeometry(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const box = header?.getBoundingClientRect();
    return { x: box?.x ?? -1, width: box?.width ?? -1 };
  });
}

// Samples the transition wrapper's transform while a navigation runs; any non-identity
// transform means the page visibly shifted (the old `y: 8` slide).
async function clickAndWatchForShift(page: Page, click: () => Promise<void>): Promise<string[]> {
  // Sampling runs inside the page while the navigation happens (the promise is awaited
  // only after the click); any non-identity transform is a visible page shift.
  const watcher = page.evaluate(async () => {
    const w = window as unknown as { __transforms: string[] };
    w.__transforms = [];
    for (let i = 0; i < 40; i += 1) {
      const el = document.querySelector("[data-route-transition]");
      if (el) {
        const t = getComputedStyle(el).transform;
        if (t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)") w.__transforms.push(t);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  });
  await click();
  await watcher;
  return page.evaluate(() => (window as unknown as { __transforms: string[] }).__transforms);
}

test("navigating never transforms (shifts) the page and the header stays put", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const before = await snapshotGeometry(page);

  const listingLink = page.getByRole("link", { name: "Smartphones" }).first();
  const shifts = await clickAndWatchForShift(page, () => listingLink.click());
  expect(shifts).toEqual([]);
  await expect(page).toHaveURL(/\/produkte/);
  const afterListing = await snapshotGeometry(page);
  expect(afterListing).toEqual(before);

  const productLink = page.locator("main a[href*='/produkt/']").first();
  const href = await productLink.getAttribute("href");
  const shifts2 = await clickAndWatchForShift(page, () => productLink.click());
  expect(shifts2).toEqual([]);
  await expect(page).toHaveURL(new RegExp(href!));
  const afterProduct = await snapshotGeometry(page);
  expect(afterProduct).toEqual(before);
});

test("the vertical scrollbar gutter is reserved so content cannot jump", async ({ page }) => {
  await page.goto("/");
  const gutter = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarGutter,
  );
  expect(gutter).toContain("stable");
});

test("adding to the cart opens the drawer without a toast over „Zur Kasse“", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as { items: { slug: string }[] };
  // Walk candidates until one accepts a full in-stock selection (issue #18 picker).
  let added = false;
  for (const candidate of body.items.slice(0, 8)) {
    await page.goto(`/produkt/${candidate.slug}`);
    const fieldsets = page.locator("main fieldset");
    const count = await fieldsets.count();
    for (let i = 0; i < count; i += 1) {
      await fieldsets
        .nth(i)
        .locator('button:not([disabled])[aria-pressed="false"]')
        .first()
        .click();
    }
    const add = page.getByRole("button", { name: "In den Warenkorb" });
    if (await add.isEnabled()) {
      await add.click();
      added = true;
      break;
    }
  }
  expect(added).toBe(true);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  // No toast at all while the drawer is open (the drawer is the feedback).
  await page.waitForTimeout(800);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  // „Zur Kasse“ is visible and unobstructed.
  const checkout = drawer.getByRole("link", { name: "Zur Kasse" });
  await expect(checkout).toBeVisible();
  const box = (await checkout.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.textContent ?? "",
    [box.x + box.width / 2, box.y + box.height / 2] as const,
  );
  expect(hit).toContain("Zur Kasse");
});

test("a toast never covers the buttons near it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/konto/anmelden");
  await page.fill("#email", "niemals@beispiel.ch");
  await page.fill("#password", "FalschesPasswort1");
  const submit = page.getByRole("button", { name: "Anmelden" });
  const submitBox = (await submit.boundingBox())!;
  await submit.click();
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const toastBox = (await toast.boundingBox())!;
  const overlaps =
    toastBox.x < submitBox.x + submitBox.width &&
    toastBox.x + toastBox.width > submitBox.x &&
    toastBox.y < submitBox.y + submitBox.height &&
    toastBox.y + toastBox.height > submitBox.y;
  expect(overlaps).toBe(false);
  // And the cart button in the header stays clickable while the toast is up.
  const cartButton = page.getByRole("button", { name: /Warenkorb/ });
  const cartBox = (await cartButton.boundingBox())!;
  const overlapsCart =
    toastBox.x < cartBox.x + cartBox.width &&
    toastBox.x + toastBox.width > cartBox.x &&
    toastBox.y < cartBox.y + cartBox.height &&
    toastBox.y + toastBox.height > cartBox.y;
  expect(overlapsCart).toBe(false);
});
