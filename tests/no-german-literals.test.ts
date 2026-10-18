import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

// Issue #58 step 3 (decision point 4): the no-German-literals guard. Every UI text is
// a row of the one translation table, read dynamically per request — German is content,
// never code. This test walks every production file in `src/` (tests and the seed's own
// files excluded), extracts the string literals and JSX texts through the TypeScript
// AST (comments and identifiers are not texts and are not scanned), and fails on any
// German text that is not in the exemption registry below.
//
// A new German literal therefore turns this test red until it is a table row or a
// justified exemption — each exemption names its file, its exact text and the boundary
// it belongs to (stored data, banking interop, seed content, developer logs, machine
// payloads). Exemptions are exact: changing such a text re-flags it, and a stale
// exemption fails the second test, so the registry cannot silently rot.

const SRC = path.join(__dirname, "..", "src");

// German markers: the letters and quotes that cannot appear in English text, plus a
// conservative list of unmistakably German words (no articles or other words that
// collide with English). Identifiers and comments are never scanned, so this only
// fires on texts.
const GERMAN_MARKERS = /[äöüÄÖÜß„“«»]/;
const GERMAN_WORDS = [
  "und", "oder", "aber", "nicht", "kein", "keine", "keiner", "mein", "meine",
  "dein", "deine", "ihr", "ihre", "unser", "unsere", "für", "mit", "von", "bei",
  "nach", "aus", "vor", "auf", "zum", "zur", "über", "unter", "zwischen", "ohne",
  "durch", "gegen", "als", "wenn", "weil", "dass", "wie", "auch", "noch", "schon",
  "nur", "sehr", "mehr", "werden", "wird", "wurde", "haben", "hatte", "kann",
  "können", "muss", "soll", "mal", "eben", "zusammen", "wieder", "immer", "nie",
  "immerhin", "bereits", "weiter", "zurück", "vorhanden", "verfügbar", "ausverkauft",
  "bezahlt", "offen", "überfällig", "geliefert", "storniert", "abbrechen",
  "schliessen", "entfernen", "hinzufügen", "bearbeiten", "aktualisieren", "laden",
  "senden", "prüfen", "auswählen", "sortieren", "filtern", "suche", "suchen",
  "finden", "sehen", "zeigen", "verstecken", "öffnen", "bitte", "hier", "danke",
  "diese", "dieser", "jeder", "jede", "alle", "alles", "manche", "einige",
  "bestellung", "bestellungen", "rechnung", "rechnungen", "versand", "zahlung",
  "lager", "artikel", "produkte", "preis", "menge", "stück", "gelöscht",
  "gespeichert", "aktiviert", "deaktiviert", "bestätigt", "sprache", "übersetzt",
  "willkommen", "fehler", "fehlgeschlagen", "benachrichtigung", "wareneingang",
  "lieferant", "lieferanten", "zahlungsart", "versandart", "etikett", "packliste",
  "einkauf", "abholung", "bewegung", "bewegungen", "notiz", "notizen", "verlauf",
  "historie", "änderung", "änderungen", "eintrag", "eigenschaft", "eigenschaften",
  "katalogtypen", "vorschau", "hinweis", "beschreibung", "reihenfolge",
  "gewicht", "variante", "varianten", "bestand", "seriennummer",
];
const GERMAN_WORD = new RegExp(`(^|[^a-z0-9])(${GERMAN_WORDS.join("|")})($|[^a-z0-9])`, "i");

function isGermanText(text: string): boolean {
  return GERMAN_MARKERS.test(text) || GERMAN_WORD.test(text);
}

interface Exemption {
  file: string;
  text: string;
  reason: string;
}

// Every entry is a recorded boundary, not a workaround — see DECISIONS (#58 guard rule).
const EXEMPTIONS: Exemption[] = [
  // Invisible skeleton fillers: text-transparent + aria-hidden placeholders that only
  // reserve layout space (never read, never announced) — the real texts stream in.
  {
    file: "app/[lang]/(storefront)/page.tsx",
    text: "Technik, Style und Komfort — in der Schweiz zuhause.",
    reason: "invisible HeroSkeleton filler (text-transparent + aria-hidden)",
  },
  {
    file: "app/[lang]/(storefront)/page.tsx",
    text: "Faire Preise in CHF, inklusive MwSt. und schnellem Versand aus der Schweiz.",
    reason: "invisible HeroSkeleton filler (text-transparent + aria-hidden)",
  },
  // Machine payloads: JSON error bodies of API routes. The health endpoint cannot read
  // the table (its own failure mode is a dead database); the search error is a
  // machine-consumed payload, not UI copy.
  {
    file: "app/api/health/route.ts",
    text: "Datenbank nicht erreichbar.",
    reason: "API error payload; the table is unreadable when the DB is down",
  },
  {
    file: "app/api/search/route.ts",
    text: "Ungültige Anfrage",
    reason: "machine-consumed JSON error payload, not UI copy",
  },
  // Seed/default content: the configuration rows' own German content (#61/#64 pattern —
  // the stored rows are the data, an admin edits them in the editors).
  {
    file: "lib/catalog-types.ts",
    text: "Grösse",
    reason: "DEFAULT_CATALOG_TYPES seed content",
  },
  {
    file: "lib/shop-settings.ts",
    text: "nächster Werktag",
    reason: "DEFAULT_SHOP_SETTINGS seed content",
  },
  {
    file: "lib/shop-settings.ts",
    text: "Abholung im Laden",
    reason: "DEFAULT_SHOP_SETTINGS seed content",
  },
  {
    file: "lib/shop-settings.ts",
    text: "Rechnung",
    reason: "DEFAULT_SHOP_SETTINGS seed content",
  },
  {
    file: "lib/shop-settings.ts",
    text: "Bei Abholung",
    reason: "DEFAULT_SHOP_SETTINGS seed content",
  },
  {
    file: "lib/store.ts",
    text: "coder-shop Laden",
    reason: "store address content",
  },
  {
    file: "lib/store.ts",
    text: "Zürich",
    reason: "store address content",
  },
  // Banking interop: the Swiss QR-bill payload is German by specification (DECISIONS).
  {
    file: "lib/invoices.ts",
    text: "Zürich",
    reason: "demo creditor address — SPC banking interop data",
  },
  {
    file: "server/invoices-pdf.ts",
    text: "Bestellung ",
    reason: "SPC payload additional information — banking interop data",
  },
  // The status badge's no-provider fallback (DECISIONS): the storefront passes its
  // label map; only provider-less renders (unit tests, scripts) read these.
  { file: "lib/orders/labels.ts", text: "Bezahlt", reason: "STATUS_LABELS fallback without a provider" },
  { file: "lib/orders/labels.ts", text: "Bereit zur Abholung", reason: "STATUS_LABELS fallback without a provider" },
  { file: "lib/orders/labels.ts", text: "Storniert", reason: "STATUS_LABELS fallback without a provider" },
  // The German admin boundary of object ids (recorded with the validation-messages slice).
  {
    file: "lib/validations/common.ts",
    text: "Ungültige Anfrage.",
    reason: "objectIdSchema — the German admin boundary",
  },
  // Stored-data notes: history written into order statusLog / unit history documents.
  // They are audit data of the moment they were written, not UI copy (DECISIONS).
  { file: "server/actions/admin/orders.ts", text: "Storniert, Lager gutgeschrieben", reason: "stored statusLog note" },
  { file: "server/checkout.ts", text: "Zahlung bestätigt", reason: "stored statusLog note" },
  { file: "server/invoices.ts", text: "Rechnung bezahlt", reason: "stored payment note" },
  { file: "server/pickup.ts", text: "Bereit zur Abholung", reason: "stored statusLog note" },
  { file: "server/pickup.ts", text: "Abgeholt und bezahlt", reason: "stored statusLog note" },
  { file: "server/stock-units.ts", text: "Wareneingang ", reason: "stored unit history note" },
  { file: "server/stock-units.ts", text: "Bestellung ", reason: "stored unit history note" },
  { file: "server/stock-units.ts", text: "Storno — zurück ins Lager", reason: "stored unit history note" },
  { file: "server/orders-admin.ts", text: "Bestellung ", reason: "stored unit history note" },
  { file: "server/shipping/label.ts", text: "Etikett erstellt", reason: "stored unit history note" },
  { file: "server/pickup.ts", text: "Bestellung ", reason: "developer console.error log" },
  // Developer console.error logs — server output, never user-facing.
  { file: "server/checkout.ts", text: "Bestellung ", reason: "developer console.error log" },
  { file: "server/checkout.ts", text: ": Bestätigungs-Mail fehlgeschlagen", reason: "developer console.error log" },
  { file: "server/orders-admin.ts", text: "Wieder-verfügbar-Benachrichtigung fehlgeschlagen", reason: "developer console.error log" },
  { file: "server/pickup.ts", text: ": Abhol-Mail fehlgeschlagen", reason: "developer console.error log" },
  { file: "server/purchasing.ts", text: "Wieder-verfügbar-Benachrichtigung fehlgeschlagen", reason: "developer console.error log" },
  { file: "server/restock-alerts.ts", text: "Benachrichtigung für ", reason: "developer console.error log" },
  { file: "server/restock-alerts.ts", text: " fehlgeschlagen", reason: "developer console.error log" },
  { file: "server/shipping/label.ts", text: "Bestellung ", reason: "developer console.error log" },
  { file: "server/shipping/label.ts", text: ": Versand-Mail fehlgeschlagen", reason: "developer console.error log" },
  // Internal UPS provider error texts — mapped to the German admin toast by the
  // shipping core, never rendered as-is (recorded with the shipping slice).
  { file: "server/shipping/ups.ts", text: "unbekannter Fehler", reason: "internal UPS provider error text" },
  { file: "server/shipping/ups.ts", text: "UPS-Fehler ", reason: "internal UPS provider error text" },
  { file: "server/shipping/ups.ts", text: "UPS-Token-Antwort ohne access_token/expires_in", reason: "internal UPS provider error text" },
  { file: "server/shipping/ups.ts", text: "UPS-Authentifizierung fehlgeschlagen: ", reason: "internal UPS provider error text" },
  { file: "server/shipping/ups.ts", text: "UPS nicht erreichbar: ", reason: "internal UPS provider error text" },
  { file: "server/shipping/ups.ts", text: "UPS-Antwort ohne Sendungsnummer oder Etiketten-PDF.", reason: "internal UPS provider error text" },
  // The unreachable discount fallback text (the checkout core refuses every bad code
  // through the table before this line can answer).
  { file: "server/checkout.ts", text: "Ungültiger Code.", reason: "unreachable fallback behind the table-driven refusals" },
];

function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return productionFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) return [];
    // The seed file's typed reader holds the migration lists (retired keys, repairs) —
    // migrations, not content (DECISIONS); translations.json is not a .ts file at all.
    if (entry === "translation-seed.ts") return [];
    return [full];
  });
}

interface FoundText {
  file: string;
  line: number;
  text: string;
}

function textsOf(file: string): FoundText[] {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: FoundText[] = [];
  const record = (node: ts.Node, text: string) => {
    found.push({
      file: path.relative(SRC, file).split(path.sep).join("/"),
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      text,
    });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      record(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      record(node, node.head.text);
      for (const span of node.templateSpans) record(node, span.literal.text);
    } else if (ts.isJsxText(node)) {
      const trimmed = node.text.trim();
      if (trimmed) record(node, trimmed);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("no German literals in code (#58 step 3)", () => {
  const violations = productionFiles(SRC)
    .flatMap(textsOf)
    .filter((entry) => isGermanText(entry.text))
    .filter(
      (entry) =>
        !EXEMPTIONS.some(
          (exemption) => exemption.file === entry.file && exemption.text === entry.text,
        ),
    );

  it("walks a meaningful part of the tree", () => {
    expect(productionFiles(SRC).length).toBeGreaterThan(100);
  });

  it("every German text is a table row or a registered exemption", () => {
    expect(
      violations.map((v) => `${v.file}:${v.line} ${JSON.stringify(v.text)}`),
    ).toEqual([]);
  });

  it("keeps the exemption registry honest — no stale entries", () => {
    const all = productionFiles(SRC).flatMap(textsOf);
    const stale = EXEMPTIONS.filter(
      (exemption) =>
        !all.some(
          (entry) => entry.file === exemption.file && entry.text === exemption.text,
        ),
    );
    expect(stale.map((e) => `${e.file} ${JSON.stringify(e.text)}`)).toEqual([]);
  });

  it("registers every exemption with a reason and an existing file", () => {
    // An exemption is a recorded boundary, not a parking spot: it names a real file
    // and states why the text stays.
    for (const exemption of EXEMPTIONS) {
      expect(exemption.reason.trim(), exemption.text).not.toBe("");
      expect(exemption.text.trim(), exemption.file).not.toBe("");
      expect(
        statSync(path.join(SRC, exemption.file)).isFile(),
        `exempted file exists: ${exemption.file}`,
      ).toBe(true);
    }
  });
});
