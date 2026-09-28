import { describe, expect, it } from "vitest";
import { loadOpenApiSpec, resolveOpenApiSpecPath } from "../routes/openapi.js";

describe("openapi spec", () => {
  it("resolves docs/openapi.yaml from the repo", () => {
    expect(resolveOpenApiSpecPath()).toMatch(/docs\/openapi\.yaml$/);
  });

  it("parses to an OpenAPI 3.x document with paths", () => {
    const spec = loadOpenApiSpec() as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    expect(spec.paths["/health"]).toBeDefined();
    expect(spec.paths["/api/auth/login"]).toBeDefined();
  });

  it("throws a clear error for a missing spec file", () => {
    expect(() => loadOpenApiSpec("/does/not/exist.yaml")).toThrow();
  });
});
