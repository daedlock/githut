import { execFileSync } from "node:child_process";
import path from "node:path";
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default mergeConfig(
  base,
  defineConfig({
    plugins: process.env.PERF_BASELINE
      ? [
          {
            name: "baseline-pickers",
            enforce: "pre",
            load(id) {
              const relative = path.relative(process.cwd(), id).replaceAll("\\", "/");
              if (
                [
                  "src/app/components/ui/popover.tsx",
                  "src/app/features/pulls/components/SidebarPicker.tsx",
                ].includes(relative)
              )
                return execFileSync(
                  "git",
                  ["show", `f8efd23f6e9864001254713d4d8b85f2759e3581:${relative}`],
                  { encoding: "utf8" },
                );
            },
          },
        ]
      : [],
    build: {
      outDir: "perf/results/regressions-build",
      rollupOptions: { input: path.resolve(import.meta.dirname, "fixtures/pickers.html") },
    },
  }),
);
