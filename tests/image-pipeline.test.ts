import { describe, expect, it } from "vitest";
import { isPhotoSrc } from "@/lib/images";
import {
  IMAGE_VIEWS,
  buildImagePrompt,
  imageAlt,
  imageSeed,
  viewForImage,
} from "../scripts/images/prompt";

describe("viewForImage", () => {
  it("maps image indices to the five views in order", () => {
    expect(IMAGE_VIEWS).toEqual(["front", "side", "back", "detail", "lifestyle"]);
    IMAGE_VIEWS.forEach((view, index) => {
      expect(viewForImage(index)).toBe(view);
    });
  });

  it("wraps around beyond five images", () => {
    expect(viewForImage(5)).toBe("front");
    expect(viewForImage(7)).toBe("back");
  });
});

describe("imageSeed", () => {
  it("is deterministic and a 32-bit unsigned integer", () => {
    const seed = imageSeed("apple-iphone-16-001", 1);
    expect(imageSeed("apple-iphone-16-001", 1)).toBe(seed);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it("differs per slot", () => {
    const seeds = new Set([
      imageSeed("apple-iphone-16-001", 1),
      imageSeed("apple-iphone-16-001", 2),
      imageSeed("nike-air-max-dn-071", 1),
    ]);
    expect(seeds.size).toBe(3);
  });
});

describe("buildImagePrompt", () => {
  it("names type, translated colour, view and the no-logo/no-text constraints", () => {
    const prompt = buildImagePrompt({ type: "smartphone", color: "titan", view: "front" });
    expect(prompt).toContain("smartphone");
    expect(prompt).toContain("titanium");
    expect(prompt).toContain("front view");
    expect(prompt).toContain("studio");
    expect(prompt).toContain("no logos");
    expect(prompt).toContain("no text");
  });

  it("includes the translated material for clothing", () => {
    const prompt = buildImagePrompt({
      type: "clothing",
      color: "oliv",
      material: "Daune",
      view: "detail",
    });
    expect(prompt).toContain("olive");
    expect(prompt).toContain("down");
    expect(prompt).toContain("detail view");
  });

  it("uses a shoe subject for shoes and keeps unknown colours verbatim", () => {
    const prompt = buildImagePrompt({ type: "shoes", color: "coral", view: "lifestyle" });
    expect(prompt).toContain("sneaker");
    expect(prompt).toContain("coral");
    expect(prompt).toContain("lifestyle view");
  });

  it("never contains brand names (prompts carry no brand input)", () => {
    const brands = ["Apple", "Nike", "Adidas", "Samsung", "Puma", "Patagonia", "Mammut"];
    const prompt = buildImagePrompt({ type: "shoes", color: "schwarz", view: "side" });
    for (const brand of brands) expect(prompt.toLowerCase()).not.toContain(brand.toLowerCase());
  });
});

describe("imageAlt", () => {
  it("produces German alt text per view", () => {
    expect(imageAlt("Nike Samba", "front")).toBe("Nike Samba – Frontansicht");
    expect(imageAlt("Nike Samba", "lifestyle")).toBe("Nike Samba – Lifestyle-Ansicht");
  });
});

describe("isPhotoSrc", () => {
  it("accepts photo extensions and rejects placeholders", () => {
    expect(isPhotoSrc("/products/a-1.webp")).toBe(true);
    expect(isPhotoSrc("/products/a-1.jpg")).toBe(true);
    expect(isPhotoSrc("/products/a-1.jpeg")).toBe(true);
    expect(isPhotoSrc("/products/a-1.png")).toBe(true);
    expect(isPhotoSrc("/products/a-1.avif")).toBe(true);
    expect(isPhotoSrc("/products/a-1.svg")).toBe(false);
    expect(isPhotoSrc("")).toBe(false);
  });
});
