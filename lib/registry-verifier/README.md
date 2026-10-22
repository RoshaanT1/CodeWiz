# Package Registry Verifier

Stops AI and LLMs from hallucinating packages and functions that don't exist. Checks npm, PyPI, or the Python standard library, confirms that the recommended function appears in the package's documentation or README, and returns the verified documentation URL.

## What it does

- Verifies that packages suggested by AI models actually exist in:
  - **npm** (via official npm registry API, including scoped packages)
  - **PyPI** (via PyPI JSON API)
  - **Python standard library** (via offline static catalog of `sys.stdlib_module_names`)
- Inspects the package's README, summary, or official documentation to confirm that the suggested function or utility is actually mentioned.
- Resolves official documentation and homepage URLs directly from package metadata.
- Completely self-contained with zero external dependencies (uses standard native `fetch`).
- Never throws exceptions; returns a clean `{ exists, mentionedInDocs, docsUrl }` result.

## Install

Copy `lib/registry-verifier/` into your TypeScript or JavaScript project. Zero third-party dependencies required!

## Usage Example

```ts
import { verifyPackage } from "./lib/registry-verifier";

// 1. Verify a real package and utility
const lodashCheck = await verifyPackage({
  ecosystem: "npm",
  package: "lodash",
  functionName: "debounce",
});

console.log(lodashCheck);
// => { exists: true, mentionedInDocs: true, docsUrl: "https://lodash.com/" }

// 2. Reject an AI hallucination
const fakeCheck = await verifyPackage({
  ecosystem: "npm",
  package: "react-auto-magic-optimizer-xyz",
  functionName: "optimize",
});

console.log(fakeCheck);
// => { exists: false, mentionedInDocs: false, docsUrl: null, reason: "Package '...' not found on npm." }

// 3. Verify Python standard library
const pyCheck = await verifyPackage({
  ecosystem: "python_stdlib",
  package: "collections",
  functionName: "defaultdict",
});

console.log(pyCheck);
// => { exists: true, mentionedInDocs: true, docsUrl: "https://docs.python.org/3/library/collections.html" }
```

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

## Options and Limits

- **`timeoutMs`**: Maximum time to wait for registry responses (default 8000ms).
- **`fetchFn`**: Custom fetch implementation for mocking or proxying requests.
- **Python standard library**: Instantly verified against an offline static set of 200+ modules from `sys.stdlib_module_names`.

## Dependencies

None. Zero third-party runtime dependencies.

## Contributors

- Roshaan Tahir
- M Hammad Khan
- Fizzah Abdullah
- Hammad Khan
