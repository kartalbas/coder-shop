import { describe, expect, it } from "vitest";
import {
  clearCompare,
  COMPARE_MAX_ITEMS,
  COMPARE_STORAGE_KEY,
  deserializeCompare,
  hydrateCompare,
  serializeCompare,
  toggleCompare,
} from "./compare";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

hydrateCompare();

function slugs(): string[] {
  return JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) ?? '{"slugs":[]}').slugs;
}

describe("compare store (issue #48)", () => {
  it("round-trips and rejects corrupt payloads", () => {
    expect(deserializeCompare(serializeCompare({ slugs: ["a", "b"] })).slugs).toEqual(["a", "b"]);
    expect(deserializeCompare("kein json").slugs).toEqual([]);
    expect(deserializeCompare('{"v":2,"slugs":["a"]}').slugs).toEqual([]);
    expect(deserializeCompare('{"v":1,"slugs":[1,null,"  "]}').slugs).toEqual([]);
  });

  it("toggles, caps at four and clears", () => {
    clearCompare();
    for (const slug of ["a", "b", "c", "d", "e"]) toggleCompare(slug);
    expect(slugs()).toEqual(["a", "b", "c", "d"]);
    expect(COMPARE_MAX_ITEMS).toBe(4);
    toggleCompare("a");
    expect(slugs()).toEqual(["b", "c", "d"]);
    clearCompare();
    expect(slugs()).toEqual([]);
  });

  it("survives a reload", () => {
    clearCompare();
    toggleCompare("telefon-x");
    const persisted = localStorage.getItem(COMPARE_STORAGE_KEY);
    expect(deserializeCompare(persisted).slugs).toEqual(["telefon-x"]);
  });
});
