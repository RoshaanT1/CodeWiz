import { PYTHON_STDLIB_MODULES } from "./python-stdlib";

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

/**
 * Checks whether a package exists in npm, PyPI, or the Python standard library,
 * and verifies that the suggested function or method name is mentioned in its
 * documentation, README, or description.
 *
 * Prevents AI hallucinations from recommending non-existent libraries or fake functions.
 */
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

async function verifyPythonStdlib(
  pkg: string,
  functionName: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<VerifyPackageResult> {
  const normalizedModule = pkg.toLowerCase();
  const exists = PYTHON_STDLIB_MODULES.has(normalizedModule);

  if (!exists) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `'${pkg}' is not a Python standard library module.`,
    };
  }

  const docsUrl = `https://docs.python.org/3/library/${encodeURIComponent(normalizedModule)}.html`;

  if (!functionName) {
    return { exists: true, mentionedInDocs: true, docsUrl };
  }

  // Attempt to check if function is mentioned on the official docs page
  let mentionedInDocs = false;
  try {
    const res = await fetcher(docsUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "CodeWiz-Package-Verifier/1.0" },
    });

    if (res.ok) {
      const text = await res.text();
      mentionedInDocs = containsIdentifier(text, functionName);
    }
  } catch {
    // If external fetch fails, fallback to accepting module existence
    mentionedInDocs = false;
  }

  return {
    exists: true,
    mentionedInDocs,
    docsUrl,
  };
}

async function verifyNpm(
  pkg: string,
  functionName: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<VerifyPackageResult> {
  // Scoped packages like @types/node require URL encoding of the slash: @scope%2Fpkg
  const encodedName = pkg.startsWith("@")
    ? `@${encodeURIComponent(pkg.slice(1).split("/")[0])}%2F${encodeURIComponent(pkg.split("/")[1] || "")}`
    : encodeURIComponent(pkg);

  const registryUrl = `https://registry.npmjs.org/${encodedName}`;

  const res = await fetcher(registryUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "CodeWiz-Package-Verifier/1.0",
    },
  });

  if (res.status === 404) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `Package '${pkg}' not found on npm.`,
    };
  }

  if (!res.ok) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `npm registry returned status ${res.status}.`,
    };
  }

  const data = (await res.json()) as {
    description?: string;
    readme?: string;
    homepage?: string;
  };

  const docsUrl = data.homepage || `https://www.npmjs.com/package/${pkg}`;
  const corpus = `${data.description ?? ""} ${data.readme ?? ""}`;
  const mentionedInDocs = functionName ? containsIdentifier(corpus, functionName) : true;

  return {
    exists: true,
    mentionedInDocs,
    docsUrl,
    description: data.description,
  };
}

async function verifyPyPi(
  pkg: string,
  functionName: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<VerifyPackageResult> {
  const pypiUrl = `https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`;

  const res = await fetcher(pypiUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      "User-Agent": "CodeWiz-Package-Verifier/1.0",
    },
  });

  if (res.status === 404) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `Package '${pkg}' not found on PyPI.`,
    };
  }

  if (!res.ok) {
    return {
      exists: false,
      mentionedInDocs: false,
      docsUrl: null,
      reason: `PyPI returned status ${res.status}.`,
    };
  }

  const data = (await res.json()) as {
    info?: {
      summary?: string;
      description?: string;
      project_urls?: Record<string, string>;
      package_url?: string;
      home_page?: string;
    };
  };

  const info = data.info ?? {};
  const docsUrl =
    info.project_urls?.Documentation ||
    info.project_urls?.Homepage ||
    info.home_page ||
    info.package_url ||
    `https://pypi.org/project/${pkg}/`;

  const corpus = `${info.summary ?? ""} ${info.description ?? ""}`;
  const mentionedInDocs = functionName ? containsIdentifier(corpus, functionName) : true;

  return {
    exists: true,
    mentionedInDocs,
    docsUrl,
    description: info.summary,
  };
}

function containsIdentifier(corpus: string, identifier: string): boolean {
  if (!identifier) return true;
  // Case-insensitive boundary match for the identifier name
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9_$])${escaped}(?:$|[^a-zA-Z0-9_$])`, "i");
  return regex.test(corpus);
}

export { PYTHON_STDLIB_MODULES };
