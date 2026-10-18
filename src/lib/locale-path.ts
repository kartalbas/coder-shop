// Issue #58 step 2: the language lives in the first URL segment (`/fr/account/profile`).
// This pure module is the single place that splits a pathname into its language prefix
// and the English path behind it (#63), and the single place that builds a localized
// path — the proxy, the header switcher and the hreflang links all read these two
// functions, so the set of language codes stays data passed in by the caller.

// Request header the proxy sets with the English path behind the language prefix, so
// `[lang]`'s generateMetadata can build hreflang alternates for the current page.
export const LOCALIZED_PATH_HEADER = "x-localized-path";

// Request header the proxy sets with the language resolved from the URL prefix — the
// only channel by which code outside the `[lang]` tree (the global `/_not-found` the
// proxy rewrites unknown slugs to, #58 review) learns the prefix language, which
// outranks cookie and Accept-Language exactly like in `resolveLanguage`.
export const LANGUAGE_HEADER = "x-language";

export interface SplitPath {
  lang: string | null;
  rest: string;
}

// `/de/products` → { lang: "de", rest: "/products" }; `/products` → { lang: null,
// rest: "/products" }; a first segment that is not an active language code is part of
// the path, never a prefix. `/de` alone has the empty path behind it, normalised to "/".
export function splitLanguagePrefix(pathname: string, codes: readonly string[]): SplitPath {
  const segment = pathname.split("/")[1]?.toLowerCase();
  if (segment && codes.includes(segment)) {
    const rest = pathname.slice(segment.length + 1);
    return { lang: segment, rest: rest === "" ? "/" : rest };
  }
  return { lang: null, rest: pathname };
}

// Builds the URL of a prefix-free path in a language: `/products` in fr → `/fr/products`;
// the root `/` in de → `/de`.
export function localizedPath(lang: string, pathname: string): string {
  return `/${lang}${pathname === "/" ? "" : pathname}`;
}
