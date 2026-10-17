PHASE 1 — ARCHITECTURE AND PLAN. Read REQUIREMENTS.md. Do not write application code yet.

1. Look up the newest stable version of every package you will use (`npm view <pkg> version`,
   also for next, react, tailwindcss, mongoose, mongodb-memory-server, vitest, eslint, zod,
   motion, shadcn) and list them.
2. Write ARCHITECTURE.md: stack with those exact versions; folder structure; Mongoose models
   (fields, embedded variants and images, indexes for filters and search); server actions and
   route handlers; the order state machine; the ShippingProvider interface with the UPS and mock
   providers; how mongodb-memory-server is started for dev, seed, build and tests; the
   client/server component split that makes the storefront feel like a SPA; the UX concept
   per page (layout, key components, interactions, motion, dark mode, a11y).
3. Write PLAN.md: milestones M1–M5, each with numbered tasks and acceptance criteria that are
   checkable by commands or URLs (e.g. "curl /produkte?typ=schuhe&groesse=42 lists only
   size-42 shoes", "seed creates 200 products, 70/70/60, each with 1–5 images").
4. git add -A && git commit -m "Plan: architecture and milestones". Stop.
