import mongoose, { Schema, type Types } from "mongoose";
import type { LanguageConfig } from "@/lib/i18n";

// Issue #58: the shop's languages are rows, not code — the switcher, the translation
// editor and the resolver all iterate this collection; a new language is one row.
export interface LanguageDocument extends LanguageConfig {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const languageSchema = new Schema<LanguageDocument>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true },
    intlLocale: { type: String, required: true },
    position: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { versionKey: false, timestamps: true },
);

export const LanguageModel =
  mongoose.models.Language ?? mongoose.model<LanguageDocument>("Language", languageSchema);

export function toLanguageConfig(doc: LanguageDocument): LanguageConfig {
  return {
    code: doc.code,
    label: doc.label,
    intlLocale: doc.intlLocale,
    position: doc.position,
    active: doc.active,
  };
}
