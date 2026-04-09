import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      nextjs: "src/nextjs.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  },
  {
    entry: { "bin/instruckt-mcp": "bin/instruckt-mcp.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
