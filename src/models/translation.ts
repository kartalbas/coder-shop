import mongoose, { Schema, type Types } from "mongoose";
import {
  BASE_LANGUAGE,
  TRANSLATION_AREAS,
  type TranslationArea,
  type TranslationEntry,
} from "@/lib/i18n";

// Issue #58: the single translation table — every text of the shop (UI, errors, mails,
// invoices, catalog content) is one row with the required German base text and a `texts`
// map keyed by language code. The map (not fixed fields) is what makes a new language a
// data change; the editor renders its columns from the `languages` collection.
// `textUpdatedAt` (#58 editor slice) is the per-text freshness map — code → ISO string
// of the last change, `de` included — keyed by language code exactly like `texts`, so a
// new language gains its own timestamp by being a row.
export interface TranslationDocument extends Omit<TranslationEntry, "area"> {
  _id: Types.ObjectId;
  area: TranslationArea;
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema<TranslationDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    area: { type: String, enum: TRANSLATION_AREAS, required: true },
    de: { type: String, required: true },
    texts: { type: Schema.Types.Mixed, required: true, default: {} },
    textUpdatedAt: { type: Schema.Types.Mixed },
  },
  { versionKey: false, timestamps: true },
);

export const TranslationModel =
  mongoose.models.Translation ??
  mongoose.model<TranslationDocument>("Translation", translationSchema);

export function toTranslationEntry(doc: TranslationDocument): TranslationEntry {
  const texts = { ...(doc.texts as Record<string, string>) };
  // Freshness with a migration-free fallback (#58 editor slice): a code with a text
  // but no stamp was never edited after the field existed — its text is as old as the
  // row itself, so it answers the document's createdAt (updatedAt would move on every
  // save and could never be older than a freshly edited base text). Untouched legacy
  // rows are uniformly old-equal and never flag; the first edit of their German base
  // marks the untouched languages exactly like an edited one.
  const stored = (doc.textUpdatedAt ?? {}) as Record<string, string>;
  const fallback = doc.createdAt.toISOString();
  const textUpdatedAt: Record<string, string> = { de: stored[BASE_LANGUAGE] ?? fallback };
  for (const code of Object.keys(texts)) {
    textUpdatedAt[code] = stored[code] ?? fallback;
  }
  return { key: doc.key, area: doc.area, de: doc.de, texts, textUpdatedAt };
}
