import { describe, expect, it } from "vitest";
import {
  deserializeRecentlyViewed,
  getRecentlyViewedSlugs,
  recordViewed,
  RECENTLY_VIEWED_MAX_ITEMS,
  serializeRecentlyViewed,
} from "./recently-viewed";
import {
  deserializeWishlist,
  getWishlistSlugs,
  hydrateWishlist,
  removeFromWishlist,
  serializeWishlist,
  setWishlistSlugs,
  toggleWishlist,
  WISHLIST_MAX_ITEMS,
  WISHLIST_STORAGE_KEY,
} from "./wishlist";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

hydrateWishlist();

describe("wishlist store (issue #46)", () => {
  it("serializes and deserializes round-trip", () => {
    const state = { slugs: ["apple-iphone-16", "nike-air"] };
    expect(deserializeWishlist(serializeWishlist(state))).toEqual(state);
  });

  it("rejects corrupt payloads and non-string entries", () => {
    expect(deserializeWishlist(null).slugs).toEqual([]);
    expect(deserializeWishlist("kein json").slugs).toEqual([]);
    expect(deserializeWishlist('{"v":2,"slugs":["a"]}').slugs).toEqual([]);
    expect(deserializeWishlist('{"v":1,"slugs":"a"}').slugs).toEqual([]);
    expect(deserializeWishlist('{"v":1,"slugs":["a",7,""," a "]}').slugs).toEqual(["a"]);
  });

  it("toggle adds to the front, a second toggle removes", () => {
    toggleWishlist("a");
    toggleWishlist("b");
    expect(getWishlistSlugs()).toEqual(["b", "a"]);
    toggleWishlist("a");
    expect(getWishlistSlugs()).toEqual(["b"]);
    toggleWishlist("b");
    expect(getWishlistSlugs()).toEqual([]);
  });

  it("removeFromWishlist and setWishlistSlugs (server adoption)", () => {
    toggleWishlist("x");
    toggleWishlist("y");
    removeFromWishlist("x");
    expect(getWishlistSlugs()).toEqual(["y"]);
    setWishlistSlugs(["z", "y", "z", ""]);
    expect(getWishlistSlugs()).toEqual(["z", "y"]);
  });

  it("caps at the maximum size", () => {
    setWishlistSlugs(Array.from({ length: WISHLIST_MAX_ITEMS + 20 }, (_, i) => `p-${i}`));
    expect(getWishlistSlugs()).toHaveLength(WISHLIST_MAX_ITEMS);
  });

  it("persists across a reload", () => {
    setWishlistSlugs(["persist-me", "second"]);
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    expect(deserializeWishlist(raw).slugs).toEqual(["persist-me", "second"]);
  });
});

describe("recently viewed store (issue #46)", () => {
  it("round-trips and rejects corrupt payloads", () => {
    expect(deserializeRecentlyViewed(serializeRecentlyViewed(["a", "b"]))).toEqual(["a", "b"]);
    expect(deserializeRecentlyViewed("kaputt")).toEqual([]);
    expect(deserializeRecentlyViewed('{"v":3,"slugs":["a"]}')).toEqual([]);
  });

  it("records views deduplicated, newest first, capped", () => {
    recordViewed("a");
    recordViewed("b");
    recordViewed("a");
    expect(getRecentlyViewedSlugs()).toEqual(["a", "b"]);
    for (let i = 0; i < RECENTLY_VIEWED_MAX_ITEMS + 5; i += 1) recordViewed(`x-${i}`);
    expect(getRecentlyViewedSlugs()).toHaveLength(RECENTLY_VIEWED_MAX_ITEMS);
  });
});
