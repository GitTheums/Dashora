import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { type PluginOption, defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";

const analyze = process.env["ANALYZE"] === "1";

const analyzePlugins: PluginOption[] = analyze
  ? [
      visualizer({
        filename: "dist/bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
        open: false,
        template: "treemap",
      }) as PluginOption,
    ]
  : [];

export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: "gzip",
      exclude: [/\.(png|jpe?g|webp|gif|svg|woff2?)$/i],
    }),
    compression({
      algorithm: "brotliCompress",
      exclude: [/\.(png|jpe?g|webp|gif|svg|woff2?)$/i],
    }),
    ...analyzePlugins,
  ],
  build: {
    // Keep the default warning meaningful after code-splitting.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/react-grid-layout")) {
            return "grid-layout";
          }
          if (id.includes("node_modules/zod")) {
            return "zod";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
