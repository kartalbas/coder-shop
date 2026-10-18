import mongoose, { Schema, type Types } from "mongoose";

// Issue #58 editor slice: the change history of the one translation table — one entry
// per changed text (language code), written by `saveTranslationCore`. Audit data like
// the order statusLog: who changed what, from which text to which, when. Append-only,
// never edited; `actor` is the session admin's e-mail, null outside a request scope.
export interface TranslationHistoryDocument {
  _id: Types.ObjectId;
  key: string;
  language: string;
  oldValue: string;
  newValue: string;
  actor: string | null;
  at: Date;
}

const translationHistorySchema = new Schema<TranslationHistoryDocument>(
  {
    key: { type: String, required: true },
    language: { type: String, required: true },
    // "" is a valid value here (creation has no old text, clearing has no new one),
    // so these carry a default instead of `required` — which would reject "".
    oldValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    actor: { type: String, default: null },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);

translationHistorySchema.index({ key: 1, at: -1 });

export const TranslationHistoryModel =
  mongoose.models.TranslationHistory ??
  mongoose.model<TranslationHistoryDocument>(
    "TranslationHistory",
    translationHistorySchema,
  );
