import { describe, expect, it } from "vitest";
import { addDaysToDayKey, swissDayKey, swissDayStartUtc, swissYear } from "@/lib/dates";

describe("swissDayKey", () => {
  it("uses the Swiss calendar day, not the UTC one", () => {
    // 23:30 UTC on 31 Dec is already 00:30 on 1 Jan in Zurich.
    expect(swissDayKey(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(swissDayKey(new Date("2026-10-17T10:00:00Z"))).toBe("2026-10-17");
    // 22:00 UTC on the 17th is still the 17th in Zurich (summer time, UTC+2).
    expect(swissDayKey(new Date("2026-10-17T22:00:00Z"))).toBe("2026-10-18");
  });
});

describe("swissYear", () => {
  it("rolls to the Swiss new year, not the UTC one", () => {
    expect(swissYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(swissYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });
});

describe("addDaysToDayKey", () => {
  it("shifts whole calendar days across months and years", () => {
    expect(addDaysToDayKey("2026-10-17", -29)).toBe("2026-09-18");
    expect(addDaysToDayKey("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDaysToDayKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDayKey("2026-10-17", 0)).toBe("2026-10-17");
  });
});

describe("swissDayStartUtc", () => {
  it("is the UTC instant of Swiss midnight (winter and summer)", () => {
    expect(swissDayStartUtc("2026-10-17").toISOString()).toBe("2026-10-16T22:00:00.000Z");
    expect(swissDayStartUtc("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("round-trips: the start belongs to its day, one second before to the previous", () => {
    for (const key of ["2026-03-08", "2026-10-25", "2026-12-31", "2027-01-01"]) {
      const start = swissDayStartUtc(key);
      expect(swissDayKey(start)).toBe(key);
      expect(swissDayKey(new Date(start.getTime() - 1000))).toBe(addDaysToDayKey(key, -1));
      expect(swissDayKey(new Date(start.getTime() + 23 * 60 * 60 * 1000))).toBe(key);
    }
  });
});
