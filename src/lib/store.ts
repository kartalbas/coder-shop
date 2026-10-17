// The shop's pickup store (issue #41) — single source for the checkout copy, the order
// confirmation and the portal. Pure data only.
export const STORE = {
  name: "coder-shop Laden",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  hours: [
    "Mo–Fr 09:00–18:30",
    "Sa 09:00–17:00",
    "So geschlossen",
  ],
} as const;

