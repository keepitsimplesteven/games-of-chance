import { configureGlobal, readConfigureGlobal } from "fast-check"

// T4 (code-quality audit): fast-check picks a fresh random seed on every run,
// so property-test failure counts drift run-to-run and CI is non-deterministic
// (the audit observed the client failing-count flip between 7 and 8; the server
// suite flips similarly). Pin a fixed global seed so the regression property
// suites are reproducible. A property that intentionally wants randomised
// exploration can still opt out by passing its own `{ seed }` to
// `fc.assert(...)`, which overrides this global default. This is a test-only
// change; no product code is affected.
const FAST_CHECK_SEED = 0x5eed5eed

configureGlobal({
  ...readConfigureGlobal(),
  seed: FAST_CHECK_SEED,
})
