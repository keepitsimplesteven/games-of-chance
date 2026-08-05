/**
 * Drive Engine Presets
 *
 * Each preset is a named (PlayConfig, PlayMatrix) pair representing a tuning snapshot.
 * To test a different config, either:
 *   1. Change the active preset in ../config.ts
 *   2. Pass the preset's config/matrix directly to resolveDown or createDriveResolver
 *   3. Run the balance/exploitability tests with a specific preset imported
 *
 * Adding a new preset:
 *   1. Copy an existing preset file (e.g. v1-balanced.ts)
 *   2. Rename and adjust the numbers
 *   3. Export it from this index
 *   4. Run: npx vitest run src/games/playcaller/drive/balance.property.test.ts
 *          npx vitest run src/games/playcaller/drive/exploitability.test.ts
 */

export { PLAY_CONFIG as V1_PLAY_CONFIG, PLAY_MATRIX as V1_PLAY_MATRIX } from "./v1-balanced"
export { PLAY_CONFIG as V2_PLAY_CONFIG, PLAY_MATRIX as V2_PLAY_MATRIX } from "./v2-25yard"
export { PLAY_CONFIG as V3_PLAY_CONFIG, PLAY_MATRIX as V3_PLAY_MATRIX } from "./v3-decisive"
