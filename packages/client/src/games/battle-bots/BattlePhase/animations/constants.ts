export const ANIMATION_CONSTANTS = {
  /** Average ticks between slides for 1-attack-per-tick robot */
  SLIDE_INTERVAL_TICKS: 3,
  /** Min slide offset as fraction of robot width */
  SLIDE_MIN_OFFSET_PCT: 0.10,
  /** Max slide offset as fraction of robot width */
  SLIDE_MAX_OFFSET_PCT: 0.25,
  /** FFA max slide offset as fraction of cell dimension */
  FFA_MAX_OFFSET_PCT: 0.25,
  /** Hit SVG display duration (fixed, independent of gameSpeed) */
  HIT_SVG_DURATION_MS: 150,
  /** Opacity for miss hit effects */
  MISS_OPACITY: 0.3,
  /** Minimum pixels for damage number float distance */
  DAMAGE_FLOAT_MIN_PX: 30,
  /** Threshold below which animation duration is clamped */
  FAST_SPEED_THRESHOLD_MS: 150,
  /** Clamping factor for fast speeds */
  FAST_SPEED_CLAMP_FACTOR: 0.9,
  /** Max time after animation end to clean up DOM (ms) */
  CLEANUP_DELAY_MS: 500,
  /** Weapon size limits as fraction of target width (tweak these to scale hit effects) */
  WEAPON_SIZE_LIMITS: {
    blaster: 0.60,
    bazooka: 0.80,
    drill: 0.60,
  },
} as const
