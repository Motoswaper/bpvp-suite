import { existsSync } from "fs";
import path from "path";

function hasOperationsMarker(dir: string): boolean {
  return existsSync(path.join(dir, "operations.md"));
}

/**
 * Markdown lives at repo `docs/` (sibling of `dashboard/`).
 * Prefer `BPVP_DOCS_DIR` from `./scripts/start-suite.sh`.
 * Also walks up from process.cwd() looking for a `docs/` folder containing `operations.md`.
 */
export function resolveRepoDocsDir(): string {
  const env = process.env.BPVP_DOCS_DIR?.trim();
  if (env && hasOperationsMarker(env)) {
    return path.resolve(env);
  }

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "docs");
    if (hasOperationsMarker(candidate)) {
      return path.resolve(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const cwd = process.cwd();
  const flat = [path.join(cwd, "..", "docs"), path.join(cwd, "docs"), path.join(cwd, "..", "..", "docs")];
  for (const candidate of flat) {
    if (hasOperationsMarker(candidate)) {
      return path.resolve(candidate);
    }
  }

  if (env) return path.resolve(env);
  return path.resolve(cwd, "..", "docs");
}
