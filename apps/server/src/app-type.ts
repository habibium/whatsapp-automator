/**
 * Public type entrypoint consumed by the web client's Hono RPC client.
 * Built to `dist/dts/app-type.d.ts` so the web typechecks against a
 * declaration rather than pulling the server's source graph.
 */
export type { AppType } from "./app";
