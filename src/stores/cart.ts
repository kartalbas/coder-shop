import { useSyncExternalStore } from "react";
import { subtotalCents } from "@/lib/pricing";

export interface CartLine {
  productId: string;
  slug: string;
  sku: string;
  name: string;
  variantLabel: string;
  imageSrc: string;
  unitPriceCents: number;
  qty: number;
  stock: number;
}

export interface CartState {
  lines: CartLine[];
}

export const CART_STORAGE_KEY = "cart:v1";

const EMPTY_CART: CartState = { lines: [] };
const listeners = new Set<() => void>();

let state: CartState = EMPTY_CART;
let drawerOpen = false;
let hydrated = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  if (!hydrated) return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(state));
  } catch {
    // storage unavailable (private mode) — cart stays in memory
  }
}

function setState(next: CartState): void {
  state = next;
  persist();
  emit();
}

export function serializeCart(cart: CartState): string {
  return JSON.stringify({ v: 1, lines: cart.lines });
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === "string" &&
    typeof line.slug === "string" &&
    typeof line.sku === "string" &&
    typeof line.name === "string" &&
    typeof line.variantLabel === "string" &&
    typeof line.imageSrc === "string" &&
    typeof line.unitPriceCents === "number" &&
    Number.isInteger(line.qty) &&
    (line.qty as number) > 0 &&
    typeof line.stock === "number"
  );
}

export function deserializeCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_CART;
    const data = parsed as { v?: unknown; lines?: unknown };
    if (data.v !== 1 || !Array.isArray(data.lines)) return EMPTY_CART;
    return { lines: data.lines.filter(isCartLine) };
  } catch {
    return EMPTY_CART;
  }
}

export function hydrateCart(): void {
  if (hydrated) return;
  hydrated = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    raw = null;
  }
  state = deserializeCart(raw);
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CartState {
  return state;
}

function getServerSnapshot(): CartState {
  return EMPTY_CART;
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function cartCount(cart: CartState): number {
  return cart.lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotalCents(cart: CartState): number {
  return subtotalCents(cart.lines);
}

export function addToCart(line: Omit<CartLine, "qty">, qty = 1): void {
  const clamped = Math.max(1, Math.min(qty, line.stock));
  if (clamped <= 0) return;
  const existing = state.lines.find((l) => l.sku === line.sku);
  const lines = existing
    ? state.lines.map((l) =>
        l.sku === line.sku ? { ...l, qty: Math.min(l.qty + clamped, line.stock) } : l,
      )
    : [...state.lines, { ...line, qty: clamped }];
  setState({ lines });
}

export function updateQty(sku: string, qty: number): void {
  if (qty <= 0) {
    removeLine(sku);
    return;
  }
  setState({
    lines: state.lines.map((l) =>
      l.sku === sku ? { ...l, qty: Math.min(qty, l.stock) } : l,
    ),
  });
}

export function removeLine(sku: string): void {
  setState({ lines: state.lines.filter((l) => l.sku !== sku) });
}

// Issue #12: when the server refuses a checkout because prices changed, the cart adopts
// the current prices so the summary the customer re-confirms is the price they will pay.
export function syncPrices(prices: { sku: string; unitPriceCents: number }[]): void {
  const bySku = new Map(prices.map((p) => [p.sku, p.unitPriceCents]));
  setState({
    lines: state.lines.map((l) =>
      bySku.has(l.sku) ? { ...l, unitPriceCents: bySku.get(l.sku)! } : l,
    ),
  });
}

export function clearCart(): void {
  setState({ lines: [] });
}

function getDrawerSnapshot(): boolean {
  return drawerOpen;
}

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(subscribe, getDrawerSnapshot, () => false);
}

export function openCartDrawer(): void {
  drawerOpen = true;
  emit();
}

export function closeCartDrawer(): void {
  drawerOpen = false;
  emit();
}
