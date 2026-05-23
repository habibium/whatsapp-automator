import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 5173,
    // Accept requests from the Cloudflare tunnel hostname (dev only).
    allowedHosts: [".naxata.com", ".local", "localhost"],
    // Proxy the API so the dev client and server share an origin (no CORS).
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
