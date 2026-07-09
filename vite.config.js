import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const LIVE_SITE_ORIGIN = "https://maddauni.online";

const liveProxy = {
  target: LIVE_SITE_ORIGIN,
  changeOrigin: true,
  secure: true
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    proxy: {
      // Do NOT proxy /assets.
      // Vite serves /public/assets locally.
      "/__live_page": {
        ...liveProxy,
        rewrite: (path) => path.replace(/^\/__live_page/, "") || "/"
      },
      "/__live_asset": {
        ...liveProxy,
        rewrite: (path) => path.replace(/^\/__live_asset/, "") || "/"
      }
    }
  }
});