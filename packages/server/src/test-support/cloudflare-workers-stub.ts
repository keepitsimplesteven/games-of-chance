// Test-only stub for the `cloudflare:workers` module.
//
// `partyserver/dist/index.js` starts with
//   import { DurableObject, env } from "cloudflare:workers"
// and defines `class Server extends DurableObject`, whose constructor calls
// `super(ctx, env)` and later reads `this.ctx` / `this.env`. Node's default
// ESM loader cannot resolve the `cloudflare:` scheme, so server tests that
// import `room.ts` fail at collection. `helpers.ts` already hand-mocks the
// Durable Object state and env, so we only need the import to resolve to a
// base class that stores `ctx`/`env`.

export class DurableObject {
  ctx: any
  env: any

  constructor(ctx: any, env: any) {
    this.ctx = ctx
    this.env = env
  }
}

export const env = {}
