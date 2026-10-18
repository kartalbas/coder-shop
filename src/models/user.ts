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
  // Payment-on-invoice credit for this customer (issue #40); unset means the
  // shop-wide default (lib/invoices DEFAULT_CREDIT_LIMIT_CENTS).
  creditLimitCents?: number;
  // Admin management (issue #43): a blocked customer cannot log in again; notes are
  // internal remarks the admin keeps on the account.
  blocked?: boolean;
  notes?: string;
  // Wishlist (issue #46): product slugs, newest first — the account copy the local
  // browser list syncs into while logged in.
  wishlist: string[];
  // The request language at registration (#58 decision point 3) — the account's mail
  // language; absent documents fall back to the first active language.
  language?: string;
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
    creditLimitCents: { type: Number, min: 0 },
    blocked: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 2000 },
    wishlist: { type: [String], default: [] },
    language: { type: String },
  },
  { versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel =
  mongoose.models.User ?? mongoose.model<User>("User", userSchema);
