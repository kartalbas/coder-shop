import { useSyncExternalStore } from "react";

// Smartphone comparison (issue #48): up to four product slugs the shopper wants to
// compare, local to this browser; the comparison page reads them from the URL, so a
// comparison is also shareable. Only smartphones can be compared — the toggles that
// write this list are rendered for that type only.

export interface CompareState {
  slugs: string[];
}

export const COMPARE_STORAGE_KEY = "compare:v1";
export const COMPARE_MAX_ITEMS = 4;

const EMPTY: CompareState = { slugs: [] };
const listeners = new Set<() => void>();

let state: CompareState = EMPTY;
let hydrated = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  if (!hydrated) return;
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, serializeCompare(state));
  } catch {
    // storage unavailable (private mode) — the list stays in memory
  }
}

function setState(next: CompareState): void {
  state = next;
  persist();
  emit();
}

export function serializeCompare(compare: CompareState): string {
  return JSON.stringify({ v: 1, slugs: compare.slugs });
}

function sanitizeSlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const slug = value.trim();
    if (!slug || slug.length > 120) continue;
    seen.add(slug);
    if (seen.size >= COMPARE_MAX_ITEMS) break;
  }
  return [...seen];
}

export function deserializeCompare(raw: string | null): CompareState {
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

export function hydrateCompare(): void {
  if (hydrated) return;
  hydrated = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(COMPARE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  state = deserializeCompare(raw);
  emit();
}

function ensureHydrated(): void {
  if (!hydrated) hydrateCompare();
}

function subscribeCompare(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CompareState {
  return state;
}

function getServerSnapshot(): CompareState {
  return EMPTY;
}

export function useCompare(): CompareState {
  return useSyncExternalStore(subscribeCompare, getSnapshot, getServerSnapshot);
}

export function toggleCompare(slug: string): void {
  ensureHydrated();
  setState(
    state.slugs.includes(slug)
      ? { slugs: state.slugs.filter((s) => s !== slug) }
      : { slugs: [...state.slugs.filter((s) => s !== slug), slug].slice(0, COMPARE_MAX_ITEMS) },
  );
}

export function clearCompare(): void {
  ensureHydrated();
  setState({ slugs: [] });
}
