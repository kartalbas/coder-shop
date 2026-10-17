// The one place human-readable document numbers are shaped (issue #31): the server mints
// them from the Counter, the seed writes them directly, tests assert on them — all three
// call these functions instead of re-spelling the templates.

export function formatOrderNumber(year: number, seq: number): string {
  return `B-${year}-${String(seq).padStart(6, "0")}`;
}

export function formatPoNumber(year: number, seq: number): string {
  return `E-${year}-${String(seq).padStart(6, "0")}`;
}

export function formatPaymentReference(seq: number): string {
  return `P-${String(seq).padStart(6, "0")}`;
}
