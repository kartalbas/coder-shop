import mongoose, { Schema, type Types } from "mongoose";

export interface Supplier {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  leadTimeDays: number;
  active: boolean;
}


const supplierSchema = new Schema<Supplier>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    leadTimeDays: { type: Number, required: true, min: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { versionKey: false, timestamps: true },
);

supplierSchema.index({ name: 1 }, { unique: true });

export const SupplierModel =
  mongoose.models.Supplier ?? mongoose.model<Supplier>("Supplier", supplierSchema);
