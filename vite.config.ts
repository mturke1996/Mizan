import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Vite HMR injects inline scripts; strip CSP in dev only. Production keeps index.html CSP. */
function relaxContentSecurityPolicyInDev(): Plugin {
  return {
    name: "mizan-relax-csp-in-dev",
    transformIndexHtml(html, context) {
      if (!context.server) {
        return html;
      }

      return html.replace(
        /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/i,
        "\n    ",
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    relaxContentSecurityPolicyInDev(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/mizan-mark.svg"],
      manifest: {
        id: "/",
        name: "ميزان",
        short_name: "ميزان",
        description: "إدارة أموالك ومحافظك ومشاريعك بوضوح.",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#F7F8FC",
        theme_color: "#F7F8FC",
        categories: ["finance", "business", "productivity"],
        icons: [
          {
            src: "/icons/mizan-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/mizan-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\//i,
            handler: "NetworkOnly",
          },
        ],
      },
      // Keep SW out of `vite` so Workbox debug logs do not flood the console.
      // Production/preview builds still register the service worker.
      devOptions: {
        enabled: false,
        suppressWarnings: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom)[\\/]/,
              priority: 50,
            },
            {
              name: "data-vendor",
              test: /node_modules[\\/](?:@supabase|@tanstack)[\\/]/,
              priority: 40,
            },
            {
              name: "charts-vendor",
              test: /node_modules[\\/](?:recharts|d3-[^\\/]+|victory-vendor)[\\/]/,
              priority: 30,
            },
            {
              name: "ui-vendor",
              test: /node_modules[\\/](?:@radix-ui|lucide-react|motion|framer-motion)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              minSize: 20_000,
              maxSize: 250_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
