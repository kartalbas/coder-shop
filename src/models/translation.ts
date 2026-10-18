import mongoose, { Schema, type Types } from "mongoose";
import { TRANSLATION_AREAS, type TranslationArea, type TranslationEntry } from "@/lib/i18n";

// Issue #58: the single translation table — every text of the shop (UI, errors, mails,
// invoices, catalog content) is one row with the required German base text and a `texts`
// map keyed by language code. The map (not fixed fields) is what makes a new language a
// data change; the editor renders its columns from the `languages` collection.
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
  },
  { versionKey: false, timestamps: true },
);

export const TranslationModel =
  mongoose.models.Translation ??
  mongoose.model<TranslationDocument>("Translation", translationSchema);

export function toTranslationEntry(doc: TranslationDocument): TranslationEntry {
  return {
    key: doc.key,
    area: doc.area,
    de: doc.de,
    texts: { ...(doc.texts as Record<string, string>) },
  };
}
