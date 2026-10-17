import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Issue #37 — the product page's generateMetadata queried MongoDB in the prerender
// stage; the driver's internal `new Date()` (CMAP events) made Next log
// "unstable value `new Date()` while prerendering" on every product page view.

const LOG_FILE = path.join(__dirname, ".server.log");

test("product pages render without prerender errors in the server log", async ({ request }) => {
  const body = (await (await request.get("/api/products")).json()) as {
    items: { slug: string }[];
  };
  const slugs = body.items.slice(0, 3).map((item) => item.slug);
  expect(slugs.length).toBeGreaterThan(0);
  for (const slug of slugs) {
    expect((await request.get(`/produkt/${slug}`)).status()).toBe(200);
  }

  // The server pipes its log asynchronously — give it a moment to flush the
  // lines for these requests, then require the whole run's log to be error-free.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const log = fs.readFileSync(LOG_FILE, "utf8");
  expect(log).toContain("Ready in");
  expect(log).not.toMatch(/unstable value .* while prerendering/);
  expect(log).not.toContain("blocking-prerender-current-time");
});
