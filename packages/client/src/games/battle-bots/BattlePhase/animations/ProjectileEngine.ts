import { ANIMATION_CONSTANTS } from './constants'

const { FAST_SPEED_THRESHOLD_MS, FAST_SPEED_CLAMP_FACTOR } = ANIMATION_CONSTANTS

export interface ProjectileConfig {
  mode: '1v1' | 'ffa'
  gameSpeed: number
}

export interface ProjectilePhases {
  exitDurationMs: number // 30% of gameSpeed
  delayMs: number // 20% of gameSpeed
  travelDurationMs: number // 50% of gameSpeed
}

export interface ProjectileDecision {
  shouldAnimate: boolean
  attackerOrigin: { x: number; y: number } // start of exit phase
  attackerExit: { x: number; y: number } // end of exit phase (leaves attacker bounds)
  targetEntry: { x: number; y: number } // start of travel phase (150% away from target)
  targetImpact: { x: number; y: number } // hit location on target
  phases: ProjectilePhases
  color: string
}

/**
 * Compute phase durations from gameSpeed with fast-speed clamping.
 * Splits the effective duration into 30% exit, 20% delay, 50% travel.
 * When gameSpeed < 150ms, applies the 0.9 clamping factor.
 */
export function computeProjectilePhases(gameSpeed: number): ProjectilePhases {
  const effective =
    gameSpeed < FAST_SPEED_THRESHOLD_MS ? gameSpeed * FAST_SPEED_CLAMP_FACTOR : gameSpeed
  return {
    exitDurationMs: effective * 0.3,
    delayMs: effective * 0.2,
    travelDurationMs: effective * 0.5,
  }
}

/**
 * Compute projectile origin/exit for attacker.
 * 1v1: departs from center-right edge → moves rightward off bounds
 * FFA: departs from bottom center → moves downward off bounds
 */
export function computeAttackerPoints(
  attackerBounds: { x: number; y: number; width: number; height: number },
  mode: '1v1' | 'ffa'
): { origin: { x: number; y: number }; exit: { x: number; y: number } } {
  if (mode === '1v1') {
    const origin = {
      x: attackerBounds.x + attackerBounds.width,
      y: attackerBounds.y + attackerBounds.height / 2,
    }
    const exit = {
      x: origin.x + attackerBounds.width * 0.3,
      y: origin.y,
    }
    return { origin, exit }
  }
  // FFA: bottom center
  const origin = {
    x: attackerBounds.x + attackerBounds.width / 2,
    y: attackerBounds.y + attackerBounds.height,
  }
  const exit = {
    x: origin.x,
    y: origin.y + attackerBounds.height * 0.3,
  }
  return { origin, exit }
}

/**
 * Compute projectile entry point for target (150% away from target bounds).
 * 1v1: enters from left at 150% of target SVG width
 * FFA: enters from above at 150% of target SVG height
 */
export function computeTargetEntry(
  targetBounds: { x: number; y: number; width: number; height: number },
  mode: '1v1' | 'ffa'
): { x: number; y: number } {
  if (mode === '1v1') {
    return {
      x: targetBounds.x - targetBounds.width * 1.5,
      y: targetBounds.y + targetBounds.height / 2,
    }
  }
  return {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y - targetBounds.height * 1.5,
  }
}
