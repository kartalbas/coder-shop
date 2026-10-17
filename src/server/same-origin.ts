// CSRF guard for state-changing API routes: a cross-site form/fetch either carries a
// foreign `Origin` or none at all — both are refused. Extracted from the label route so
// the decision itself is unit-tested (issue #33).
export function isSameOrigin(originHeader: string | null, requestUrl: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).host === new URL(requestUrl).host;
  } catch {
    return false;
  }
}
