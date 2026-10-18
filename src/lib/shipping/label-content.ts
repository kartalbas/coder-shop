// Issue #62 (#54): the serial block of a shipping label — one pure source for every
// provider. Empty for quantity orders, so they render no block at all. The header is
// passed in (#58 decision point 3): the caller resolves it from the translation table
// in the order's language, this module stays text-free.
export function labelSerialLines(
  serials: readonly string[],
  header: string,
  maxLineLength = 52,
): string[] {
  if (serials.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const serial of serials) {
    const piece = current ? `, ${serial}` : serial;
    if (current && current.length + piece.length > maxLineLength) {
      lines.push(current);
      current = serial;
    } else {
      current += piece;
    }
  }
  if (current) lines.push(current);
  return [header, ...lines];
}
