// Reads a public repo's default-branch file tree from the GitHub REST API.
// Static listing only: it never downloads or runs file contents.
// Portable: the token is a parameter; nothing is imported from the app.

import type { TreeEntry } from "./file-tree";

export type FetchTreeOptions = {
  owner: string;
  repo: string;
  token: string;
  signal?: AbortSignal;
};

export type FetchTreeResult =
  | {
      ok: true;
      data: { defaultBranch: string; truncated: boolean; entries: TreeEntry[] };
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "RATE_LIMITED" | "GITHUB_AUTH" | "UPSTREAM";
      reason: string;
    };

type Failure = Extract<FetchTreeResult, { ok: false }>;

const API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "codewiz-repo-indexer",
  };
}

async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  if (res.status !== 403) return false;
  if (res.headers.get("x-ratelimit-remaining") === "0") return true;
  try {
    const body: unknown = await res.clone().json();
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : "";
    return /rate limit|abuse/i.test(message);
  } catch {
    return false;
  }
}

async function failureFor(res: Response): Promise<Failure> {
  if (await isRateLimited(res)) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      reason: "GitHub rate limit reached.",
    };
  }
  if (res.status === 404) {
    return { ok: false, code: "NOT_FOUND", reason: "Repo not found or private." };
  }
  if (res.status === 401) {
    return {
      ok: false,
      code: "GITHUB_AUTH",
      reason: "GitHub rejected the server token.",
    };
  }
  return {
    ok: false,
    code: "UPSTREAM",
    reason: `GitHub returned an unexpected response (${res.status}).`,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fetchDefaultBranchTree(
  options: FetchTreeOptions,
): Promise<FetchTreeResult> {
  const { owner, repo, token, signal } = options;
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const init: RequestInit = { headers: headers(token), cache: "no-store", signal };

  try {
    const repoRes = await fetch(base, init);
    if (!repoRes.ok) return await failureFor(repoRes);
    const repoBody: unknown = await repoRes.json();
    const defaultBranch =
      isObject(repoBody) && typeof repoBody.default_branch === "string"
        ? repoBody.default_branch
        : null;
    if (!defaultBranch) {
      return { ok: false, code: "UPSTREAM", reason: "GitHub sent no default branch." };
    }

    // HEAD resolves to the default branch, and avoids slash-in-name problems.
    const treeRes = await fetch(`${base}/git/trees/HEAD?recursive=1`, init);
    if (treeRes.status === 409) {
      // GitHub answers 409 for a repo with no commits.
      return { ok: true, data: { defaultBranch, truncated: false, entries: [] } };
    }
    if (!treeRes.ok) return await failureFor(treeRes);

    const treeBody: unknown = await treeRes.json();
    if (!isObject(treeBody) || !Array.isArray(treeBody.tree)) {
      return { ok: false, code: "UPSTREAM", reason: "GitHub sent an unreadable tree." };
    }
    const entries: TreeEntry[] = [];
    for (const item of treeBody.tree as unknown[]) {
      if (isObject(item) && typeof item.path === "string" && typeof item.type === "string") {
        entries.push({
          path: item.path,
          type: item.type,
          mode: typeof item.mode === "string" ? item.mode : undefined,
          size: typeof item.size === "number" ? item.size : undefined,
        });
      }
    }
    return {
      ok: true,
      data: { defaultBranch, truncated: treeBody.truncated === true, entries },
    };
  } catch {
    return {
      ok: false,
      code: "UPSTREAM",
      reason: "Couldn't reach GitHub. Try again in a moment.",
    };
  }
}
