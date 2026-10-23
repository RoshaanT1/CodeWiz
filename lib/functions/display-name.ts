const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/**
 * A readable name for a function. Next.js route handlers are all named after
 * the HTTP method (six "POST"s in a map), so they get their route instead:
 * POST in app/api/drills/[id]/submit/route.ts becomes "POST /api/drills/[id]/submit".
 * Route groups like (app) are dropped, as they are from the URL.
 */
export function displayName(name: string, filePath: string): string {
  const match = /(?:^|\/)app\/(.*?)\/?route\.(?:ts|tsx|js|jsx|mjs)$/.exec(filePath);
  if (match && HTTP_METHODS.has(name)) {
    const route = (match[1] ?? "")
      .split("/")
      .filter((part) => part && !/^\(.*\)$/.test(part))
      .join("/");
    return `${name} /${route}`;
  }
  return name;
}
