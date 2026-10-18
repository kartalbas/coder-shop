// Issue #58 (user decision): the single source of the translation table's seed content
// is `translations.json` next to this file — one line-object per row in exactly the
// shape the `translations` collection stores, so a new text or language is data, never
// code. This module is its only reader: it types the rows and hands them to the seed,
// the server fallback and the labels provider. The pure `src/lib/i18n` keeps only the
// types and functions; the migrations (`RETIRED_TRANSLATION_KEYS`,
// `TRANSLATION_TEXT_REPAIRS`) stay code — they are not content.
import translationsJson from "./translations.json";
import type { TranslationEntry } from "@/lib/i18n";

export const DEFAULT_TRANSLATIONS: TranslationEntry[] = translationsJson as TranslationEntry[];
