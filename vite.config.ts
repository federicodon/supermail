/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-first dev server. AI / Gmail config is read from import.meta.env (VITE_*).
// The live sync bridge (server/index.mjs) listens on BRIDGE_PORT (default 8787);
// /api/* is proxied to it so the browser talks to it same-origin (incl. SSE).
const BRIDGE_PORT = 8787; // keep in sync with .env BRIDGE_PORT if you change it

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    open: false,
    proxy: {
      "/api": {
        // 127.0.0.1 (not localhost) so Node 18 doesn't resolve to ::1 first and
        // miss the loopback-bound bridge.
        target: `http://127.0.0.1:${BRIDGE_PORT}`,
        changeOrigin: true,
        // Keep the SSE stream from /api/stream unbuffered.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => proxyReq.setHeader("Connection", "keep-alive"));
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
