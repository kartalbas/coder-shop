// Issue #58 step 2b: numbers, CHF and dates follow the intlLocale of the request's
// language row — never a hard-coded locale. `createFormatters` is the pure factory
// (one Intl set per locale, cached); the storefront hands it the live row's locale,
// while `formatChf`/`formatDate`/`formatDateTime`/`formatWeight` stay the base-locale
// formatters of the German-based side (admin, mails, invoices — until #58 step 3).
import { BASE_LANGUAGE, DEFAULT_LANGUAGES, intlLocaleOf } from "@/lib/i18n";

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

const baseFormatters = createFormatters(intlLocaleOf(DEFAULT_LANGUAGES, BASE_LANGUAGE));

export function formatChf(cents: number): string {
  return baseFormatters.chf(cents);
}

export function formatDate(date: Date): string {
  return baseFormatters.date(date);
}

export function formatDateTime(date: Date): string {
  return baseFormatters.dateTime(date);
}

export function formatWeight(grams: number): string {
  return baseFormatters.weight(grams);
}
