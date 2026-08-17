export { ANIMATION_CONSTANTS } from './constants'
export type {
  SlideDecision,
  SlideEngineConfig,
  WeaponHitType,
  HitEffect,
  DamageNumberEffect,
  TickAnimationState,
  HitSVGProps,
  AnimationLayerProps,
} from './types'
export { computeDamageNumberOffset, buildDamageNumber } from './DamageNumberEngine'
export { getWeaponSizeLimit, computeHitPosition, buildHitEffect } from './HitEffectEngine'
export {
  computeSlideProbability,
  computeSlideDirection,
  computeSlideOffset,
  computeAnimationDuration,
  evaluateSlide,
} from './SlideEngine'
export type { ProjectileConfig, ProjectilePhases, ProjectileDecision } from './ProjectileEngine'
export {
  computeProjectilePhases,
  computeAttackerPoints,
  computeTargetEntry,
} from './ProjectileEngine'
export { AnimationLayer } from './AnimationLayer'
