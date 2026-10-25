import { defineConfig } from "vite";

export default defineConfig({
  base: "/furevrnac/",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
