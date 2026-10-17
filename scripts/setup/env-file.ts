// Issue #38: pure helpers behind `npm run setup:lan` — decide which required env
// variables a `.env.local` still needs, without ever touching values already there.

export function parseEnvAssignments(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["'](.*)["']$/, "$1");
  }
  return values;
}

export interface EnvPlan {
  additions: { key: string; value: string }[];
  generated: string[];
}

export function planEnvFile(
  existing: Record<string, string | undefined>,
  required: readonly string[],
  generate: (key: string) => string,
): EnvPlan {
  const additions: EnvPlan["additions"] = [];
  const generated: string[] = [];
  for (const key of required) {
    const value = existing[key];
    if (value && value.trim().length > 0) continue;
    additions.push({ key, value: generate(key) });
    generated.push(key);
  }
  return { additions, generated };
}

export function renderAdditions(additions: EnvPlan["additions"]): string {
  if (additions.length === 0) return "";
  return "\n" + additions.map(({ key, value }) => `${key}=${value}`).join("\n") + "\n";
}
