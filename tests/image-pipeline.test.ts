import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_TYPES } from "@/lib/catalog-types";
import { isPhotoSrc } from "@/lib/images";
import { generateCatalog } from "../scripts/seed/catalog";
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
  it("names the photo noun, translated colour, view and the no-logo/no-text constraints", () => {
    const prompt = buildImagePrompt({ photoNoun: "smartphone", color: "titan", view: "front" });
    expect(prompt).toContain("smartphone");
    expect(prompt).toContain("titanium");
    expect(prompt).toContain("front view");
    expect(prompt).toContain("studio");
    expect(prompt).toContain("no logos");
    expect(prompt).toContain("no text");
  });

  it("includes the translated material for clothing", () => {
    const prompt = buildImagePrompt({
      photoNoun: "outdoor garment",
      color: "oliv",
      material: "Daune",
      view: "detail",
    });
    expect(prompt).toContain("olive");
    expect(prompt).toContain("down");
    expect(prompt).toContain("detail view");
  });

  it("uses whatever photo noun the type config carries and keeps unknown colours verbatim", () => {
    const prompt = buildImagePrompt({ photoNoun: "athletic sneaker", color: "coral", view: "lifestyle" });
    expect(prompt).toContain("sneaker");
    expect(prompt).toContain("coral");
    expect(prompt).toContain("lifestyle view");
  });

  it("works for a runtime-added type through its config noun — no code type map (issue #61)", () => {
    const prompt = buildImagePrompt({ photoNoun: "cable organiser", color: "schwarz", view: "front" });
    expect(prompt).toContain("cable organiser in black");
  });

  it("never contains brand names (prompts carry no brand input)", () => {
    const brands = ["Apple", "Nike", "Adidas", "Samsung", "Puma", "Patagonia", "Mammut"];
    const prompt = buildImagePrompt({ photoNoun: "athletic sneaker", color: "schwarz", view: "side" });
    for (const brand of brands) expect(prompt.toLowerCase()).not.toContain(brand.toLowerCase());
  });
});

describe("catalog type photo nouns (issue #61 review)", () => {
  it("every seed config carries a non-empty photoNoun", () => {
    for (const type of DEFAULT_CATALOG_TYPES) {
      expect(type.photoNoun.trim().length).toBeGreaterThan(0);
    }
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

describe("seed image slots (issue #29)", () => {
  it("records the final photo paths — the seed writes no SVGs anymore", () => {
    const catalog = generateCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    for (const product of catalog) {
      expect(product.images.length).toBeGreaterThanOrEqual(1);
      product.images.forEach((image, n) => {
        expect(image.src).toBe(`/products/${product.slug}-${n + 1}.webp`);
        expect(isPhotoSrc(image.src)).toBe(true);
      });
    }
  });
});
