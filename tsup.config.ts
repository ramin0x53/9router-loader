import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  external: [
    "@opencode/plugin",
    /^@opencode\/plugin\//,
    "@opencode-ai/plugin",
    /^@opencode-ai\/plugin\//,
    "effect",
    /^effect\//,
  ],
});
