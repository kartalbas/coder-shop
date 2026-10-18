import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleFormattersProvider } from "@/components/storefront/locale-formatters";
import { StarRating } from "@/components/storefront/star-rating";

// Issue #58 review fix: the rating value follows the request language's Intl locale —
// es writes 4,5 where de-CH writes 4.5. Fails on the pre-fix build, which formatted
// every language with a hard-coded "de-CH".
const ariaLabelOf = (lang: string) => {
  const html = renderToString(
    <LocaleFormattersProvider lang={lang}>
      <StarRating value={4.5} />
    </LocaleFormattersProvider>,
  );
  return html.match(/aria-label="([^"]+)"/)![1];
};

describe("StarRating (#58 — locale-formatted rating)", () => {
  it("writes the average the way the request language writes it", () => {
    expect(ariaLabelOf("es")).toContain("4,5");
    expect(ariaLabelOf("de")).toContain("4.5");
  });

  it("falls back to the base locale without a provider (admin)", () => {
    const html = renderToString(<StarRating value={4.5} />);
    expect(html).toContain("4.5 von 5 Sternen");
  });
});
