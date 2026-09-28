import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * Resolve the OpenAPI spec on disk.
 *
 * Works both in dev (tsx, cwd = repo root) and in the built server
 * (dist/server/*.js, cwd = repo root after `npm run build:server`).
 * Returns null when the file is absent so callers can skip mounting docs.
 */
export function resolveOpenApiSpecPath(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Built server: dist/server/routes -> repo root docs/openapi.yaml
    path.resolve(here, "../../docs/openapi.yaml"),
    // Dev via tsx: server/routes (or server/*) -> repo root docs/openapi.yaml
    path.resolve(here, "../docs/openapi.yaml"),
    // Fallback when cwd is the repo root
    path.resolve(process.cwd(), "docs/openapi.yaml"),
    // Fallback when cwd is server/ or dist/server/
    path.resolve(process.cwd(), "../docs/openapi.yaml"),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Parse the OpenAPI YAML spec. Throws on missing/invalid file. */
export function loadOpenApiSpec(specPath?: string): Record<string, unknown> {
  const resolved = specPath ?? resolveOpenApiSpecPath();
  if (!resolved) {
    throw new Error("OpenAPI spec not found (looked for docs/openapi.yaml)");
  }
  const raw = readFileSync(resolved, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`OpenAPI spec at ${resolved} did not parse to an object`);
  }
  return parsed as Record<string, unknown>;
}
