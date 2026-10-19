// Parses a GitHub repo reference typed by a user.
// Pure and portable: no imports from the app, Next.js, React or Supabase.

export type ParsedRepoUrl = {
  owner: string;
  repo: string;
  /** Branch from a /tree/<branch>/... link, if any. Only the first segment. */
  branch: string | null;
  /** Path after the branch in a /tree/ link, if any. */
  path: string | null;
};

export type ParseRepoUrlResult =
  | { ok: true; data: ParsedRepoUrl }
  | { ok: false; reason: string };

const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

const INVALID =
  "That doesn't look like a GitHub repo. Use owner/repo or a github.com link.";

function fail(reason = INVALID): ParseRepoUrlResult {
  return { ok: false, reason };
}

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Accepts:
 *  - `owner/repo`, `owner/repo.git`, `owner/repo/`
 *  - `https://github.com/owner/repo` (also `www.`, `http://`, no scheme)
 *  - `git@github.com:owner/repo.git`
 *  - `https://github.com/owner/repo/tree/<branch>/<path>`
 * Query strings and fragments are ignored.
 */
export function parseRepoUrl(input: string): ParseRepoUrlResult {
  let rest = input.trim();
  if (!rest) return fail("Enter a GitHub repo URL.");

  const ssh = /^git@github\.com:(.+)$/i.exec(rest);
  if (ssh) {
    rest = ssh[1];
  } else {
    const web = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.*)$/i.exec(rest);
    if (web) rest = web[1];
  }

  rest = rest.split(/[?#]/)[0];
  const segments = rest.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return fail();

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");

  if (!OWNER_RE.test(owner)) return fail();
  if (!REPO_RE.test(repo) || repo === "." || repo === "..") return fail();

  if (segments.length === 2) {
    return { ok: true, data: { owner, repo, branch: null, path: null } };
  }

  // Anything beyond owner/repo must be a /tree/<branch>[/<path>] link.
  if (segments[2] !== "tree" || segments.length < 4) {
    return fail(
      "Use a link to the repo itself, like github.com/owner/repo, or a /tree/branch link.",
    );
  }

  const branch = decode(segments[3]);
  if (!branch) return fail();
  const pathParts = segments.slice(4).map(decode);
  if (pathParts.some((p) => p === null)) return fail();
  const path = pathParts.length > 0 ? pathParts.join("/") : null;

  return { ok: true, data: { owner, repo, branch, path } };
}
