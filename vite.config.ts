import { defineConfig } from "vite";

const isNative = process.env.VITE_BASE === "native";

export default defineConfig({
  base: isNative ? "/" : "/furevrnac/",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});
