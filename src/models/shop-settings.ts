import mongoose, { Schema, type Types } from "mongoose";
import type {
  PaymentMethodConfig,
  PaymentMethodKind,
  ShippingMethodConfig,
  ShopSettings,
} from "@/lib/shop-settings";

// Issue #64: VAT rate, shipping methods/prices and payment methods are this single
// document — generic code reads it, so changing a rule needs no code change.
export interface ShopSettingsDocument {
  _id: Types.ObjectId;
  key: "shop";
  vatRatePercent: number;
  freeShippingFromCents: number;
  shippingMethods: ShippingMethodConfig[];
  paymentMethods: (PaymentMethodConfig & { _id?: never })[];
  createdAt: Date;
  updatedAt: Date;
}

const shippingMethodSchema = new Schema<ShippingMethodConfig>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    position: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
    storePickup: { type: Boolean, required: true, default: false },
    hint: { type: String, default: "" },
  },
  { _id: false },
);

const paymentMethodSchema = new Schema<PaymentMethodConfig>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    position: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
    kind: {
      type: String,
      enum: ["immediate", "invoice", "on_pickup"],
      required: true,
      default: "immediate",
    },
  },
  { _id: false },
);

const shopSettingsSchema = new Schema<ShopSettingsDocument>(
  {
    key: { type: String, enum: ["shop"], required: true, unique: true },
    vatRatePercent: { type: Number, required: true, min: 0, max: 100 },
    freeShippingFromCents: { type: Number, required: true, min: 0 },
    shippingMethods: { type: [shippingMethodSchema], required: true },
    paymentMethods: { type: [paymentMethodSchema], required: true },
  },
  { versionKey: false, timestamps: true },
);

export const ShopSettingsModel =
  mongoose.models.ShopSettings ??
  mongoose.model<ShopSettingsDocument>("ShopSettings", shopSettingsSchema);

export function toShopSettings(doc: ShopSettingsDocument): ShopSettings {
  return {
    vatRatePercent: doc.vatRatePercent,
    freeShippingFromCents: doc.freeShippingFromCents,
    shippingMethods: doc.shippingMethods.map((method) => ({ ...method })),
    paymentMethods: doc.paymentMethods.map((method) => ({
      key: method.key,
      label: method.label,
      position: method.position,
      active: method.active,
      kind: method.kind as PaymentMethodKind,
    })),
  };
}
