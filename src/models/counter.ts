import mongoose, { Schema } from "mongoose";

type CounterId = "order" | "po";

export interface Counter {
  _id: CounterId;
  seq: number;
}


const counterSchema = new Schema<Counter>(
  {
    _id: { type: String, enum: ["order", "po"], required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel =
  mongoose.models.Counter ?? mongoose.model<Counter>("Counter", counterSchema);
