import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// `partyserver` (imported by room.ts) does `import { DurableObject, env } from
// "cloudflare:workers"`. Node's default ESM loader cannot resolve the
// `cloudflare:` scheme, so server tests fail at collection. We alias that
// module to a tiny test-only stub. Because `partyserver` lives in node_modules
// it is externalized by default (and thus resolved by Node, bypassing the
// alias), so we also inline it so Vite transforms it and applies the alias.
const cloudflareWorkersStub = fileURLToPath(
  new URL("./src/test-support/cloudflare-workers-stub.ts", import.meta.url),
)

export default defineConfig({
  test: {
    globals: true,
    // Pin a fixed fast-check seed for deterministic property-test runs (T4).
    setupFiles: ["./src/test-setup.ts"],
    server: {
      deps: {
        inline: ["partyserver"],
      },
    },
  },
  resolve: {
    alias: {
      "cloudflare:workers": cloudflareWorkersStub,
    },
  },
})
