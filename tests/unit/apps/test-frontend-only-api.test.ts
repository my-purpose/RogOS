import { describe, expect, test } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { frontendOnlyApi } from "../../../vite/frontendOnlyApi";

describe("frontend-only API boundary", () => {
  for (const url of ["/api", "/api/fitness/exercises?id=squat", "/api/chat"]) {
    test(`returns a clear JSON failure for ${url}`, () => {
      const headers = new Map<string, string>();
      let body = "";
      let nextCalled = false;
      const res = { statusCode: 200, setHeader: (k: string, v: string) => headers.set(k, v), end: (v: string) => { body = v; } };
      frontendOnlyApi({ url } as IncomingMessage, res as unknown as ServerResponse, () => { nextCalled = true; });
      expect(res.statusCode).toBe(503);
      expect(headers.get("Content-Type")).toContain("application/json");
      expect(JSON.parse(body).code).toBe("BACKEND_UNAVAILABLE");
      expect(nextCalled).toBe(false);
    });
  }
  for (const url of ["/", "/src/App.tsx", "/apiary", "/icons/file.png"]) {
    test(`preserves frontend resource ${url}`, () => {
      let passed = false;
      frontendOnlyApi({ url } as IncomingMessage, {} as ServerResponse, () => { passed = true; });
      expect(passed).toBe(true);
    });
  }
});
