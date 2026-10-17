import { type ClientSession } from "mongoose";
import { CounterModel } from "@/models/counter";

export interface MintedNumber {
  value: string;
  seq: number;
}

export async function mintNumber(
  counterId: "order" | "po",
  format: (year: number, seq: number) => string,
  session: ClientSession,
): Promise<MintedNumber> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  if (!counter) throw new Error(`Could not mint a number from the "${counterId}" counter`);
  return { value: format(new Date().getUTCFullYear(), counter.seq), seq: counter.seq };
}
