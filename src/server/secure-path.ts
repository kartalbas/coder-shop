import path from "node:path";

// Resolves `candidate` and returns it only if it stays strictly inside `baseDir` —
// traversal (`..`), escapes to absolute paths and the directory itself are refused.
// Used for label file downloads (issue #33); returns null on refusal.
export function resolveInsideDir(baseDir: string, candidate: string): string | null {
  const base = path.resolve(baseDir);
  const file = path.resolve(candidate);
  const relative = path.relative(base, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return file;
}
