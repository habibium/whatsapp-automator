import type { Hono } from "hono";

type HonoLike = Pick<Hono, "request">;

/** Helper that sends a JSON request through Hono's in-process test transport. */
export function jsonRequest(
  app: HonoLike,
  path: string,
  method: string,
  body?: unknown
): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}
