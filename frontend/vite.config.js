import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: { maximumFileSizeToCacheInBytes: 5_000_000 },
      devOptions: { enabled: true, type: "module" },
      manifest: {
        id: "/",
        name: "Virtual Health Navigator",
        short_name: "HealthNav",
        description: "Plain-language symptom guidance — guidance, not diagnosis.",
        theme_color: "#4f6df5",
        background_color: "#0b1020",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        dir: "ltr",
        categories: ["health", "medical", "lifestyle"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          { name: "Check Symptoms", short_name: "Symptoms", url: "/triage",
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Health AI Chat", short_name: "Chat", url: "/chat",
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Medications", short_name: "Meds", url: "/meds",
            icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }] }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the FastAPI backend during development.
      "/api": "http://localhost:8000"
    }
  },
  preview: {
    port: 4173,
    proxy: { "/api": "http://localhost:8000" }
  }
});
