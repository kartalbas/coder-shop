import { expect, it } from "vitest";
import { productionFiles, textsOf, SRC } from "@/test/ast-texts";
import { usageFilesFor } from "@/lib/translation-usage";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { TRANSLATION_USAGE } from "@/server/translation-usage";

// Issue #58 editor slice: the translation editor shows where each text is used, and
// "where it is used" is a fact about the code — so it is extracted from the code, not
// guessed in the UI. This test walks every production file (the guard's shared AST
// helper), collects every string literal and template head that has a translation-key
// shape, and compares the result against the checked-in snapshot the editor reads at
// runtime (`src/server/translation-usage.json`). A code change that moves a key's usage
// turns this test red until the snapshot is refreshed with `vitest -u`, so the editor
// can never drift from reality. A template head (`shop.status.${status}`) becomes the
// prefix entry `shop.status.*`; a plural base covers its `.one`/`.other` family rows.

const KEY_NAMESPACE = /^(shop|admin|mail|invoice|catalog)\./;
const EXACT_KEY = /^(shop|admin|mail|invoice|catalog)\.[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

function extractUsage(): Record<string, string[]> {
  const usage = new Map<string, Set<string>>();
  for (const file of productionFiles(SRC)) {
    for (const { file: relative, text } of textsOf(file)) {
      if (!KEY_NAMESPACE.test(text)) continue;
      const isExact = EXACT_KEY.test(text);
      const isPrefix =
        text.endsWith(".") &&
        /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*\.$/.test(text.slice(text.indexOf(".") + 1));
      if (!isExact && !isPrefix) continue;
      const entry = isPrefix ? `${text}*` : text;
      if (!usage.has(entry)) usage.set(entry, new Set());
      usage.get(entry)!.add(relative);
    }
  }
  return Object.fromEntries(
    [...usage.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([entry, files]) => [entry, [...files].sort()]),
  );
}

it("the checked-in usage snapshot equals a fresh extraction from the code", async () => {
  // The snapshot is compared as a serialized string: vitest 5 writes object file
  // snapshots for .json with trailing commas, which the runtime reader could not
  // import — the file stays strict JSON either way (recorded deviation).
  await expect(`${JSON.stringify(extractUsage(), null, 2)}\n`).toMatchFileSnapshot(
    "../src/server/translation-usage.json",
  );
});

it("resolves a row key to its usage — exact, prefix and plural family", () => {
  // Exact: the cart title is referenced by the cart views.
  expect(usageFilesFor(TRANSLATION_USAGE, "shop.cart.title")).toEqual(
    expect.arrayContaining(["components/storefront/cart-page-view.tsx"]),
  );
  // Prefix: a dynamic key (`shop.status.${status}`) attributes its family rows to the
  // file that builds them.
  const statusFiles = usageFilesFor(TRANSLATION_USAGE, "shop.status.paid");
  expect(statusFiles.length).toBeGreaterThan(0);
  expect(statusFiles).toEqual(usageFilesFor(TRANSLATION_USAGE, "shop.status.shipped"));
  // Plural family: the base entry covers the `.one`/`.other` rows.
  const family = Object.keys(TRANSLATION_USAGE).find(
    (entry) => !entry.endsWith(".*") && DEFAULT_TRANSLATIONS.some((row) => row.key.startsWith(`${entry}.`)),
  );
  expect(family).toBeDefined();
  const member = DEFAULT_TRANSLATIONS.find((row) => row.key.startsWith(`${family}.`))!;
  expect(usageFilesFor(TRANSLATION_USAGE, member.key)).toEqual(TRANSLATION_USAGE[family!]);
  // An unknown key with no covering entry has no usage.
  expect(usageFilesFor(TRANSLATION_USAGE, "shop.definitely.unused.key")).toEqual([]);
});
