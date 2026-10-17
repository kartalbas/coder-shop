import { chromium } from new URL("../../node_modules/playwright/index.mjs", import.meta.url).href;
// Usage: node .agent/lead/screenshots.mjs <out-dir> — home, listing, product, admin (base URL in the file).
const B = "http://192.168.10.210:4000", out = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const shot = async (name, url) => { await p.goto(B + url, { waitUntil: "networkidle" }); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/${name}.png` }); };
await shot("1-home", "/");
await shot("2-listing", "/produkte?type=shoes");
await shot("3-product", "/produkt/adidas-gazelle-071");
await p.goto(B + "/admin/login"); await p.fill('input[type=email], input[name=email]', "admin@codershop.ch"); await p.fill('input[type=password]', "Admin!2026");
await Promise.all([p.waitForURL(u => !u.toString().includes("login"), { timeout: 15000 }).catch(() => {}), p.keyboard.press("Enter")]);
await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/4-admin.png` });
await b.close(); console.log("ok");
