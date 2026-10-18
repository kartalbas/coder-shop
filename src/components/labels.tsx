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
import { BASE_LANGUAGE, labelMap } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";

// Issue #58 step 3: deep client trees (product cards on five pages, rails, the listing
// shell) read their texts from the translation table without prop-drilling a label map
// through every call site. Same shape as the LocaleFormattersProvider: the context
// starts from the seed configuration of the URL's language (pure, identical on server
// and client — no hydration flicker, the static shell prerenders with the right texts);
// a `LabelsSync` inside a dynamic hole hands over the live table, so an admin edit
// takes effect without a deploy. Both roots wrap it: the `[lang]` storefront layout and
// the prefix-free admin layout (#58 admin slice). Outside any provider the context
// answers the base-language seed map. A context fed by an API stays rejected (DECISIONS
// — first-paint flash); this one is fed by the server-rendered layout.
interface LabelsContextValue {
  labels: Record<string, string>;
  syncLabels: (labels: Record<string, string>) => void;
}

const LabelsContext = createContext<LabelsContextValue>({
  labels: labelMap(DEFAULT_TRANSLATIONS, BASE_LANGUAGE),
  syncLabels: () => {},
});

export function LabelsProvider({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  const [labels, setLabels] = useState(() => labelMap(DEFAULT_TRANSLATIONS, lang));
  const syncLabels = useCallback((next: Record<string, string>) => setLabels(next), []);
  const value = useMemo(() => ({ labels, syncLabels }), [labels, syncLabels]);
  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

// Rendered inside a dynamic hole with the live table's label map; updates the provider
// when the table differs from the seed configuration it was initialised from.
export function LabelsSync({ labels }: { labels: Record<string, string> }) {
  const { syncLabels } = useContext(LabelsContext);
  useEffect(() => {
    syncLabels(labels);
  }, [labels, syncLabels]);
  return null;
}

export function useLabels(): Record<string, string> {
  return useContext(LabelsContext).labels;
}
