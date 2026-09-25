# Test Harness Repair (Phase 0) — Design

## Overview

Three independent, low-risk fixes. Each maps to a requirement and can be verified on its own. None touches product code.

## R1 — Resolve `cloudflare:workers` in server tests

### Root cause

`partyserver/dist/index.js` starts with `import { DurableObject, env } from "cloudflare:workers"` and defines `class Server extends DurableObject`. `room.ts` imports `partyserver`, and `helpers.ts` imports `room.ts`, so loading any server test evaluates that `cloudflare:workers` import. Node's ESM loader has no `cloudflare:` scheme and throws at collection time.

The existing `helpers.ts` already fakes the Durable Object state and environment by hand and constructs `GameRoom` as a plain class. So the runtime does not need a real Workers environment. It only needs the `cloudflare:workers` import to resolve to something with a `DurableObject` base class and an `env` value.

### Chosen approach: vitest alias to a test-only stub

1. Add a stub module at `packages/server/src/test-support/cloudflare-workers-stub.ts` exporting exactly what `partyserver` imports:
   - `DurableObject`: a minimal base class whose constructor stores `ctx` and `env` (matching the shape `partyserver`'s `Server` expects, i.e. `this.ctx` / `this.env`). Confirm against the installed `partyserver@0.5.10` source which member names `Server` reads; provide those. Keep it tiny.
   - `env`: an empty object (`export const env = {}`), enough to satisfy the named import.
2. In `packages/server/vitest.config.ts`, add `resolve.alias` mapping `"cloudflare:workers"` to the stub's absolute path. Keep `test.globals: true`.

Why this over `@cloudflare/vitest-pool-workers`: the heavier pool would run tests inside a real workerd runtime and require rewriting `helpers.ts` (which currently hand-builds the DO state). That is a much larger change, out of scope for a green-baseline pass, and risks changing test semantics. The alias approach is additive and reversible.

### Guardrails
- Do NOT edit `room.ts` or anything under `node_modules`.
- Do NOT rewrite `helpers.ts`. If a stub member turns out to be missing, add it to the stub, do not change the helper's construction pattern.
- Verify the stub member names against `node_modules/.pnpm/partyserver@0.5.10*/node_modules/partyserver/dist/index.js` rather than guessing. `Server extends DurableObject` and reads its constructor args; match that.
- If the alias approach cannot make the imports resolve after a genuine attempt (e.g. `partyserver` needs more of the runtime than a stub can provide), STOP and report back to the user rather than pivoting to the pool-workers rewrite. That is a decision for a human.

## R3 — jsdom `scrollTo` stub

`PlayByPlayAnnouncer.tsx` calls `scrollRef.current.scrollTo({ ... })` in an effect. jsdom does not implement `scrollTo`, so it throws during render in tests.

Add to `packages/client/src/test-setup.ts`:
```ts
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
```
This is test-only and does not change component behavior in the browser (real DOM already has `scrollTo`). Prefer this over touching the component.

## R4 — Stale `maxPlayers` typecheck error

`consolationPlacements.test.ts:161` builds a `GameSettings`-typed object literal that includes `maxPlayers`, which is no longer part of `GameSettings` (that field moved to `RoomConfig`). Remove the `maxPlayers` line from that test literal (or move it to the correct object if the test actually needs it). Do not re-add `maxPlayers` to the `GameSettings` type. Re-run `pnpm --filter @games-of-chance/server typecheck` to confirm 0 errors.

## R2 — Verification, not a code change

After R1, run the server suite and confirm the only failures are assertion failures in the four T2 files. Record the before/after counts in the task notes. No code change; this is a checkpoint.

## Sequencing rationale

R4 (typecheck) and R3 (client stub) are trivial and independent, do them first to get quick green signals. R1 is the substantive one. R2 is the final verification checkpoint.

## Risk and rollback

All changes are additive test infrastructure plus one stale-line deletion. Rollback is deleting the stub file, the alias line, the setup-file stub, and reverting the one test line. No product code is touched, so there is no runtime risk.

## Files expected to change

- `packages/server/vitest.config.ts` (add alias)
- `packages/server/src/test-support/cloudflare-workers-stub.ts` (new)
- `packages/client/src/test-setup.ts` (add scrollTo stub)
- `packages/server/src/games/playcaller/consolationPlacements.test.ts` (remove stale `maxPlayers` line)

Nothing else should appear in the diff.
