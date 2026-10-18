import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Shared AST text extraction (#58): the no-German-literals guard and the translation
// usage snapshot both walk every production file in `src/` and read its texts through
// the TypeScript AST — string literals, template heads and literal spans, and JSX
// texts. Comments and identifiers are not texts and are never scanned. Paths in the
// results are POSIX-relative to `src/`.

export const SRC = path.join(__dirname, "..");

export interface FoundText {
  file: string;
  line: number;
  text: string;
}

export function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return productionFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) return [];
    // The seed file's typed reader holds the migration lists (retired keys, repairs) —
    // migrations, not content (DECISIONS); translations.json is not a .ts file at all.
    if (entry === "translation-seed.ts") return [];
    return [full];
  });
}

export function textsOf(file: string): FoundText[] {
  const sourceText = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: FoundText[] = [];
  const record = (node: ts.Node, text: string) => {
    found.push({
      file: path.relative(SRC, file).split(path.sep).join("/"),
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      text,
    });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      record(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      record(node, node.head.text);
      for (const span of node.templateSpans) record(node, span.literal.text);
    } else if (ts.isJsxText(node)) {
      const trimmed = node.text.trim();
      if (trimmed) record(node, trimmed);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
