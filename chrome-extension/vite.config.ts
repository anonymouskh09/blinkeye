import { defineConfig } from "vite";
import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

// base must be relative — absolute "/assets/..." breaks chrome-extension:// pages
// (ERR_FILE_NOT_FOUND for scripts/css inside the side panel).
export default defineConfig({
  base: "./",
  plugins: [crx({ manifest: manifest as ManifestV3Export })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  server: {
    port: 5178,
    strictPort: true,
    hmr: { port: 5178 },
  },
});
