import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 3000,
    proxy: {
      "/api/danbooru": {
        target: "https://danbooru.donmai.us",
        changeOrigin: true,
        rewrite: (path) => {
          // Transform /api/danbooru?url=posts.json&tags=... -> /posts.json?tags=...
          const url = new URL("http://dummy" + path);
          const searchParams = url.searchParams;
          const targetPath = searchParams.get("url") || "posts.json";
          searchParams.delete("url");
          return `${targetPath}?${searchParams.toString()}`;
        },
        headers: {
          "User-Agent": "Booru-Explorer/1.0 (PROYECTO_EDUCATIVO)",
        },
      },
    },
  },
});
