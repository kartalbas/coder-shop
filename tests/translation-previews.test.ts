import { describe, expect, it } from "vitest";
import { previewPathFor, previewTemplateFor } from "@/lib/translation-previews";
import table from "@/server/translation-previews.json";

// Issue #58 editor slice: the preview route of a translation key comes from the
// checked-in namespace table — longest prefix wins, `admin.*` falls back to its own
// nav page when the segment exists there, `{slug}`/`{number}` fill from request-time
// samples, and anything without a page has no preview.

const TABLE = {
  shop: "/x",
  "shop.cart": "/cart",
  "shop.product": "/products/{slug}",
  "shop.order": "/orders/{number}",
};
const ADMIN_HREFS = ["/admin", "/admin/products", "/admin/orders"];

describe("previewPathFor (#58 editor slice)", () => {
  it("prefers the longest matching namespace", () => {
    expect(previewPathFor("shop.cart.title", TABLE, {}, [])).toBe("/cart");
    expect(previewPathFor("shop.home.hero", TABLE, {}, [])).toBe("/x");
  });

  it("fills samples and refuses without them", () => {
    expect(previewPathFor("shop.product.name", TABLE, {}, [])).toBeNull();
    expect(previewPathFor("shop.product.name", TABLE, { slug: "smartphone-a" }, [])).toBe(
      "/products/smartphone-a",
    );
    expect(previewPathFor("shop.order.title", TABLE, { number: "2026-7" }, [])).toBe(
      "/orders/2026-7",
    );
  });

  it("derives admin previews from the existing nav hrefs only", () => {
    expect(previewPathFor("admin.products.title", {}, {}, ADMIN_HREFS)).toBe("/admin/products");
    expect(previewPathFor("admin.dashboard.revenue", {}, {}, ADMIN_HREFS)).toBeNull();
    expect(previewPathFor("admin.nope.title", {}, {}, ADMIN_HREFS)).toBeNull();
    // A table entry still wins over the nav fallback.
    expect(previewPathFor("admin.products.title", { admin: "/admin" }, {}, ADMIN_HREFS)).toBe(
      "/admin",
    );
  });

  it("has no preview for keys without a page", () => {
    expect(previewPathFor("other.key", TABLE, {}, [])).toBeNull();
    expect(previewPathFor("mail.confirm.subject", table, {}, ADMIN_HREFS)).toBeNull();
    expect(previewPathFor("invoice.pdf.title", table, {}, ADMIN_HREFS)).toBeNull();
  });

  it("answers from the checked-in table for real keys", () => {
    expect(previewPathFor("shop.cart.title", table, {}, ADMIN_HREFS)).toBe("/cart");
    expect(previewPathFor("shop.checkout.title", table, {}, ADMIN_HREFS)).toBe("/checkout");
    expect(previewPathFor("shop.home.hero", table, {}, ADMIN_HREFS)).toBe("/");
    expect(previewTemplateFor("shop.product.name", table, ADMIN_HREFS)).toBe("/products/{slug}");
    expect(previewPathFor("shop.account.login.title", table, {}, ADMIN_HREFS)).toBe(
      "/account/login",
    );
  });
});
