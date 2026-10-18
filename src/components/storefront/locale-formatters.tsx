"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BASE_LANGUAGE, DEFAULT_LANGUAGES, intlLocaleOf } from "@/lib/i18n";
import { createFormatters, type Formatters } from "@/lib/format";

// Issue #58 step 2b: client components format numbers, CHF and dates in the locale of
// the request's language. The provider starts from the seed configuration of the URL's
// language (correct for every seeded language, identical on server and client — no
// hydration flicker); a `LocaleSync` inside a dynamic hole hands over the live row's
// intlLocale, so an admin edit of a row takes effect without a deploy. Server
// components read `getIntlLocale(lang)` and use `createFormatters` directly.
interface LocaleContextValue {
  formatters: Formatters;
  syncIntlLocale: (intlLocale: string) => void;
}

const LocaleFormattersContext = createContext<LocaleContextValue>({
  formatters: createFormatters(intlLocaleOf(DEFAULT_LANGUAGES, BASE_LANGUAGE)),
  syncIntlLocale: () => {},
});

export function LocaleFormattersProvider({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  const [intlLocale, setIntlLocale] = useState(() => intlLocaleOf(DEFAULT_LANGUAGES, lang));
  const syncIntlLocale = useCallback(
    (locale: string) => setIntlLocale((current) => (current === locale ? current : locale)),
    [],
  );
  const value = useMemo(
    () => ({ formatters: createFormatters(intlLocale), syncIntlLocale }),
    [intlLocale, syncIntlLocale],
  );
  return (
    <LocaleFormattersContext.Provider value={value}>{children}</LocaleFormattersContext.Provider>
  );
}

// Rendered inside a dynamic hole with the live row's locale; updates the provider when
// the row differs from the seed configuration it was initialised from.
export function LocaleSync({ intlLocale }: { intlLocale: string }) {
  const { syncIntlLocale } = useContext(LocaleFormattersContext);
  useEffect(() => {
    syncIntlLocale(intlLocale);
  }, [intlLocale, syncIntlLocale]);
  return null;
}

export function useFormatters(): Formatters {
  return useContext(LocaleFormattersContext).formatters;
}
