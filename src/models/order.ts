import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";
import { PICKUP_PAYMENT_TYPES, type PickupPaymentType } from "@/lib/payments";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/state-machine";
import type { PaymentMethodKind } from "@/lib/shop-settings";

export type { OrderStatus };

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
  // Issue #62 (#54): for serial-tracked types the exact units reserved for this
  // line; quantity types have no serials.
  serials?: string[];
}

interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  // Discount code reduction (issue #45); absent/0 when no code was used.
  discountCents?: number;
  totalCents: number;
  vatCents: number;
}

// Store pickup bookkeeping (issue #41): the code the customer shows at the counter,
// when the order was marked ready, and how the handover was paid.
interface OrderPickup {
  code: string;
  readyAt?: Date;
  pickedUpAt?: Date;
  paymentType?: PickupPaymentType;
}

interface OrderShipping {
  // Issue #64: the method key comes from the shop settings; `storePickup` is the flow
  // flag stored at checkout so the state machine and the queues never need the config.
  method: string;
  storePickup?: boolean;
  carrier?: "ups";
  trackingNumber?: string;
  labelPath?: string;
  parcelWeightGrams?: number;
  pickup?: OrderPickup;
}

// Invoice bookkeeping for payment.method "invoice" (issue #40): the open amount is
// totalCents − paidCents, overdue once `dueAt` has passed; reminders are dated so the
// 2nd one cannot be sent before the 1st.
interface OrderInvoice {
  dueAt: Date;
  paidCents: number;
  qrReference: string;
  reminder1At?: Date;
  reminder2At?: Date;
}

interface OrderPayment {
  // Issue #64: configured method key + the kind that decides the money flow.
  method: string;
  kind: PaymentMethodKind;
  reference: string;
  paidAt?: Date;
  invoice?: OrderInvoice;
}

export interface Order {
  _id: Types.ObjectId;
  orderNumber: string;
  status: OrderStatus;
  statusLog: StatusLogEntry[];
  // Set when a logged-in customer ordered (or claimed it later) — issue #39.
  userId?: Types.ObjectId;
  customer: OrderCustomer;
  lines: OrderLine[];
  totals: OrderTotals;
  shipping: OrderShipping;
  payment: OrderPayment;
  // Applied discount code (issue #45) — the code as typed and the booked reduction.
  discount?: { code: string; cents: number };
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<Order>;

const statusLogSchema = new Schema<StatusLogEntry>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
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
    serials: { type: [String] },
  },
  { _id: false },
);

const totalsSchema = new Schema<OrderTotals>(
  {
    subtotalCents: { type: Number, required: true },
    shippingCents: { type: Number, required: true },
    discountCents: { type: Number, min: 0 },
    totalCents: { type: Number, required: true },
    vatCents: { type: Number, required: true },
  },
  { _id: false },
);

const pickupSchema = new Schema<OrderPickup>(
  {
    code: { type: String, required: true },
    readyAt: { type: Date },
    pickedUpAt: { type: Date },
    paymentType: { type: String, enum: PICKUP_PAYMENT_TYPES },
  },
  { _id: false },
);

const shippingSchema = new Schema<OrderShipping>(
  {
    method: { type: String, required: true },
    storePickup: { type: Boolean },
    carrier: { type: String, enum: ["ups"] },
    trackingNumber: { type: String },
    labelPath: { type: String },
    parcelWeightGrams: { type: Number },
    pickup: { type: pickupSchema },
  },
  { _id: false },
);

const invoiceSchema = new Schema<OrderInvoice>(
  {
    dueAt: { type: Date, required: true },
    paidCents: { type: Number, required: true, min: 0 },
    qrReference: { type: String, required: true },
    reminder1At: { type: Date },
    reminder2At: { type: Date },
  },
  { _id: false },
);

const paymentSchema = new Schema<OrderPayment>(
  {
    method: { type: String, required: true },
    kind: { type: String, enum: ["immediate", "invoice", "on_pickup"], required: true },
    reference: { type: String, required: true },
    paidAt: { type: Date },
    invoice: { type: invoiceSchema },
  },
  { _id: false },
);

const orderSchema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusLog: { type: [statusLogSchema], required: true },
    userId: { type: Schema.Types.ObjectId },
    customer: { type: customerSchema, required: true },
    lines: { type: [lineSchema], required: true },
    totals: { type: totalsSchema, required: true },
    shipping: { type: shippingSchema, required: true },
    payment: { type: paymentSchema, required: true },
    discount: {
      type: new Schema(
        { code: { type: String, required: true }, cents: { type: Number, required: true } },
        { _id: false },
      ),
    },
  },
  { versionKey: false, timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.email": 1 });
orderSchema.index({ userId: 1, createdAt: -1 });
// Invoice lists (admin filters, customer portal, credit usage) — issue #40, keyed on
// the payment *kind* since #64 so any configured invoice-type method is covered.
orderSchema.index({ "payment.kind": 1, "payment.invoice.dueAt": 1 });

export const OrderModel =
  mongoose.models.Order ?? mongoose.model<Order>("Order", orderSchema);
