import { createAuthClient } from "better-auth/react";

/** Better Auth browser client — talks to the server's /api/auth endpoints. */
export const authClient = createAuthClient({
  baseURL: window.location.origin
});

export const { useSession } = authClient;
