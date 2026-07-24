import { defineConfig } from "vite";
import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

// The @crxjs plugin reads manifest.json, rewrites the TypeScript/HTML entry
// paths, bundles the popup, content script and service worker, and emits a
// valid Manifest V3 extension into dist/.
export default defineConfig({
  plugins: [crx({ manifest: manifest as ManifestV3Export })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // Keep output filenames stable and predictable.
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
