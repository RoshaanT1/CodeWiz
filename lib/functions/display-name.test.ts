import { describe, expect, it } from "vitest";

import { displayName } from "./display-name";

describe("displayName", () => {
  it("names route handlers after their route", () => {
    expect(displayName("POST", "app/api/drills/[id]/submit/route.ts")).toBe("POST /api/drills/[id]/submit");
    expect(displayName("GET", "src/app/api/health/route.js")).toBe("GET /api/health");
    expect(displayName("POST", "app/(app)/api/x/route.ts")).toBe("POST /api/x");
  });

  it("leaves everything else alone", () => {
    expect(displayName("submit", "app/api/drills/[id]/submit/route.ts")).toBe("submit");
    expect(displayName("POST", "lib/server/post.ts")).toBe("POST");
    expect(displayName("Ky.create", "source/core/Ky.ts")).toBe("Ky.create");
  });
});
