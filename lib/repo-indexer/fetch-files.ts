// Downloads the text of a few repo files from the GitHub REST API.
// Static reading only: file contents are never run.
// Portable: the token and limits are parameters; nothing is imported from the app.

export type FetchFilesOptions = {
  owner: string;
  repo: string;
  /** Branch, tag or commit to read from. */
  ref: string;
  paths: readonly string[];
  token: string;
  /** Parallel GitHub requests. Defaults to 8. */
  concurrency?: number;
  /** Files larger than this are skipped. Defaults to 200 KB. */
  maxFileBytes?: number;
  signal?: AbortSignal;
};

export type FetchedFile = { path: string; source: string };
export type SkippedFile = { path: string; reason: string };

export type FetchFilesResult = {
  files: FetchedFile[];
  skipped: SkippedFile[];
  /** Set when GitHub's rate limit stopped the download early. */
  rateLimited: boolean;
};

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_MAX_BYTES = 200 * 1024;

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

type One =
  | { kind: "file"; file: FetchedFile }
  | { kind: "skip"; skip: SkippedFile }
  | { kind: "rate" };

async function fetchOne(
  options: FetchFilesOptions,
  path: string,
  maxBytes: number,
): Promise<One> {
  const url =
    `https://api.github.com/repos/${encodeURIComponent(options.owner)}/` +
    `${encodeURIComponent(options.repo)}/contents/${encodePath(path)}` +
    `?ref=${encodeURIComponent(options.ref)}`;
  const init: RequestInit = {
    headers: {
      Accept: "application/vnd.github.raw+json",
      Authorization: `Bearer ${options.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "codewiz-repo-indexer",
    },
    cache: "no-store",
    signal: options.signal,
  };

  // One retry on a network failure or a 5xx answer.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
        return { kind: "rate" };
      }
      if (res.status >= 500 && attempt === 0) continue;
      if (!res.ok) {
        return { kind: "skip", skip: { path, reason: `GitHub answered ${res.status}` } };
      }
      // Check Content-Length header early if available.
      const cl = res.headers.get("content-length");
      if (cl && Number(cl) > maxBytes) {
        return { kind: "skip", skip: { path, reason: "File is too large" } };
      }

      if (!res.body) {
        return { kind: "skip", skip: { path, reason: "Empty response body" } };
      }

      // Read stream with early abort if bytes exceed maxBytes.
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let tooLarge = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            tooLarge = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }

      if (tooLarge) {
        return { kind: "skip", skip: { path, reason: "File is too large" } };
      }

      const merged = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return { kind: "file", file: { path, source: new TextDecoder().decode(merged) } };
    } catch {
      if (attempt === 1 || options.signal?.aborted) {
        return { kind: "skip", skip: { path, reason: "Couldn't reach GitHub" } };
      }
    }
  }
  return { kind: "skip", skip: { path, reason: "Couldn't reach GitHub" } };
}

export async function fetchFiles(
  options: FetchFilesOptions,
): Promise<FetchFilesResult> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const maxBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;
  const results: (One | undefined)[] = new Array(options.paths.length);
  let next = 0;
  let stop = false;

  async function worker(): Promise<void> {
    while (!stop) {
      const index = next;
      next += 1;
      if (index >= options.paths.length) return;
      const result = await fetchOne(options, options.paths[index], maxBytes);
      results[index] = result;
      if (result.kind === "rate") stop = true;
    }
  }

  const workers = Math.min(concurrency, options.paths.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  const files: FetchedFile[] = [];
  const skipped: SkippedFile[] = [];
  let rateLimited = false;
  results.forEach((result, i) => {
    if (!result) skipped.push({ path: options.paths[i], reason: "Not fetched" });
    else if (result.kind === "file") files.push(result.file);
    else if (result.kind === "skip") skipped.push(result.skip);
    else rateLimited = true;
  });
  return { files, skipped, rateLimited };
}
