import { chromium } from new URL("../../node_modules/playwright/index.mjs", import.meta.url).href;
// Usage: node .agent/lead/check-admin-login.mjs <base-url> <admin-password> — logs in and opens admin pages.
const B = process.argv[2];
const b = await chromium.launch(); const c = await b.newContext(); const p = await c.newPage();
await p.goto(B + "/admin/login"); await p.fill('input[type=email], input[name=email]', "admin@codershop.ch"); await p.fill('input[type=password]', process.argv[3]);
await Promise.all([p.waitForURL(u => !u.toString().includes("login"), { timeout: 15000 }).catch(() => {}), p.keyboard.press("Enter")]);
console.log("after login:", p.url());
console.log("cookies:", JSON.stringify((await c.cookies()).map(k => ({ name: k.name, secure: k.secure, path: k.path, sameSite: k.sameSite }))));
for (const path of ["/admin/orders", "/admin/bestellungen", "/admin/products"]) { await p.goto(B + path); console.log(path, "→", p.url()); }
await b.close();
