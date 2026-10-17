import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToCart,
  cartCount,
  cartSubtotalCents,
  clearCart,
  CART_STORAGE_KEY,
  deserializeCart,
  hydrateCart,
  removeLine,
  serializeCart,
  subscribe,
  updateQty,
  type CartLine,
} from "./cart";

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

hydrateCart();

const line: Omit<CartLine, "qty"> = {
  productId: "p1",
  slug: "iphone-16",
  sku: "IP16-BLK-128",
  name: "iPhone 16",
  variantLabel: "128 GB / schwarz",
  imageSrc: "/products/iphone-16-1.svg",
  unitPriceCents: 99900,
  stock: 5,
};

describe("cart store", () => {
  beforeEach(() => {
    clearCart();
  });

  it("serializes and deserializes round-trip", () => {
    const state = {
      lines: [{ ...line, qty: 2 }, { ...line, sku: "IP16-WHT-256", qty: 1 }],
    };
    const restored = deserializeCart(serializeCart(state));
    expect(restored).toEqual(state);
  });

  it("rejects corrupt payloads", () => {
    expect(deserializeCart(null).lines).toEqual([]);
    expect(deserializeCart("not json").lines).toEqual([]);
    expect(deserializeCart(JSON.stringify({ v: 2, lines: [] })).lines).toEqual([]);
    expect(deserializeCart(JSON.stringify({ v: 1, lines: [{ bogus: true }] })).lines).toEqual([]);
  });

  it("notifies subscribers on add-to-cart (badge/drawer update)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    addToCart(line, 2);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("adds lines, merges by sku and clamps to stock", () => {
    addToCart(line, 2);
    addToCart(line, 3);
    addToCart(line, 10);
    const snapshot = deserializeCart(localStorage.getItem(CART_STORAGE_KEY));
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.lines[0].qty).toBe(5);
    expect(cartCount(snapshot)).toBe(5);
    expect(cartSubtotalCents(snapshot)).toBe(5 * 99900);
  });

  it("persists to localStorage and survives reload via hydrate", () => {
    hydrateCart();
    addToCart(line, 3);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toContain(line.sku);
    const restored = deserializeCart(localStorage.getItem(CART_STORAGE_KEY));
    expect(restored.lines[0].qty).toBe(3);
  });

  it("updates and removes lines", () => {
    addToCart(line, 2);
    addToCart({ ...line, sku: "OTHER" }, 1);
    updateQty("OTHER", 4);
    let snapshot = deserializeCart(localStorage.getItem(CART_STORAGE_KEY));
    expect(snapshot.lines.find((l) => l.sku === "OTHER")?.qty).toBe(4);
    updateQty("OTHER", 0);
    snapshot = deserializeCart(localStorage.getItem(CART_STORAGE_KEY));
    expect(snapshot.lines.map((l) => l.sku)).toEqual([line.sku]);
    removeLine(line.sku);
    snapshot = deserializeCart(localStorage.getItem(CART_STORAGE_KEY));
    expect(snapshot.lines).toHaveLength(0);
  });
});
