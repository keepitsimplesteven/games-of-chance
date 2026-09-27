import "@testing-library/jest-dom/vitest"

// jsdom does not implement Element.prototype.scrollTo. Some components
// (e.g. PlayByPlayAnnouncer) call it in effects, which throws under jsdom.
// Stub it as a no-op if absent so those components render in tests.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
