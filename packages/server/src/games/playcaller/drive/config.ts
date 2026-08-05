/**
 * Active play configuration for the Drive Engine.
 *
 * This file re-exports whichever preset is currently "live."
 * To switch presets, change the import below.
 *
 * Available presets (in ./presets/):
 *   - v1-balanced: First tuned config. ~50/50, 2.5-3.5 avg yds, <60% exploitability.
 *
 * To add a new preset:
 *   1. Create a new file in ./presets/ (copy v1-balanced.ts as a template)
 *   2. Export it from ./presets/index.ts
 *   3. Change the import below to point at your new preset
 *   4. Run balance + exploitability tests to verify
 */

import { PLAY_CONFIG, PLAY_MATRIX } from "./presets/v3-decisive"

export const DEFAULT_PLAY_CONFIG = PLAY_CONFIG
export const DEFAULT_PLAY_MATRIX = PLAY_MATRIX
