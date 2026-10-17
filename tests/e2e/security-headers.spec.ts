import { expect, test } from "@playwright/test";

// Issue #7: no protective headers at all — the admin could be framed by any other origin
// on the host, and Next advertised itself via x-powered-by.
test("every response carries the protective headers; nothing is frameable", async ({
  request,
}) => {
  for (const path of ["/", "/admin/login"]) {
    const response = await request.get(path);
    expect(response.headers()["x-content-type-options"], path).toBe("nosniff");
    expect(response.headers()["referrer-policy"], path).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers()["x-frame-options"], path).toBe("DENY");
    expect(response.headers()["content-security-policy"], path).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers()["strict-transport-security"], path).toContain("max-age=");
    expect(response.headers()["x-powered-by"], path).toBeUndefined();
  }
});
