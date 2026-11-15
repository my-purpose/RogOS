import type { IncomingMessage, ServerResponse } from "node:http";

/** Keep API requests out of Vite's source-module and SPA fallbacks. */
export function frontendOnlyApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): void {
  const pathname = (req.url || "").split("?")[0];
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    next();
    return;
  }
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({
    error: "Backend unavailable: this preview is running in frontend-only mode.",
    code: "BACKEND_UNAVAILABLE",
  }));
}
