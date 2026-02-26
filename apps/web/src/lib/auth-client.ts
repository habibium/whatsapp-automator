import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env["VITE_API_URL"]
  ? new URL(import.meta.env["VITE_API_URL"]).origin
  : window.location.origin;

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include" as RequestCredentials
  }
});

export const { signIn, signUp, signOut, useSession } = authClient;
