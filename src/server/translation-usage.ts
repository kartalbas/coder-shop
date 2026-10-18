// Issue #58 editor slice: the typed reader of `translation-usage.json` — the checked-in
// extraction of where each translation key is referenced in the code, regenerated and
// enforced by `tests/translation-usage.test.ts` (the `translation-seed.ts` pattern:
// one file, one reader).
import usageJson from "./translation-usage.json";
import type { TranslationUsage } from "@/lib/translation-usage";

export const TRANSLATION_USAGE: TranslationUsage = usageJson;
