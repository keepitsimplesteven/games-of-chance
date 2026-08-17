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
 *
 * Direction is determined by `side`:
 * - 'left': departs from center-right edge → moves rightward (attacking toward right column)
 * - 'right': departs from center-left edge → moves leftward (attacking toward left column)
 *
 * In 1v1 mode, side defaults to 'left' for backward compatibility.
 */
export function computeAttackerPoints(
  attackerBounds: { x: number; y: number; width: number; height: number },
  mode: '1v1' | 'ffa',
  side: 'left' | 'right' = 'left'
): { origin: { x: number; y: number }; exit: { x: number; y: number } } {
  if (side === 'left') {
    // Shoot rightward
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
  // side === 'right' → Shoot leftward
  const origin = {
    x: attackerBounds.x,
    y: attackerBounds.y + attackerBounds.height / 2,
  }
  const exit = {
    x: origin.x - attackerBounds.width * 0.3,
    y: origin.y,
  }
  return { origin, exit }
}

/**
 * Compute projectile entry point for target (150% away from target bounds).
 *
 * Direction is determined by `side` (the TARGET's side):
 * - 'left': projectile enters from the left (attacker is on the right, shooting left)
 * - 'right': projectile enters from the right (attacker is on the left, shooting right)
 *
 * In 1v1 mode, side defaults to 'right' (target is on the right, enters from left).
 */
export function computeTargetEntry(
  targetBounds: { x: number; y: number; width: number; height: number },
  mode: '1v1' | 'ffa',
  side: 'left' | 'right' = 'right'
): { x: number; y: number } {
  if (side === 'right') {
    // Target is on the right, projectile enters from the left
    return {
      x: targetBounds.x - targetBounds.width * 1.5,
      y: targetBounds.y + targetBounds.height / 2,
    }
  }
  // side === 'left' → Target is on the left, projectile enters from the right
  return {
    x: targetBounds.x + targetBounds.width + targetBounds.width * 1.5,
    y: targetBounds.y + targetBounds.height / 2,
  }
}
