# Package Registry Verifier for npm and PyPI

## Description

Stops AI from recommending packages that don't exist. Checks npm, PyPI or the Python standard library, confirms the function appears in the package docs, and returns the docs link.

## Skills

TypeScript, Node.js, Python

## Custom tags

npm, PyPI, LLM, hallucination, package registry, verification

## What it does

- Guards LLM suggestions against package hallucinations.
- Validates packages against npm (including scoped modules), PyPI, and an offline static catalog of the Python standard library.
- Scans package READMEs and summaries to verify that the suggested function or method genuinely exists.
- Extracts authoritative documentation and project homepage links.
- Zero dependencies; uses native Node 18+ `fetch` with configurable timeouts.

## Public API

```ts
export type Ecosystem = "npm" | "pypi" | "python_stdlib";

export type VerifyPackageOptions = {
  ecosystem: Ecosystem;
  package: string;
  functionName: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export type VerifyPackageResult = {
  exists: boolean;
  mentionedInDocs: boolean;
  docsUrl: string | null;
  description?: string;
  reason?: string;
};

export function verifyPackage(options: VerifyPackageOptions): Promise<VerifyPackageResult>;
```

## Install

No external dependencies needed. Copy `lib/registry-verifier/` into your project.

---

GIG READY: Package Registry Verifier
Publish at Devmarketplace → Add your Gigs

1. Thumbnail
   Upload docs/gigs/thumbnails/package-registry-verifier.png

2. Basic Info
   Title (42/50): Package Registry Verifier for npm and PyPI
   Description (180/200): Stops AI from recommending packages that don't exist. Checks npm, PyPI or the Python standard library, confirms the function appears in the package docs, and returns the docs link.

3. Tech Stack
   Skills (pick the closest ones in the list): TypeScript, Node.js, Python
   Custom tags (6/10, press Enter after each): npm, PyPI, LLM, hallucination, package registry, verification

4. Code Snippet
   Language: TypeScript
   From: lib/registry-verifier/index.ts, lines 34 to 69

```ts
export async function verifyPackage(
  options: VerifyPackageOptions,
): Promise<VerifyPackageResult> {
  const pkg = options.package.trim();
  const fn = options.functionName.trim();
  const fetcher = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  if (!pkg) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: "Package name is empty.",
    };
  }

  try {
    switch (options.ecosystem) {
      case "python_stdlib":
        return verifyPythonStdlib(pkg, fn, fetcher, timeoutMs);
      case "npm":
        return await verifyNpm(pkg, fn, fetcher, timeoutMs);
      case "pypi":
        return await verifyPyPi(pkg, fn, fetcher, timeoutMs);
      default:
        return {
          exists: false,
          mentionedInDocs: false,
          docsUrl: null,
          reason: `Unsupported ecosystem: ${String(options.ecosystem)}`,
        };
    }
  } catch (err) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `Verification request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

5. Read ME
   Open lib/registry-verifier/README.md on GitHub, copy the rendered page and paste it into the editor.

6. After you click Create
   Add the gig link to the tracker in docs/GIGS.md and to the Devpost draft.
