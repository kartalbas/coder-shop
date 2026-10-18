// Issue #58 editor slice: a translation key's preview is a fact about routes, held in
// the checked-in table `src/server/translation-previews.json` (namespace prefix →
// route template) — never hard-coded here. The longest matching namespace wins; an
// `admin.*` key without a table entry previews at its own nav page when the second
// segment matches an existing admin nav href (the nav set stays the single source);
// anything else has no page and therefore no preview. `{slug}` and `{number}` in a
// template are filled from samples resolved at request time — no sample, no link.

export type PreviewTable = Record<string, string>;

export interface PreviewSamples {
  slug?: string;
  number?: string;
}

// The route template behind a key (no samples needed) — the caller resolves the
// samples a template asks for before filling it with `previewPathFor`.
export function previewTemplateFor(
  key: string,
  table: PreviewTable,
  adminHrefs: readonly string[],
): string | null {
  let namespace: string | null = null;
  for (const candidate of Object.keys(table)) {
    if ((key === candidate || key.startsWith(`${candidate}.`)) && (namespace === null || candidate.length > namespace.length)) {
      namespace = candidate;
    }
  }
  return namespace !== null ? table[namespace] : (adminNavPath(key, adminHrefs) ?? null);
}

export function previewPathFor(
  key: string,
  table: PreviewTable,
  samples: PreviewSamples,
  adminHrefs: readonly string[],
): string | null {
  const template = previewTemplateFor(key, table, adminHrefs);
  return template === null ? null : fillTemplate(template, samples);
}

function adminNavPath(key: string, adminHrefs: readonly string[]): string | undefined {
  if (!key.startsWith("admin.")) return undefined;
  const segment = key.split(".")[1];
  if (!segment) return undefined;
  const href = `/admin/${segment}`;
  return adminHrefs.includes(href) ? href : undefined;
}

function fillTemplate(template: string, samples: PreviewSamples): string | null {
  let path = template;
  if (path.includes("{slug}")) {
    if (!samples.slug) return null;
    path = path.replaceAll("{slug}", samples.slug);
  }
  if (path.includes("{number}")) {
    if (!samples.number) return null;
    path = path.replaceAll("{number}", samples.number);
  }
  return path;
}
