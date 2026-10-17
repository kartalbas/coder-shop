export const PACKAGING_GRAMS = 150;

export interface WeightLine {
  qty: number;
  weightGrams: number;
}

export function parcelWeightGrams(lines: WeightLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.weightGrams, 0) + PACKAGING_GRAMS;
}
