import { useSyncExternalStore } from "react";

// "Zuletzt angesehen" (issue #46): the last product slugs the customer opened, newest
// first, local to this browser only — it powers the rails on the home and product pages.

const RECENTLY_VIEWED_STORAGE_KEY = "recent:v1";
export const RECENTLY_VIEWED_MAX_ITEMS = 12;

let slugs: string[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  if (!hydrated) return;
  try {
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, serializeRecentlyViewed(slugs));
  } catch {
    // storage unavailable (private mode) — the list stays in memory
  }
}

function setState(next: string[]): void {
  slugs = next;
  persist();
  emit();
}

export function serializeRecentlyViewed(values: string[]): string {
  return JSON.stringify({ v: 1, slugs: values });
}

function sanitizeSlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const slug = value.trim();
    if (!slug || slug.length > 120) continue;
    seen.add(slug);
    if (seen.size >= RECENTLY_VIEWED_MAX_ITEMS) break;
  }
  return [...seen];
}

export function deserializeRecentlyViewed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const data = parsed as { v?: unknown; slugs?: unknown };
    if (data.v !== 1) return [];
    return sanitizeSlugs(data.slugs);
  } catch {
    return [];
  }
}

export function hydrateRecentlyViewed(): void {
  if (hydrated) return;
  hydrated = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
  } catch {
    raw = null;
  }
  setState(deserializeRecentlyViewed(raw));
}

function ensureHydrated(): void {
  if (!hydrated) hydrateRecentlyViewed();
}

function subscribeRecentlyViewed(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  return slugs;
}

function getServerSnapshot(): string[] {
  return [];
}

export function useRecentlyViewed(): string[] {
  return useSyncExternalStore(subscribeRecentlyViewed, getSnapshot, getServerSnapshot);
}

export function getRecentlyViewedSlugs(): string[] {
  ensureHydrated();
  return slugs;
}

// Record one product view: deduplicated, moved to the front, capped.
export function recordViewed(slug: string): void {
  ensureHydrated();
  const trimmed = slug.trim();
  if (!trimmed) return;
  setState([trimmed, ...slugs.filter((s) => s !== trimmed)].slice(0, RECENTLY_VIEWED_MAX_ITEMS));
}
