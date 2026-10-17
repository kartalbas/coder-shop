import mongoose, { Schema, type Types } from "mongoose";

export type UserRole = "admin" | "customer";

// Issue #39: address book of a customer — several shipping addresses, one billing
// address, one default shipping address.
export interface CustomerAddress {
  label: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  kind: "shipping" | "billing";
  isDefault: boolean;
}

export interface User {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  // Tokens issued before this instant are revoked (logout / password change).
  sessionsInvalidBefore?: Date;
  addresses: CustomerAddress[];
}

const addressSchema = new Schema<CustomerAddress>(
  {
    label: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, uppercase: true },
    kind: { type: String, enum: ["shipping", "billing"], required: true, default: "shipping" },
    isDefault: { type: Boolean, required: true, default: false },
  },
  { _id: true },
);

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "customer"], required: true, default: "admin" },
    sessionsInvalidBefore: { type: Date },
    addresses: { type: [addressSchema], default: [] },
  },
  { versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel =
  mongoose.models.User ?? mongoose.model<User>("User", userSchema);
