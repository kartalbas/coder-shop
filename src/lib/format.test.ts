import { describe, expect, it } from "vitest";
import { createFormatters, formatChf, formatDate, formatDateTime, formatWeight } from "./format";

const normalize = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

describe("formatChf (de-CH)", () => {
  it("formats whole francs", () => {
    expect(normalize(formatChf(500))).toBe("CHF 5.00");
  });

  it("formats thousands with an apostrophe group separator", () => {
    expect(normalize(formatChf(123450))).toMatch(/^CHF 1[’'.]234\.50$/);
  });

  it("formats zero", () => {
    expect(normalize(formatChf(0))).toBe("CHF 0.00");
  });
});

describe("formatWeight", () => {
  it("uses grams below a kilogram", () => {
    expect(normalize(formatWeight(850))).toBe("850 g");
  });

  it("uses kilograms from a kilogram up", () => {
    expect(normalize(formatWeight(1500))).toBe("1.5 kg");
  });
});

describe("dates", () => {
  it("formats a date in de-CH long style", () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 15)))).toContain("2026");
  });

  it("formats date and time", () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 0, 15, 10, 30)))).toContain("2026");
  });
});

describe("createFormatters (#58 step 2b — formats follow the language row)", () => {
  const midJanuary = new Date(Date.UTC(2026, 0, 15));

  it("places and spells CHF the way each language writes it", () => {
    expect(normalize(createFormatters("de-CH").chf(123450))).toMatch(/^CHF 1[’'.]234\.50$/);
    // fr-CH and es put the symbol behind the amount.
    expect(normalize(createFormatters("fr-CH").chf(123450))).toMatch(/CHF$/);
    expect(normalize(createFormatters("es").chf(123450))).toMatch(/CHF$/);
    expect(normalize(createFormatters("es").chf(123450))).toContain("1234,50");
  });

  it("names the month in the language", () => {
    expect(createFormatters("fr-CH").date(midJanuary)).toContain("janvier");
    expect(createFormatters("it-CH").date(midJanuary)).toContain("gennaio");
    expect(createFormatters("rm-CH").date(midJanuary)).toContain("schaner");
    expect(createFormatters("es").date(midJanuary)).toContain("enero");
    expect(createFormatters("de-CH").date(midJanuary)).toContain("Januar");
  });

  it("formats weights and plain numbers with the locale separators", () => {
    expect(normalize(createFormatters("de-CH").weight(1500))).toBe("1.5 kg");
    expect(normalize(createFormatters("es").weight(1500))).toBe("1,5 kg");
    expect(normalize(createFormatters("de-CH").number(1234))).toMatch(/^1[’'.]234$/);
    expect(normalize(createFormatters("es").number(1234567))).toBe("1.234.567");
  });

  it("keeps one cached Intl set per locale", () => {
    expect(createFormatters("fr-CH")).toBe(createFormatters("fr-CH"));
  });
});
