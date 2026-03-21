import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function getHostname(urlValue?: string): string | null {
  if (!urlValue) return null;

  try {
    return new URL(urlValue).hostname;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, "../../");
  const env = loadEnv(mode, envDir, "");
  const allowedHosts = new Set(
    [getHostname(env["APP_URL"]), ...(env["VITE_ALLOWED_HOSTS"]?.split(",") ?? [])]
      .map((value) => value?.trim())
      .filter(Boolean) as string[]
  );
  const proxyTarget = env["VITE_DEV_PROXY_TARGET"] || "http://localhost:3000";

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true
        }
      },
      allowedHosts: allowedHosts.size > 0 ? [...allowedHosts] : true
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    }
  };
});
