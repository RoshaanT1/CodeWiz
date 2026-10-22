# Package Registry Verifier

Stops AI from recommending packages that don't exist. Give it an ecosystem, a package name and the function a suggestion relies on. It checks that:

- **The package is real:** it's in the npm registry or on PyPI, or the module is in the Python standard library (a static list generated from `sys.stdlib_module_names`).
- **The function is documented:** its name appears, as a whole word, in the package's README or description, or on the module's page on docs.python.org.

It returns a docs link from the registry, not one written by the model. Only show a suggestion when `verified` is true.

No API keys. It never runs or installs anything, it only reads public registry metadata. It never throws.

## Install

Copy the `registry-verifier` folder into your project. It has no dependencies and uses the global `fetch` (Node 18 or later, or any browser).

## Usage

```ts
import { verifyPackage } from "./registry-verifier";

// A real package whose README documents the function
const real = await verifyPackage({ ecosystem: "npm", package: "debounce", functionName: "debounce" });

// A package the model made up
const fake = await verifyPackage({ ecosystem: "npm", package: "super-debounce-ai", functionName: "debounce" });

// A Python standard library module
const stdlib = await verifyPackage({ ecosystem: "python_stdlib", package: "functools", functionName: "lru_cache" });

for (const result of [real, fake, stdlib]) {
  if (!result.ok) {
    console.error(result.reason); // network error or invalid name: try again later
  } else if (result.data.verified) {
    console.log(`Use ${result.data.package}.${result.data.functionName}: ${result.data.docsUrl}`);
  } else {
    console.log(`Dropped ${result.data.package}: exists=${result.data.exists}, documented=${result.data.functionFound}`);
  }
}
```

## Options

| Option | Type | Notes |
|---|---|---|
| `ecosystem` | `"npm" \| "pypi" \| "python_stdlib"` | Which registry to check |
| `package` | `string` | npm name (scoped names work), PyPI name, or a module such as `os.path` |
| `functionName` | `string` | For example `debounce` or `os.path.join`. The last dotted part is searched for |
| `fetch` | `typeof fetch` | Optional. Pass a fake for tests, or a proxied fetch |
| `timeoutMs` | `number` | Per request. Defaults to 8000 |

**Result:** `{ ok: true, data }` with `exists`, `functionFound`, `foundIn` (`"readme"`, `"description"`, `"docs"` or `null`), `verified` and `docsUrl`. A missing package is `ok: true` with `exists: false`. `ok: false` only means the check couldn't run (network error, timeout or an invalid name).

## Limits

- Matching is by name. A package that documents the function only on an external site (lodash's main package, for example) isn't verified. Its focused package (`lodash.debounce`) is.
- The stdlib list is from Python 3.11. Regenerate it with `python3 -c "import sys; print(sorted(sys.stdlib_module_names))"`.
- Names are validated before any request, so a model can't steer the URL.

## Tests

`index.test.ts` uses a fake `fetch`, so it needs no network:

```bash
npx vitest run lib/registry-verifier
```

## Dependencies

None at runtime. Tests use [vitest](https://github.com/vitest-dev/vitest) (MIT). Data comes from the public [npm registry](https://registry.npmjs.org), the [PyPI JSON API](https://pypi.org/pypi) and [docs.python.org](https://docs.python.org/3/library/).

## Contributors

Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan
