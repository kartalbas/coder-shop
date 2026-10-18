import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LabelsProvider } from "@/components/labels";
import { LocaleFormattersProvider } from "@/components/locale-formatters";
import { StarRating } from "@/components/storefront/star-rating";

// Issue #58 review fix: the rating value follows the request language's Intl locale —
// es writes 4,5 where de-CH writes 4.5. Fails on the pre-fix build, which formatted
// every language with a hard-coded "de-CH".
const ariaLabelOf = (lang: string) => {
  const html = renderToString(
    <LabelsProvider lang={lang}>
      <LocaleFormattersProvider lang={lang}>
        <StarRating value={4.5} />
      </LocaleFormattersProvider>
    </LabelsProvider>,
  );
  return html.match(/aria-label="([^"]+)"/)![1];
};

describe("StarRating (#58 — locale-formatted rating)", () => {
  it("writes the average the way the request language writes it", () => {
    expect(ariaLabelOf("es")).toContain("4,5");
    expect(ariaLabelOf("de")).toContain("4.5");
  });

  // #58 step 3: the sentence itself is the review form's star row — a French page
  // reads French. Fails on the pre-fix build, which hard-coded the German words.
  it("names the stars in the request language", () => {
    expect(ariaLabelOf("fr")).toBe("4,5 sur 5 étoiles");
    expect(ariaLabelOf("es")).toBe("4,5 de 5 estrellas");
  });

  it("falls back to the base locale without a provider (admin)", () => {
    const html = renderToString(<StarRating value={4.5} />);
    expect(html).toContain("4.5 von 5 Sternen");
  });
});
