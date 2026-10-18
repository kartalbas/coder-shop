import { describe, expect, it } from "vitest";
import { createFormatters } from "./format";

const normalize = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

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
    expect(createFormatters("rm-CH").date(midJanuary)).toBe(
      new Intl.DateTimeFormat("rm-CH", { dateStyle: "long" }).format(midJanuary),
    );
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
