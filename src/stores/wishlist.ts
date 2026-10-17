import { useSyncExternalStore } from "react";

// Wishlist (issue #46): product slugs, newest first, persisted to localStorage. For a
// logged-in customer the WishlistSync component mirrors it to the account, so it
// survives logout/login and other devices; guests keep it purely local.

export interface WishlistState {
  slugs: string[];
}

export const WISHLIST_STORAGE_KEY = "wishlist:v1";
export const WISHLIST_MAX_ITEMS = 100;

const EMPTY: WishlistState = { slugs: [] };
const listeners = new Set<() => void>();

let state: WishlistState = EMPTY;
let hydrated = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  if (!hydrated) return;
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, serializeWishlist(state));
  } catch {
    // storage unavailable (private mode) — wishlist stays in memory
  }
}

function setState(next: WishlistState): void {
  state = next;
  persist();
  emit();
}

export function serializeWishlist(wishlist: WishlistState): string {
  return JSON.stringify({ v: 1, slugs: wishlist.slugs });
}

function sanitizeSlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const slug = value.trim();
    if (!slug || slug.length > 120) continue;
    seen.add(slug);
    if (seen.size >= WISHLIST_MAX_ITEMS) break;
  }
  return [...seen];
}

export function deserializeWishlist(raw: string | null): WishlistState {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const data = parsed as { v?: unknown; slugs?: unknown };
    if (data.v !== 1) return EMPTY;
    return { slugs: sanitizeSlugs(data.slugs) };
  } catch {
    return EMPTY;
  }
}

export function hydrateWishlist(): void {
  if (hydrated) return;
  hydrated = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
  } catch {
    raw = null;
  }
  state = deserializeWishlist(raw);
  emit();
}

function ensureHydrated(): void {
  if (!hydrated) hydrateWishlist();
}

export function subscribeWishlist(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WishlistState {
  return state;
}

function getServerSnapshot(): WishlistState {
  return EMPTY;
}

export function useWishlist(): WishlistState {
  return useSyncExternalStore(subscribeWishlist, getSnapshot, getServerSnapshot);
}

// Until the persisted list is read, a toggle would act on the empty in-memory state —
// hearts stay disabled until this is true (same rule as the cart's hydrate gate, #27).
export function useWishlistHydrated(): boolean {
  return useSyncExternalStore(
    subscribeWishlist,
    () => hydrated,
    () => false,
  );
}

export function getWishlistSlugs(): string[] {
  ensureHydrated();
  return state.slugs;
}

// Add to the front / remove again — the heart's toggle.
export function toggleWishlist(slug: string): void {
  ensureHydrated();
  setState(
    state.slugs.includes(slug)
      ? { slugs: state.slugs.filter((s) => s !== slug) }
      : { slugs: [slug, ...state.slugs.filter((s) => s !== slug)].slice(0, WISHLIST_MAX_ITEMS) },
  );
}

export function removeFromWishlist(slug: string): void {
  ensureHydrated();
  setState({ slugs: state.slugs.filter((s) => s !== slug) });
}

// Adopt the server's list (used by WishlistSync after a merge/replace round-trip).
export function setWishlistSlugs(slugs: string[]): void {
  ensureHydrated();
  const next = sanitizeSlugs(slugs);
  if (next.join("|") === state.slugs.join("|")) return;
  setState({ slugs: next });
}
