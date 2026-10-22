import { describe, expect, it } from "vitest";
import { verifyPackage } from "./index";

describe("verifyPackage (Gig 5: Package Registry Verifier)", () => {
  it("verifies real npm package and detects function presence", async () => {
    const mockFetch: typeof fetch = async (url) => {
      if (String(url).includes("lodash")) {
        return new Response(
          JSON.stringify({
            description: "Lodash modular utilities.",
            readme: "The Lodash library exported as Node.js modules. Features debounce, throttle, etc.",
            homepage: "https://lodash.com/",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    };

    const success = await verifyPackage({
      ecosystem: "npm",
      package: "lodash",
      functionName: "debounce",
      fetchFn: mockFetch,
    });

    expect(success.exists).toBe(true);
    expect(success.mentionedInDocs).toBe(true);
    expect(success.docsUrl).toBe("https://lodash.com/");

    // Function not in readme
    const missingFn = await verifyPackage({
      ecosystem: "npm",
      package: "lodash",
      functionName: "nonExistentHelperXYZ",
      fetchFn: mockFetch,
    });

    expect(missingFn.exists).toBe(true);
    expect(missingFn.mentionedInDocs).toBe(false);
  });

  it("rejects non-existent npm package", async () => {
    const mockFetch: typeof fetch = async () => new Response(null, { status: 404 });

    const res = await verifyPackage({
      ecosystem: "npm",
      package: "fake-made-up-package-12345",
      functionName: "debounce",
      fetchFn: mockFetch,
    });

    expect(res.exists).toBe(false);
    expect(res.mentionedInDocs).toBe(false);
    expect(res.reason).toContain("not found on npm");
  });

  it("verifies real PyPI package and rejects fake ones", async () => {
    const mockFetch: typeof fetch = async (url) => {
      if (String(url).includes("requests")) {
        return new Response(
          JSON.stringify({
            info: {
              summary: "Python HTTP for Humans.",
              description: "Provides requests.get and requests.post methods.",
              project_urls: { Documentation: "https://requests.readthedocs.io" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(null, { status: 404 });
    };

    const res = await verifyPackage({
      ecosystem: "pypi",
      package: "requests",
      functionName: "get",
      fetchFn: mockFetch,
    });

    expect(res.exists).toBe(true);
    expect(res.mentionedInDocs).toBe(true);
    expect(res.docsUrl).toBe("https://requests.readthedocs.io");

    const fake = await verifyPackage({
      ecosystem: "pypi",
      package: "nonexistent-fake-pypi-lib-999",
      functionName: "get",
      fetchFn: mockFetch,
    });

    expect(fake.exists).toBe(false);
    expect(fake.mentionedInDocs).toBe(false);
  });

  it("verifies Python standard library module from static catalogue", async () => {
    const mockFetch: typeof fetch = async (url) => {
      if (String(url).includes("collections")) {
        return new Response("<html><body>defaultdict and deque objects</body></html>", {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    };

    const res = await verifyPackage({
      ecosystem: "python_stdlib",
      package: "collections",
      functionName: "defaultdict",
      fetchFn: mockFetch,
    });

    expect(res.exists).toBe(true);
    expect(res.mentionedInDocs).toBe(true);
    expect(res.docsUrl).toBe("https://docs.python.org/3/library/collections.html");

    const fakeStdlib = await verifyPackage({
      ecosystem: "python_stdlib",
      package: "expressjs",
      functionName: "Router",
    });

    expect(fakeStdlib.exists).toBe(false);
    expect(fakeStdlib.reason).toContain("not a Python standard library module");
  });
});
