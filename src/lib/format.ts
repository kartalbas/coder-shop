const chfFormatter = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
const dateFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "long", timeStyle: "short" });

export function formatChf(cents: number): string {
  return chfFormatter.format(cents / 100);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(kg)} kg`;
  }
  return `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(grams)} g`;
}
