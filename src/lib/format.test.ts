import { describe, expect, it } from "vitest";
import { formatChf, formatDate, formatDateTime, formatWeight } from "./format";

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
