import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASE_LANGUAGE,
  DEFAULT_LANGUAGES,
  isTranslated,
  TRANSLATION_AREAS,
  type TranslationArea,
  type TranslationEntry,
} from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";

// Issue #58 (user decision): src/server/translations.json is the single source of the
// translation table's seed content — the collection is only what the app reads. This
// guard reads the raw file (not the typed module) so the file itself must hold up:
// shape, uniqueness and full coverage of every seeded language. A lossy edit of the
// file fails here even if everything still compiles.

const FILE = path.join(process.cwd(), "src", "server", "translations.json");
const rows = JSON.parse(readFileSync(FILE, "utf8")) as TranslationEntry[];

const SEEDED_CODES = DEFAULT_LANGUAGES.map((language) => language.code);

describe("translations.json — the one seed file (#58)", () => {
  it("is the module's content and keeps a floor so a lossy move cannot pass", () => {
    expect(rows).toEqual(DEFAULT_TRANSLATIONS);
    expect(rows.length).toBeGreaterThanOrEqual(1071);
  });

  it("has unique, well-formed keys", () => {
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key, key).toMatch(/^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_-]*)+$/u);
    }
  });

  it("uses only the known areas and a non-empty German base", () => {
    for (const row of rows) {
      expect(TRANSLATION_AREAS, `${row.key} area`).toContain(row.area as TranslationArea);
      expect(row.de.trim(), `${row.key} German base`).not.toBe("");
    }
  });

  it("stamps textUpdatedAt with ISO strings only (#58 catalog content rows)", () => {
    for (const row of rows) {
      for (const [code, stamp] of Object.entries(row.textUpdatedAt ?? {})) {
        expect(SEEDED_CODES, `${row.key} stamp for unknown language ${code}`).toContain(code);
        expect(stamp, `${row.key} stamp for ${code}`).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      }
    }
  });

  it("carries texts only for seeded languages and translates every key in all of them", () => {
    for (const row of rows) {
      for (const code of Object.keys(row.texts)) {
        expect(SEEDED_CODES, `${row.key} has text for unknown language ${code}`).toContain(code);
        expect(code, `${row.key} keeps the base in de, not texts`).not.toBe(BASE_LANGUAGE);
        expect(row.texts[code].trim(), `${row.key} text for ${code}`).not.toBe("");
      }
      for (const language of DEFAULT_LANGUAGES) {
        expect(isTranslated(row, language.code), `${row.key} in ${language.code}`).toBe(true);
      }
    }
  });
});
