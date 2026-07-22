import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE_SITE_ORIGIN = "https://maddauni.online";
const LIVE_API_ORIGIN = "https://admin.maddauni.online";

const liveProxy = {
  target: LIVE_SITE_ORIGIN,
  changeOrigin: true,
  secure: true
};

const localWebsiteAssetsPlugin = () => ({
  name: "mwu-local-website-assets",
  configureServer(server) {
    const adminRoot = path.dirname(fileURLToPath(import.meta.url));
    const websitePublicRoot = path.resolve(adminRoot, "..", "MWU-Project", "public");
    const mimeTypes = {
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".woff": "font/woff",
      ".woff2": "font/woff2"
    };

    // Imported pages use /__live_asset so missing local files can fall back to
    // the deployed website. During local Admin editing, prefer the matching
    // MWU-Project asset when it exists; this keeps newly added CSS and images
    // visible before the website deployment has been refreshed.
    server.middlewares.use("/__live_asset", async (request, response, next) => {
      try {
        const requestPath = decodeURIComponent(String(request.url || "/").split(/[?#]/)[0]);
        const relativePath = requestPath.replace(/^\/+/, "");
        const targetPath = path.resolve(websitePublicRoot, relativePath);
        if (!targetPath.startsWith(`${websitePublicRoot}${path.sep}`)) {
          next();
          return;
        }
        const details = await stat(targetPath).catch(() => null);
        if (!details?.isFile()) {
          next();
          return;
        }
        const contents = await readFile(targetPath);
        response.statusCode = 200;
        response.setHeader("Content-Type", mimeTypes[path.extname(targetPath).toLowerCase()] || "application/octet-stream");
        response.setHeader("Cache-Control", "no-store");
        response.end(contents);
      } catch {
        next();
      }
    });
  }
});

const siteChromePublishPlugin = () => ({
  name: "mwu-site-chrome-publish",
  configureServer(server) {
    server.middlewares.use("/__site_chrome_publish", (request, response) => {
      if (request.method !== "POST") {
        response.statusCode = 405;
        response.end("Method not allowed");
        return;
      }

      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2_000_000) request.destroy();
      });
      request.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const fileName = payload.kind === "footer" ? "universal-footer.html" : "inner-header.html";
          const rootDir = path.dirname(fileURLToPath(import.meta.url));
          const partialsDir = path.resolve(rootDir, "public", "assets", "partials");
          const targetPath = path.resolve(partialsDir, fileName);
          if (!targetPath.startsWith(`${partialsDir}${path.sep}`)) {
            throw new Error("Invalid site-chrome target path.");
          }
          await mkdir(partialsDir, { recursive: true });
          await writeFile(targetPath, String(payload.html || payload.content || ""), "utf8");
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ ok: true, scope: "local", path: `/assets/partials/${fileName}` }));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ ok: false, error: error.message || "Header file write failed." }));
        }
      });
    });
  }
});

export default defineConfig({
  plugins: [react(), localWebsiteAssetsPlugin(), siteChromePublishPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
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
      },
      "/__live_api": {
        target: LIVE_API_ORIGIN,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__live_api/, "") || "/"
      },
      "/__live_media": {
        ...liveProxy,
        rewrite: (path) => path.replace(/^\/__live_media/, "") || "/"
      },
      "/__live_site_chrome": {
        ...liveProxy,
        rewrite: () => "/api/site-chrome"
      }
    }
  }
});
