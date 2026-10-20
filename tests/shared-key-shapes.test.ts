import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIG_KEY_PATTERN,
  LANGUAGE_CODE_PATTERN,
  TRANSLATION_KEY_PATTERN,
} from "@/lib/i18n";
import { productionFiles, SRC } from "@/test/ast-texts";

// #58 review nit: the shared code/key shapes are one source in `src/lib/i18n` and every
// schema, core and guard that validates them uses the exported patterns — a shape change
// is one edit and the validators can never drift apart. This guard scans every
// production file for the pattern sources themselves and allows them only in their
// definition file, so an inlined copy turns it red (it was red while the settings
// action, the checkout schema, the settings/catalog-type cores and the language core
// still spelled the shapes out).

const DEFINITION_FILE = "lib/i18n.ts";

const SHAPES = [
  { name: "LANGUAGE_CODE_PATTERN", pattern: LANGUAGE_CODE_PATTERN },
  { name: "CONFIG_KEY_PATTERN", pattern: CONFIG_KEY_PATTERN },
  { name: "TRANSLATION_KEY_PATTERN", pattern: TRANSLATION_KEY_PATTERN },
] as const;

describe("one source per shared shape (#58 review)", () => {
  it("no production file inlines a shared pattern outside its definition", () => {
    const inlined: string[] = [];
    for (const file of productionFiles(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join("/");
      if (relative === DEFINITION_FILE) continue;
      const text = readFileSync(file, "utf8");
      for (const shape of SHAPES) {
        if (text.includes(shape.pattern.source)) {
          inlined.push(`${relative} inlines ${shape.name}`);
        }
      }
    }
    expect(inlined).toEqual([]);
  });

  it("the shared patterns keep their documented shapes", () => {
    expect(["de", "rm", "eng"].every((code) => LANGUAGE_CODE_PATTERN.test(code))).toBe(true);
    expect(["d", "deu-CH", "de1"].every((code) => !LANGUAGE_CODE_PATTERN.test(code))).toBe(
      true,
    );
    expect(["mock", "standard", "price-asc", "on-pickup"].every((key) =>
      CONFIG_KEY_PATTERN.test(key),
    )).toBe(true);
    expect(
      ["-mock", "Mock", "mock_key", "mock key", ""].every(
        (key) => !CONFIG_KEY_PATTERN.test(key),
      ),
    ).toBe(true);
    expect(["shop.cart.title", "catalog.value.material.gruen", "a.b"].every((key) =>
      TRANSLATION_KEY_PATTERN.test(key),
    )).toBe(true);
    expect(
      ["shop", "Shop.title", "shop.cart.TITLE!", "shop.cart."].every(
        (key) => !TRANSLATION_KEY_PATTERN.test(key),
      ),
    ).toBe(true);
  });
});
