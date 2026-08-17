import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnimationLayerProps, HitEffect, DamageNumberEffect } from './types'
import { computeProjectilePhases, computeAttackerPoints, computeTargetEntry } from './ProjectileEngine'
import { buildHitEffect, computeHitPosition } from './HitEffectEngine'
import { buildDamageNumber, computeDamageNumberOffset } from './DamageNumberEngine'
import { HIT_SVG_COMPONENTS } from './hitEffects'
import { ANIMATION_CONSTANTS } from './constants'

const { CLEANUP_DELAY_MS } = ANIMATION_CONSTANTS

// ── Internal Effect Types ──

interface ActiveProjectile {
  id: string
  attackerId: string
  targetId: string
  color: string
  attackerOrigin: { x: number; y: number }
  attackerExit: { x: number; y: number }
  targetEntry: { x: number; y: number }
  targetImpact: { x: number; y: number }
  exitDurationMs: number
  delayMs: number
  travelDurationMs: number
  /** Which animation phase the projectile is in */
  phase: 'exit' | 'delay' | 'travel'
  /** Attack event data for triggering hit/damage effects on completion */
  attackEvent: { hit: boolean; damage: number }
  attackerWeapon: string
  effectIndex: number
  stackIndex: number
}

interface ActiveHitEffect {
  id: string
  effect: HitEffect
  targetId: string
}

interface ActiveDamageNumber {
  id: string
  effect: DamageNumberEffect
  targetId: string
}

// ── Unique ID generator ──

let effectIdCounter = 0
function nextEffectId(prefix: string): string {
  return `${prefix}-${++effectIdCounter}`
}

/**
 * AnimationLayer — top-level overlay that coordinates projectile animations,
 * hit SVGs, and floating damage numbers on top of the battle arena.
 *
 * Renders as position:absolute overlay with pointer-events:none and z-index:10.
 * Subscribes to tick changes and produces visual effects without modifying game state.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
export function AnimationLayer({
  tickEntry,
  hpStates,
  robots,
  robotColors,
  gameSpeed,
  isPlaying,
  isComplete,
  mode,
  robotRefs,
  robotSvgRefs,
  robotColumns,
}: AnimationLayerProps) {
  const [activeProjectiles, setActiveProjectiles] = useState<ActiveProjectile[]>([])
  const [activeHitEffects, setActiveHitEffects] = useState<ActiveHitEffect[]>([])
  const [activeDamageNumbers, setActiveDamageNumbers] = useState<ActiveDamageNumber[]>([])

  // Track cleanup timeouts so we can clear them on unmount
  const cleanupTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  // Ref to the overlay container for relative position calculations
  const overlayRef = useRef<HTMLDivElement>(null)

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of cleanupTimeoutsRef.current) {
        clearTimeout(timeout)
      }
      cleanupTimeoutsRef.current.clear()
    }
  }, [])

  // Get robot's weapon type
  const getRobotWeapon = useCallback(
    (robotId: string): string => {
      const robot = robots.find((r) => r.ownerId === robotId)
      return robot?.visual?.weapon ?? 'drill'
    },
    [robots]
  )

  // Get bounds for a robot's SVG area relative to the overlay
  const getBounds = useCallback(
    (robotId: string): { width: number; height: number; x: number; y: number } | null => {
      const svgRef = robotSvgRefs?.[robotId]
      const ref = svgRef?.current ? svgRef : robotRefs[robotId]
      if (!ref?.current || !overlayRef.current) return null

      const targetRect = ref.current.getBoundingClientRect()
      const overlayRect = overlayRef.current.getBoundingClientRect()

      if (targetRect.width === 0 || targetRect.height === 0) return null

      return {
        width: targetRect.width,
        height: targetRect.height,
        x: targetRect.left - overlayRect.left,
        y: targetRect.top - overlayRect.top,
      }
    },
    [robotRefs, robotSvgRefs]
  )

  // Schedule removal of an effect after a delay
  const scheduleCleanup = useCallback(
    (
      removeId: string,
      type: 'hit' | 'damage',
      delayMs: number
    ) => {
      const timeout = setTimeout(() => {
        cleanupTimeoutsRef.current.delete(timeout)
        switch (type) {
          case 'hit':
            setActiveHitEffects((prev) => prev.filter((h) => h.id !== removeId))
            break
          case 'damage':
            setActiveDamageNumbers((prev) => prev.filter((d) => d.id !== removeId))
            break
        }
      }, delayMs)
      cleanupTimeoutsRef.current.add(timeout)
    },
    []
  )

  // Transition projectile to next phase
  const advanceProjectilePhase = useCallback((projectileId: string) => {
    setActiveProjectiles((prev) =>
      prev.map((p) => {
        if (p.id !== projectileId) return p
        if (p.phase === 'exit') return { ...p, phase: 'delay' as const }
        if (p.phase === 'delay') return { ...p, phase: 'travel' as const }
        return p
      })
    )
  }, [])

  // Handle projectile travel completion — trigger hit effect and damage number
  const handleProjectileImpact = useCallback(
    (projectile: ActiveProjectile) => {
      const targetBounds = getBounds(projectile.targetId)

      // Trigger hit effect at impact location
      if (targetBounds) {
        const hitEffect = buildHitEffect(
          projectile.attackEvent,
          projectile.attackerWeapon,
          projectile.color,
          { width: targetBounds.width, height: targetBounds.height },
          projectile.effectIndex
        )
        // Override position to use the impact point (relative to target bounds)
        hitEffect.position = {
          x: projectile.targetImpact.x - targetBounds.x,
          y: projectile.targetImpact.y - targetBounds.y,
        }
        const hitId = nextEffectId('hit')
        setActiveHitEffects((prev) => [...prev, { id: hitId, effect: hitEffect, targetId: projectile.targetId }])
        scheduleCleanup(hitId, 'hit', hitEffect.durationMs + CLEANUP_DELAY_MS)
      }

      // Trigger damage number (only for hits)
      if (projectile.attackEvent.hit && targetBounds) {
        const dmgEffect = buildDamageNumber(
          projectile.attackEvent,
          { width: targetBounds.width, height: targetBounds.height },
          gameSpeed,
          projectile.stackIndex
        )
        if (dmgEffect) {
          const dmgId = nextEffectId('dmg')
          setActiveDamageNumbers((prev) => [...prev, { id: dmgId, effect: dmgEffect, targetId: projectile.targetId }])
          scheduleCleanup(dmgId, 'damage', dmgEffect.durationMs + CLEANUP_DELAY_MS)
        }
      }

      // Remove projectile
      setActiveProjectiles((prev) => prev.filter((p) => p.id !== projectile.id))
    },
    [getBounds, gameSpeed, scheduleCleanup]
  )

  // Process tick entry changes
  useEffect(() => {
    // Guard: produce no effects when paused and not complete
    if (!isPlaying && !isComplete) return

    // Guard: no tick data
    if (!tickEntry || !tickEntry.attacks.length) return

    // Guard: overlay must be mounted
    if (!overlayRef.current) return

    const newProjectiles: ActiveProjectile[] = []

    // Count hits per target for stacking damage numbers
    const hitsPerTarget = new Map<string, number>()
    // Count effects per target for hit effect indexing
    const effectsPerTarget = new Map<string, number>()

    for (const attack of tickEntry.attacks) {
      if (attack.hit) {
        hitsPerTarget.set(attack.targetId, (hitsPerTarget.get(attack.targetId) ?? 0) + 1)
      }
    }

    // Track damage number index per target for stacking
    const damageIndexPerTarget = new Map<string, number>()

    for (const attack of tickEntry.attacks) {
      const { attackerId, targetId } = attack

      // Skip effects for eliminated robots (attacker side)
      const attackerHp = hpStates[attackerId]
      if (attackerHp?.eliminated) continue

      // Skip effects for eliminated targets
      const targetHp = hpStates[targetId]
      if (targetHp?.eliminated) continue

      // Get bounds for attacker and target
      const attackerBounds = getBounds(attackerId)
      const targetBounds = getBounds(targetId)
      if (!attackerBounds || !targetBounds) continue

      // Compute projectile phases
      const phases = computeProjectilePhases(gameSpeed)

      // Determine attacker's side from column position (0 = left, 1 = right)
      const attackerCol = robotColumns?.[attackerId] ?? 0
      const attackerSide: 'left' | 'right' = attackerCol === 0 ? 'left' : 'right'
      // Target side is the opposite of attacker's side for incoming direction
      const targetCol = robotColumns?.[targetId] ?? 1
      const targetSide: 'left' | 'right' = targetCol === 0 ? 'left' : 'right'

      // Compute attacker origin and exit points (shoots toward opponent's side)
      const { origin: attackerOrigin, exit: attackerExit } = computeAttackerPoints(attackerBounds, mode, attackerSide)

      // Compute target entry point (arrives from attacker's direction)
      const targetEntry = computeTargetEntry(targetBounds, mode, targetSide)

      // Compute target impact point using hit position logic
      const effectIndex = effectsPerTarget.get(targetId) ?? 0
      effectsPerTarget.set(targetId, effectIndex + 1)
      const hitPos = computeHitPosition(targetBounds.width, targetBounds.height, effectIndex)
      const targetImpact = {
        x: targetBounds.x + hitPos.x,
        y: targetBounds.y + hitPos.y,
      }

      // Get stack index for damage numbers
      const stackIndex = damageIndexPerTarget.get(targetId) ?? 0
      if (attack.hit) {
        damageIndexPerTarget.set(targetId, stackIndex + 1)
      }

      // Create projectile
      const projectileId = nextEffectId('proj')
      const color = robotColors[attackerId] ?? '#ffffff'

      newProjectiles.push({
        id: projectileId,
        attackerId,
        targetId,
        color,
        attackerOrigin,
        attackerExit,
        targetEntry,
        targetImpact,
        exitDurationMs: phases.exitDurationMs,
        delayMs: phases.delayMs,
        travelDurationMs: phases.travelDurationMs,
        phase: 'exit',
        attackEvent: { hit: attack.hit, damage: attack.damage },
        attackerWeapon: getRobotWeapon(attackerId),
        effectIndex,
        stackIndex,
      })
    }

    if (newProjectiles.length > 0) {
      setActiveProjectiles((prev) => [...prev, ...newProjectiles])
    }
  }, [tickEntry, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
      data-testid="animation-layer"
    >
      <AnimatePresence>
        {/* Projectile animations */}
        {activeProjectiles.map((proj) => {
          if (proj.phase === 'exit') {
            return (
              <motion.div
                key={`${proj.id}-exit`}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: proj.color,
                }}
                initial={{
                  left: proj.attackerOrigin.x - 4,
                  top: proj.attackerOrigin.y - 4,
                  opacity: 1,
                }}
                animate={{
                  left: proj.attackerExit.x - 4,
                  top: proj.attackerExit.y - 4,
                  opacity: 1,
                }}
                transition={{
                  duration: proj.exitDurationMs / 1000,
                  ease: 'linear',
                }}
                onAnimationComplete={() => advanceProjectilePhase(proj.id)}
              />
            )
          }

          if (proj.phase === 'delay') {
            return (
              <motion.div
                key={`${proj.id}-delay`}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: proj.color,
                  opacity: 0,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                transition={{
                  duration: proj.delayMs / 1000,
                }}
                onAnimationComplete={() => advanceProjectilePhase(proj.id)}
              />
            )
          }

          if (proj.phase === 'travel') {
            return (
              <motion.div
                key={`${proj.id}-travel`}
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: proj.color,
                }}
                initial={{
                  left: proj.targetEntry.x - 4,
                  top: proj.targetEntry.y - 4,
                  opacity: 1,
                }}
                animate={{
                  left: proj.targetImpact.x - 4,
                  top: proj.targetImpact.y - 4,
                  opacity: 1,
                }}
                transition={{
                  duration: proj.travelDurationMs / 1000,
                  ease: 'linear',
                }}
                onAnimationComplete={() => handleProjectileImpact(proj)}
              />
            )
          }

          return null
        })}

        {/* Hit effect SVGs */}
        {activeHitEffects.map((hitItem) => {
          const targetBounds = getBounds(hitItem.targetId)
          if (!targetBounds) return null

          const HitSVGComponent = HIT_SVG_COMPONENTS[hitItem.effect.weaponType]
          const sizePx = hitItem.effect.sizePct * targetBounds.width

          return (
            <motion.div
              key={hitItem.id}
              style={{
                position: 'absolute',
                left: targetBounds.x + hitItem.effect.position.x - sizePx / 2,
                top: targetBounds.y + hitItem.effect.position.y - sizePx / 2,
              }}
              initial={{ opacity: hitItem.effect.opacity, scale: 0.8 }}
              animate={{ opacity: hitItem.effect.opacity, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: hitItem.effect.durationMs / 1000 }}
              onAnimationComplete={() => {
                setActiveHitEffects((prev) => prev.filter((h) => h.id !== hitItem.id))
              }}
            >
              <HitSVGComponent
                color={hitItem.effect.color}
                size={sizePx}
                opacity={hitItem.effect.opacity}
              />
            </motion.div>
          )
        })}

        {/* Floating damage numbers */}
        {activeDamageNumbers.map((dmgItem) => {
          const targetBounds = getBounds(dmgItem.targetId)
          if (!targetBounds) return null

          const offset = computeDamageNumberOffset(
            dmgItem.effect.offsetIndex,
            activeDamageNumbers.filter((d) => d.targetId === dmgItem.targetId).length
          )

          return (
            <motion.div
              key={dmgItem.id}
              style={{
                position: 'absolute',
                left: targetBounds.x + dmgItem.effect.startPosition.x,
                top: targetBounds.y + dmgItem.effect.startPosition.y - offset,
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '22px',
                userSelect: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -50 }}
              transition={{
                duration: Math.max(dmgItem.effect.durationMs / 1000, 0.8),
                ease: 'easeOut',
              }}
              onAnimationComplete={() => {
                setActiveDamageNumbers((prev) => prev.filter((d) => d.id !== dmgItem.id))
              }}
            >
              {dmgItem.effect.value}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
