import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

const listsResponse = [
  {
    id: 1,
    name: "Presidential Range",
    type: "peakbagging",
    description: "A test hiking list",
    abbreviation: "PR",
    patchAvailable: false,
    totalCount: 10,
    completedCount: 0,
    completions: {},
  },
];

export const fetchMock = vi.fn(
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    if (String(input).endsWith("/api/lists")) {
      return new Response(JSON.stringify(listsResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (String(input).endsWith("/api/auth/refresh")) {
      return new Response(JSON.stringify({ error: "No refresh session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not mocked" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
);

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockClear();
  if (typeof sessionStorage?.clear === "function") sessionStorage.clear();
  if (typeof localStorage?.clear === "function") localStorage.clear();
});
