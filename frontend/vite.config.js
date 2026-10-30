import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {

  return {
    base:
      mode === "map"
        ? "/map/"
        : mode === "mummap"
        ? "/mummap/"
        : "/",

    plugins: [
      react(),

      VitePWA({
        registerType: "prompt",
        manifest: false,

        // ✅ Disable SW in dev to prevent JSON issues
        devOptions: {
          enabled: false,
        },

        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,json}"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          clientsClaim: true,
          skipWaiting: false,

          runtimeCaching: [
            // 🖼 Tiles / images
            {
              urlPattern: ({ request }) =>
                request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "tiles-cache",
                expiration: {
                  maxEntries: 5000,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },

            // 🗺 Floor JSON (IMPORTANT)
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/data/"),
              handler: "NetworkFirst",   // critical for multi-floor switching
              options: {
                cacheName: "floor-data-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 24 * 60 * 60, // 1 day
                },
              },
            },
          ],
        },
      }),
    ],

    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              "react",
              "react-dom",
              "leaflet",
              "react-leaflet",
              "react-router-dom",
            ],
          },
        },
      },
    },

    server: { port: 5173 },
  };
});
