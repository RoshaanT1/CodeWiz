import { describe, expect, it } from "vitest";

import { mentionsFunction, verifyPackage } from "./index";

/** A fake fetch that serves fixed responses by URL. Unknown URLs are 404. */
function fakeFetch(routes: Record<string, { status?: number; json?: unknown; text?: string }>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    const body = route.json !== undefined ? JSON.stringify(route.json) : (route.text ?? "");
    return new Response(body, { status: route.status ?? 200 });
  }) as typeof fetch;
}

const LODASH = {
  "dist-tags": { latest: "4.17.21" },
  description: "Lodash modular utilities.",
  readme: "## Usage\n\n_.debounce(func, [wait=0])\n_.throttle(func)",
  homepage: "https://lodash.com/",
};

describe("verifyPackage", () => {
  it("verifies a real npm package whose README mentions the function", async () => {
    const result = await verifyPackage({
      ecosystem: "npm",
      package: "lodash",
      functionName: "debounce",
      fetch: fakeFetch({ "https://registry.npmjs.org/lodash": { json: LODASH } }),
    });
    expect(result).toEqual({
      ok: true,
      data: {
        ecosystem: "npm",
        package: "lodash",
        functionName: "debounce",
        exists: true,
        functionFound: true,
        foundIn: "readme",
        verified: true,
        docsUrl: "https://lodash.com/",
      },
    });
  });

  it("rejects a made-up npm package", async () => {
    const result = await verifyPackage({ ecosystem: "npm", package: "super-debounce-ai-xyz", functionName: "debounce", fetch: fakeFetch({}) });
    expect(result).toMatchObject({ ok: true, data: { exists: false, verified: false, docsUrl: null } });
  });

  it("rejects a real package that doesn't mention the function", async () => {
    const result = await verifyPackage({
      ecosystem: "npm",
      package: "lodash",
      functionName: "smartRetry",
      fetch: fakeFetch({ "https://registry.npmjs.org/lodash": { json: LODASH } }),
    });
    expect(result).toMatchObject({ ok: true, data: { exists: true, functionFound: false, verified: false } });
  });

  it("encodes scoped npm names", async () => {
    const result = await verifyPackage({
      ecosystem: "npm",
      package: "@scope/pkg",
      functionName: "run",
      fetch: fakeFetch({ "https://registry.npmjs.org/@scope%2Fpkg": { json: { description: "Call run() to start." } } }),
    });
    expect(result).toMatchObject({ ok: true, data: { verified: true, foundIn: "description", docsUrl: "https://www.npmjs.com/package/@scope/pkg" } });
  });

  it("verifies PyPI packages and prefers the Documentation link", async () => {
    const result = await verifyPackage({
      ecosystem: "pypi",
      package: "tenacity",
      functionName: "retry",
      fetch: fakeFetch({
        "https://pypi.org/pypi/tenacity/json": {
          json: {
            info: {
              summary: "Retry code until it succeeds",
              description: "Use the @retry decorator.",
              project_urls: { Documentation: "https://tenacity.readthedocs.io/" },
            },
          },
        },
      }),
    });
    expect(result).toMatchObject({ ok: true, data: { verified: true, foundIn: "readme", docsUrl: "https://tenacity.readthedocs.io/" } });
  });

  it("checks stdlib modules against the list and their docs page", async () => {
    const fetchFn = fakeFetch({
      "https://docs.python.org/3/library/functools.html": { text: "<dt id=\"functools.lru_cache\">@functools.lru_cache</dt>" },
    });
    expect(await verifyPackage({ ecosystem: "python_stdlib", package: "functools", functionName: "lru_cache", fetch: fetchFn })).toMatchObject({
      ok: true,
      data: { verified: true, foundIn: "docs", docsUrl: "https://docs.python.org/3/library/functools.html" },
    });
    expect(await verifyPackage({ ecosystem: "python_stdlib", package: "fancytools", functionName: "memo", fetch: fetchFn })).toMatchObject({
      ok: true,
      data: { exists: false, verified: false },
    });
  });

  it("returns ok: false on network errors and bad names instead of throwing", async () => {
    const failing = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;
    expect(await verifyPackage({ ecosystem: "pypi", package: "requests", functionName: "get", fetch: failing })).toEqual({
      ok: false,
      reason: "Couldn't reach pypi.org",
    });
    expect(await verifyPackage({ ecosystem: "npm", package: "../etc", functionName: "x", fetch: failing })).toMatchObject({ ok: false });
    expect(await verifyPackage({ ecosystem: "npm", package: "lodash", functionName: "a b", fetch: failing })).toMatchObject({ ok: false });
  });
});

describe("mentionsFunction", () => {
  it("matches whole words only, using the last dotted part", () => {
    expect(mentionsFunction("use _.debounce(fn)", "lodash.debounce")).toBe(true);
    expect(mentionsFunction("debounced values", "debounce")).toBe(false);
  });
});
