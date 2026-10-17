import { Schema, model, type HydratedDocument } from "mongoose";

export type CounterId = "order" | "po";

export interface Counter {
  _id: CounterId;
  seq: number;
}

export type CounterDocument = HydratedDocument<Counter>;

const counterSchema = new Schema<Counter>(
  {
    _id: { type: String, enum: ["order", "po"], required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = model<Counter>("Counter", counterSchema);
