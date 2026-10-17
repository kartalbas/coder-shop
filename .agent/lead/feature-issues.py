#!/usr/bin/env python3
"""Feature issues for kartalbas/coder-shop: what the user wants (major) and the lead's ideas (minor).
Each describes the outcome and acceptance, not the implementation."""
import subprocess, tempfile

REPO = "kartalbas/coder-shop"
FOOT = "\n\n---\n_{src}, 2026-10-17. Part of docs/REQUIREMENTS.md, section PORTAL, PAYMENTS AND MORE._"

def f(title, prio, src, goal, details, accept):
    body = (f"**Goal**\n{goal}\n\n**What it includes**\n{details}\n\n**Done when**\n{accept}"
            + FOOT.format(src=src))
    return title, ["enhancement", prio], body

U, L = "Requested by the user", "Idea of the lead"
MAJ, MIN = "severity:major", "severity:minor"
F = [
 f("Customer portal: registration, login, my orders with status and tracking", MAJ, U,
  "Customers have an account area where they see everything about their orders.",
  "- Registration (name, e-mail, password with strength hint, consent to terms), login, logout, password reset by e-mail link (mails go to a dev outbox, see the e-mail issue).\n- „Mein Konto“: order history (newest first, search), each order with its status timeline, items, totals, invoice, tracking link once shipped; „Erneut bestellen“.\n- Profile and an address book (several shipping addresses, one billing address, a default).\n- Checkout: log in, or create an account on the way, or buy as a guest; a guest can claim the order later with the same e-mail.\n- The order confirmation page no longer shows personal data to anyone else (see #3).",
  "A new customer can register, buy, log out, log in again and find the order with its current status; e2e tests cover it."),
 f("Payment on invoice (Rechnung) with open invoices", MAJ, U,
  "Registered customers can pay by invoice; open invoices are visible to customer and admin.",
  "- Payment method „Rechnung“ for logged-in customers (with a credit limit per customer the admin can set).\n- An invoice PDF per order with due date (e.g. 30 days) — as a Swiss QR-bill (QR-Rechnung) with reference.\n- „Offene Rechnungen“ in the customer portal (amount, due date, overdue marker, PDF).\n- Admin: invoice list with filters (open, overdue, paid), mark as paid (partial payments too), reminder levels (1st/2nd reminder) with dates.\n- The order workflow respects it: invoice orders can be packed and shipped before payment.",
  "An invoice order shows up as open for the customer and the admin, can be marked paid, and overdue ones are flagged; tests cover the money paths."),
 f("Payment on pickup (Bezahlung bei Abholung)", MAJ, U,
  "Customers can choose to collect the order in the shop and pay there.",
  "- Shipping method „Abholung im Laden“ (free), with the store's address and opening hours.\n- Payment „bei Abholung“ (cash or card on site) — only together with pickup.\n- Statuses for pickup orders: ready for pickup → picked up (instead of shipped/delivered); a pickup code (and QR code) on the confirmation and in the portal.\n- Admin: pickup queue, mark „bereit zur Abholung“, scan or enter the code at handover, record payment.",
  "A pickup order goes from checkout to „abgeholt und bezahlt“ without any shipping step; e2e test."),
 f("Purchasing: keyboard-driven picker dialog for articles and suppliers", MAJ, U,
  "Choosing an article or supplier in purchasing is fast and works without a mouse; the current dropdown is not usable.",
  "- A dialog (command-palette style) opens on click or shortcut; typing searches instantly (name, SKU, brand, supplier), with highlighted matches.\n- ↑/↓ moves, Enter selects, Esc closes and cancels, Tab/Shift+Tab keep focus inside, the opener gets focus back.\n- Shows what matters to pick the right one: image, variant, current stock, last purchase price; for suppliers lead time and open POs.\n- Robust: debounced, handles no results, slow responses and many results (virtualised or paged); screen-reader friendly (combobox/listbox roles).\n- Use the same dialog wherever the admin picks a product, variant or supplier.",
  "A whole purchase order can be created with the keyboard only; e2e test drives it with keys."),
 f("Customer accounts in the admin", MIN, L,
  "The admin sees and manages customers.",
  "- Customer list with search; detail with orders, open invoices, credit limit, addresses, notes.\n- Block an account or reset its password (sends a reset mail).",
  "From an order the admin can open the customer and see all their orders and open amounts."),
 f("E-mails for every step, with a dev outbox", MIN, L,
  "Customers get the mails a real shop sends; in development they can be read in the browser.",
  "- Mails: registration, password reset, order confirmation, invoice with PDF, shipped with tracking, ready for pickup, payment reminder.\n- Templates in German with the shop's look; a transport behind an interface (SMTP in production, an outbox stored locally in development, viewable under /admin/mails).",
  "Each workflow step produces its mail, visible in the outbox; tests check the content."),
 f("Discount codes and promotions", MIN, L,
  "Marketing can run campaigns.",
  "- Codes (percentage or fixed amount, minimum order, valid from/to, usage limit, per customer once).\n- Entered in cart/checkout with clear feedback; shown on order, invoice and in the admin.\n- Admin management and usage statistics.",
  "A code changes totals and VAT correctly and stops working when its limits are reached; tests."),
 f("Wishlist and recently viewed", MIN, L,
  "Customers can remember products and come back to them.",
  "- Heart on cards and product page; wishlist in the portal (synced when logged in, local for guests).\n- „Zuletzt angesehen“ rail on home and product pages.\n- „Benachrichtigen, wenn wieder verfügbar“ for sold-out variants (mail via the outbox).",
  "Wishlist survives logout/login; a restock triggers the notification mail."),
 f("Product reviews and ratings", MIN, L,
  "Trust through reviews from real buyers.",
  "- Stars and text, only for customers who bought the product (verified badge).\n- Average and distribution on the product page, rating in cards, sort by rating; JSON-LD aggregateRating.\n- Admin moderation (approve, hide, answer).",
  "Only buyers can review; approved reviews appear with the correct average."),
 f("Compare smartphones side by side", MIN, L,
  "Choosing a phone is easier with a comparison.",
  "- „Vergleichen“ on up to 4 smartphones; a comparison page with price, storage options, colours, weight, key specs; differences highlighted; works on mobile.",
  "Four phones can be compared and the table highlights where they differ."),
 f("Admin command palette and keyboard shortcuts", MIN, L,
  "Power users move through the admin without the mouse.",
  "- ⌘K / Ctrl+K anywhere in the admin: jump to orders (by number or customer), products (name, SKU), customers, suppliers, and actions („Neue Einkaufsbestellung“).\n- Shortcuts with a „?“ overlay listing them; built on the same picker component as the purchasing dialog.",
  "Any order or product can be opened in three keystrokes; shortcuts are discoverable."),
]

if __name__ == "__main__":
    subprocess.run(["gh", "label", "create", "enhancement", "-R", REPO, "--color", "a2eeef",
                    "--description", "New feature or improvement", "--force"], capture_output=True)
    for t, labels, b in F:
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
            fh.write(b)
        args = ["gh", "issue", "create", "-R", REPO, "--title", t, "--body-file", fh.name]
        for x in labels: args += ["--label", x]
        print(subprocess.run(args, capture_output=True, text=True).stdout.strip() or f"FAILED: {t}", flush=True)
