// Issue #58 step 2b: numbers, CHF and dates follow the intlLocale of the request's
// language row — never a hard-coded locale. `createFormatters` is the pure factory
// (one Intl set per locale, cached). Since the #58 step-6 slice every consumer reads
// the live row: the storefront and admin use `getRequestFormatters()`, documents
// (mails, invoice/QR PDFs, label content) use the stored language's set through
// `getMailContext` — the base-locale named exports are retired.

export interface Formatters {
  chf(cents: number): string;
  date(date: Date): string;
  dateTime(date: Date): string;
  weight(grams: number): string;
  // Plain locale-formatted number (no unit) — for ranges like "180–240 g".
  number(value: number): string;
}

const formattersByLocale = new Map<string, Formatters>();

export function createFormatters(intlLocale: string): Formatters {
  const cached = formattersByLocale.get(intlLocale);
  if (cached) return cached;
  const chf = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "CHF" });
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "long" });
  const dateTime = new Intl.DateTimeFormat(intlLocale, { dateStyle: "long", timeStyle: "short" });
  const kilograms = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
  const grams = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat(intlLocale);
  const formatters: Formatters = {
    chf: (cents: number) => chf.format(cents / 100),
    date: (value: Date) => date.format(value),
    dateTime: (value: Date) => dateTime.format(value),
    weight: (value: number) =>
      value >= 1000
        ? `${kilograms.format(value / 1000)} kg`
        : `${grams.format(value)} g`,
    number: (value: number) => number.format(value),
  };
  formattersByLocale.set(intlLocale, formatters);
  return formatters;
}
