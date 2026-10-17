import mongoose, { Schema, type Types } from "mongoose";

// Password-reset links (issue #39): only the SHA-256 of the random token is stored, the
// TTL index removes expired ones, `usedAt` makes every link single-use.
export interface PasswordReset {
  _id: string; // sha256 hex of the token
  userId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
}

const passwordResetSchema = new Schema<PasswordReset>(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { versionKey: false },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetSchema.index({ userId: 1 });

export const PasswordResetModel =
  mongoose.models.PasswordReset ??
  mongoose.model<PasswordReset>("PasswordReset", passwordResetSchema);
