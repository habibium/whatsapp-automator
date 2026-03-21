import { createAuthClient } from "better-auth/react";
import { getApiOrigin } from "./public-url";

const baseURL = getApiOrigin();

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include" as RequestCredentials
  }
});

export const { signIn, signUp, signOut, useSession } = authClient;
