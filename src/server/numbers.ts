import { type ClientSession } from "mongoose";
import { swissYear } from "@/lib/dates";
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
  // Issue #17: the number year is the Swiss calendar year, not the UTC one.
  return { value: format(swissYear(new Date()), counter.seq), seq: counter.seq };
}
