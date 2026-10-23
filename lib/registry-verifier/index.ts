import { PYTHON_STDLIB_MODULES } from "./python-stdlib";

export { PYTHON_STDLIB_MODULES } from "./python-stdlib";

export type Ecosystem = "npm" | "pypi" | "python_stdlib";

export type VerifyPackageOptions = {
  ecosystem: Ecosystem;
  /** npm or PyPI package name, or a stdlib module such as "functools" or "os.path". */
  package: string;
  /** The function the suggestion relies on, e.g. "debounce" or "lru_cache". */
  functionName: string;
  /** Defaults to the global fetch. Pass your own for tests or proxies. */
  fetch?: typeof fetch;
  /** Per-request timeout. Defaults to 8000 ms. */
  timeoutMs?: number;
};

export type Verification = {
  ecosystem: Ecosystem;
  package: string;
  functionName: string;
  /** The package is in its registry, or the module is in the stdlib list. */
  exists: boolean;
  /** The function name appears in the README, description or docs page. */
  functionFound: boolean;
  /** Where the function name was found. */
  foundIn: "readme" | "description" | "docs" | null;
  /** exists and functionFound: only show the suggestion when this is true. */
  verified: boolean;
  docsUrl: string | null;
};

export type VerifyPackageResult = { ok: true; data: Verification } | { ok: false; reason: string };

const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const PYPI_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const MODULE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const FUNCTION_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/** True when `name` (its last dotted part) appears in `text` as a whole word. */
export function mentionsFunction(text: string, functionName: string): boolean {
  const last = functionName.split(".").pop() ?? functionName;
  const escaped = last.replace(/[$]/g, "\\$");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`).test(text);
}

async function getJson(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: true; status: number; body: unknown } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return { ok: true, status: 404, body: null };
    if (!res.ok) return { ok: false, reason: `${new URL(url).host} returned ${res.status}` };
    return { ok: true, status: res.status, body: (await res.json()) as unknown };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, reason: aborted ? `${new URL(url).host} timed out` : `Couldn't reach ${new URL(url).host}` };
  } finally {
    clearTimeout(timer);
  }
}

async function getText(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: true; status: number; text: string } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (res.status === 404) return { ok: true, status: 404, text: "" };
    if (!res.ok) return { ok: false, reason: `${new URL(url).host} returned ${res.status}` };
    return { ok: true, status: res.status, text: await res.text() };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, reason: aborted ? `${new URL(url).host} timed out` : `Couldn't reach ${new URL(url).host}` };
  } finally {
    clearTimeout(timer);
  }
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const httpUrl = (value: unknown): string | null => {
  const s = str(value);
  return /^https?:\/\//.test(s) ? s : null;
};

function found(
  base: Pick<Verification, "ecosystem" | "package" | "functionName">,
  exists: boolean,
  texts: { readme?: string; description?: string; docs?: string },
  docsUrl: string | null,
): Verification {
  const foundIn =
    !exists ? null
    : texts.readme && mentionsFunction(texts.readme, base.functionName) ? "readme"
    : texts.description && mentionsFunction(texts.description, base.functionName) ? "description"
    : texts.docs && mentionsFunction(texts.docs, base.functionName) ? "docs"
    : null;
  return { ...base, exists, functionFound: foundIn !== null, foundIn, verified: exists && foundIn !== null, docsUrl: exists ? docsUrl : null };
}

/**
 * Checks that a package suggested by an AI is real: it exists in npm or PyPI
 * (or the Python standard library), and the function it relies on appears in
 * the package's README, description or docs. Never throws. Network failures
 * return ok: false; a missing package returns ok: true with verified false.
 */
export async function verifyPackage(options: VerifyPackageOptions): Promise<VerifyPackageResult> {
  const fetchFn = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const name = options.package.trim();
  const functionName = options.functionName.trim();
  const base = { ecosystem: options.ecosystem, package: name, functionName };

  if (!FUNCTION_NAME.test(functionName)) return { ok: false, reason: "functionName must be an identifier like debounce or os.path.join" };

  if (options.ecosystem === "npm") {
    if (!NPM_NAME.test(name)) return { ok: false, reason: `"${name}" isn't a valid npm package name` };
    const res = await getJson(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, fetchFn, timeoutMs);
    if (!res.ok) return res;
    if (res.status === 404) return { ok: true, data: found(base, false, {}, null) };
    const doc = record(res.body);
    const latest = str(record(doc["dist-tags"]).latest);
    const latestVersion = record(record(doc.versions)[latest]);
    const readme = str(doc.readme) || str(latestVersion.readme);
    const description = str(doc.description) || str(latestVersion.description);
    const docsUrl = httpUrl(doc.homepage) ?? `https://www.npmjs.com/package/${name}`;
    return { ok: true, data: found(base, true, { readme, description }, docsUrl) };
  }

  if (options.ecosystem === "pypi") {
    if (!PYPI_NAME.test(name)) return { ok: false, reason: `"${name}" isn't a valid PyPI package name` };
    const res = await getJson(`https://pypi.org/pypi/${name}/json`, fetchFn, timeoutMs);
    if (!res.ok) return res;
    if (res.status === 404) return { ok: true, data: found(base, false, {}, null) };
    const info = record(record(res.body).info);
    const urls = record(info.project_urls);
    const docsUrl =
      httpUrl(urls.Documentation) ?? httpUrl(info.docs_url) ?? httpUrl(urls.Homepage) ?? httpUrl(info.home_page) ?? `https://pypi.org/project/${name}/`;
    return { ok: true, data: found(base, true, { readme: str(info.description), description: str(info.summary) }, docsUrl) };
  }

  if (!MODULE_NAME.test(name)) return { ok: false, reason: `"${name}" isn't a valid Python module name` };
  const topLevel = name.split(".")[0] ?? name;
  if (!PYTHON_STDLIB_MODULES.has(topLevel)) return { ok: true, data: found(base, false, {}, null) };
  const docsUrl = `https://docs.python.org/3/library/${name}.html`;
  const page = await getText(docsUrl, fetchFn, timeoutMs);
  if (!page.ok) return page;
  // Some submodules share their parent's page.
  if (page.status === 404 && topLevel !== name) {
    const parentUrl = `https://docs.python.org/3/library/${topLevel}.html`;
    const parent = await getText(parentUrl, fetchFn, timeoutMs);
    if (!parent.ok) return parent;
    return { ok: true, data: found(base, true, { docs: parent.text }, parentUrl) };
  }
  return { ok: true, data: found(base, true, { docs: page.text }, docsUrl) };
}
