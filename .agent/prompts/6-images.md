PHASE 4 — MILESTONE M6: PRODUCT PHOTOS. Read docs/REQUIREMENTS.md (section IMAGES),
docs/ARCHITECTURE.md, docs/PLAN.md and docs/PROGRESS.md first.

1. Add M6 to docs/PLAN.md (tasks + acceptance criteria) and the image pipeline to
   docs/ARCHITECTURE.md.
2. Implement it: `npm run images` generates every missing product image through the image API
   described in REQUIREMENTS (one prompt per image: product type, variant colour, material,
   view — front, side, back, detail, lifestyle — studio lighting, clean background, no logos or
   text), writes it under public/products/, and records the path on the product document;
   images already on disk are skipped, so the script can be stopped and restarted.
   `npm run images -- --limit N` makes at most N images. Retries with backoff on HTTP errors,
   a clear progress line per image, and an exit code that says whether everything worked.
   The storefront shows the photos everywhere it shows product images.
3. Do NOT run the full generation (the lead runs it after the gate); prove it with
   `npm run images -- --limit 2` at most. While an image is generated the language model you
   are talking to is unloaded and reloads afterwards — keep image calls in this session to the
   minimum.
4. `npm run build`, `npm run lint` and `npm test` pass; update docs/PROGRESS.md; commit
   "M6: …" and `git push`. Stop.

GATE REPORT FROM THE LEAD (fix these first if any):
{{GATE}}
