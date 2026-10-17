import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface User {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin";
  // Tokens issued before this instant are revoked (logout / password change).
  sessionsInvalidBefore?: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin"], required: true, default: "admin" },
    sessionsInvalidBefore: { type: Date },
  },
  { versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel =
  mongoose.models.User ?? mongoose.model<User>("User", userSchema);
