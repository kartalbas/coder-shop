"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { localizedPath, splitLanguagePrefix } from "@/lib/locale-path";
import type { LanguageConfig } from "@/lib/i18n";

// Issue #58 step 2: the language switcher — one link per active language row to the same
// page in that language (query preserved), `aria-current` on the active one. The proxy
// writes the `lang` cookie on every prefixed request, so the choice is remembered for
// prefix-free links and the next visit. A new language is a row — it appears here without
// a code change.
//
// Real anchors, not `Link`: a client-side navigation can be answered from the router's
// prefetch cache without any request, and then the proxy never runs — the URL and content
// switch language while the remembered-choice cookie stays stale. A document navigation
// guarantees the proxy sees the switch and writes the cookie (the proxy is the cookie's
// only writer).
export function LanguageSwitcher({ languages }: { languages: readonly LanguageConfig[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { lang, rest } = splitLanguagePrefix(
    pathname,
    languages.map((language) => language.code),
  );
  return (
    <nav aria-label="Sprache" className="flex items-center gap-0.5">
      {languages.map((language) => {
        const current = language.code === lang;
        return (
          <a
            key={language.code}
            href={localizedPath(language.code, rest) + (search ? `?${search}` : "")}
            hrefLang={language.code}
            lang={language.code}
            aria-current={current ? "true" : undefined}
            title={language.label}
            className={
              "rounded-md px-1.5 py-1 text-xs font-medium uppercase transition-colors focus-visible:outline-2 focus-visible:outline-ring " +
              (current
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground")
            }
          >
            {language.code}
          </a>
        );
      })}
    </nav>
  );
}
