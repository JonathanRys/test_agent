import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "./server/tests/**/*.test.ts",
      "./tests/**/*.test.ts",
      "./tests/**/*.test.tsx",
    ],
    css: false,
  },
});
