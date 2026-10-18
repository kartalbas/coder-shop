// Issue #58 editor slice: where a text is used is a fact about the code, extracted by
// `tests/translation-usage.test.ts` into the checked-in `src/server/translation-usage.json`
// and read here as plain data. Usage entries are either exact keys (`shop.cart.title`)
// or prefix entries from dynamic keys (`shop.status.*` from a template head); a plain
// key entry also covers its plural family (`shop.compare.stockValue` covers the
// `.one`/`.other` rows). This module resolves one row key to the files that reference
// it — exact entries first, then prefix/family entries.

export type TranslationUsage = Record<string, string[]>;

export function usageFilesFor(usage: TranslationUsage, key: string): string[] {
  const files: string[] = [];
  const add = (entries: string[] | undefined) => {
    for (const file of entries ?? []) if (!files.includes(file)) files.push(file);
  };
  add(usage[key]);
  for (const [entry, entryFiles] of Object.entries(usage)) {
    if (entry === key) continue;
    const covers = entry.endsWith(".*")
      ? key.startsWith(entry.slice(0, -1))
      : key.startsWith(`${entry}.`);
    if (covers) add(entryFiles);
  }
  return files;
}
