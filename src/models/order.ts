import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export type OrderStatus =
  | "new"
  | "paid"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type ShippingMethod = "standard" | "express";

export interface StatusLogEntry {
  status: OrderStatus;
  at: Date;
  note?: string;
  by?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface OrderLine {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  weightGrams: number;
}

export interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  vatCents: number;
}

export interface OrderShipping {
  method: ShippingMethod;
  carrier?: "ups";
  trackingNumber?: string;
  labelPath?: string;
  parcelWeightGrams?: number;
}

export interface OrderPayment {
  method: "mock";
  reference: string;
  paidAt?: Date;
}

export interface Order {
  _id: Types.ObjectId;
  orderNumber: string;
  status: OrderStatus;
  statusLog: StatusLogEntry[];
  customer: OrderCustomer;
  lines: OrderLine[];
  totals: OrderTotals;
  shipping: OrderShipping;
  payment: OrderPayment;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<Order>;

const statusLogSchema = new Schema<StatusLogEntry>(
  {
    status: {
      type: String,
      enum: ["new", "paid", "picking", "packed", "shipped", "delivered", "cancelled"],
      required: true,
    },
    at: { type: Date, required: true },
    note: { type: String },
    by: { type: String },
  },
  { _id: false },
);

const customerSchema = new Schema<OrderCustomer>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    postalCode: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const lineSchema = new Schema<OrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    variantLabel: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    weightGrams: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const totalsSchema = new Schema<OrderTotals>(
  {
    subtotalCents: { type: Number, required: true },
    shippingCents: { type: Number, required: true },
    totalCents: { type: Number, required: true },
    vatCents: { type: Number, required: true },
  },
  { _id: false },
);

const shippingSchema = new Schema<OrderShipping>(
  {
    method: { type: String, enum: ["standard", "express"], required: true },
    carrier: { type: String, enum: ["ups"] },
    trackingNumber: { type: String },
    labelPath: { type: String },
    parcelWeightGrams: { type: Number },
  },
  { _id: false },
);

const paymentSchema = new Schema<OrderPayment>(
  {
    method: { type: String, enum: ["mock"], required: true },
    reference: { type: String, required: true },
    paidAt: { type: Date },
  },
  { _id: false },
);

const orderSchema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "paid", "picking", "packed", "shipped", "delivered", "cancelled"],
      required: true,
    },
    statusLog: { type: [statusLogSchema], required: true },
    customer: { type: customerSchema, required: true },
    lines: { type: [lineSchema], required: true },
    totals: { type: totalsSchema, required: true },
    shipping: { type: shippingSchema, required: true },
    payment: { type: paymentSchema, required: true },
  },
  { versionKey: false, timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.email": 1 });

export const OrderModel =
  mongoose.models.Order ?? mongoose.model<Order>("Order", orderSchema);
