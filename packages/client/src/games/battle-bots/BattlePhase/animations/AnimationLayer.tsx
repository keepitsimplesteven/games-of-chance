import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AnimationLayerProps, SlideDecision, HitEffect, DamageNumberEffect } from './types'
import { evaluateSlide } from './SlideEngine'
import { buildHitEffect } from './HitEffectEngine'
import { buildDamageNumber, computeDamageNumberOffset } from './DamageNumberEngine'
import { HIT_SVG_COMPONENTS } from './hitEffects'
import { ANIMATION_CONSTANTS } from './constants'

const { CLEANUP_DELAY_MS, DAMAGE_FLOAT_MIN_PX } = ANIMATION_CONSTANTS

// ── Internal Effect Types ──

interface ActiveSlide {
  id: string
  robotId: string
  decision: SlideDecision
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
 * AnimationLayer — top-level overlay that coordinates slides, hit SVGs,
 * and floating damage numbers on top of the battle arena.
 *
 * Renders as position:absolute overlay with pointer-events:none and z-index:10.
 * Subscribes to tick changes and produces visual effects without modifying game state.
 *
 * Validates: Requirements 1.4, 1.5, 3.3, 3.4, 4.6, 4.7, 5.2, 5.5, 6.2, 6.5, 7.1, 7.2, 7.4, 7.5, 7.6
 */
export function AnimationLayer({
  tickEntry,
  hpStates,
  robots,
  robotColors,
  gameSpeed,
  isPlaying,
  isComplete,
  slideEnabled = true,
  mode,
  robotRefs,
  robotSvgRefs,
}: AnimationLayerProps) {
  const [activeHitEffects, setActiveHitEffects] = useState<ActiveHitEffect[]>([])
  const [activeDamageNumbers, setActiveDamageNumbers] = useState<ActiveDamageNumber[]>([])

  // Track the previous slideEnabled value to handle in-progress completion
  const prevSlideEnabledRef = useRef(slideEnabled)
  // Track whether a slide is currently in progress per robot
  const slidesInProgressRef = useRef<Set<string>>(new Set())
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

  // Handle slideEnabled toggled off: allow in-progress slides to finish
  useEffect(() => {
    prevSlideEnabledRef.current = slideEnabled
  }, [slideEnabled])

  // Get robot position within overlay ('left' | 'right' for 1v1)
  const getRobotPosition = useCallback(
    (robotId: string): 'left' | 'right' => {
      const index = robots.findIndex((r) => r.ownerId === robotId)
      return index === 0 ? 'left' : 'right'
    },
    [robots]
  )

  // Get robot's weapon type
  const getRobotWeapon = useCallback(
    (robotId: string): string => {
      const robot = robots.find((r) => r.ownerId === robotId)
      return robot?.visual?.weapon ?? 'drill'
    },
    [robots]
  )

  // Get bounds for a target robot's SVG area relative to the overlay
  const getTargetBounds = useCallback(
    (targetId: string): { width: number; height: number; x: number; y: number } | null => {
      // Prefer SVG-specific refs for constraining effects to the robot visual
      const svgRef = robotSvgRefs?.[targetId]
      const ref = svgRef?.current ? svgRef : robotRefs[targetId]
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

  // Process tick entry changes
  useEffect(() => {
    // Guard: produce no effects when paused and not complete
    if (!isPlaying && !isComplete) return

    // Guard: no tick data
    if (!tickEntry || !tickEntry.attacks.length) return

    // Guard: overlay must be mounted
    if (!overlayRef.current) return

    const newSlides: ActiveSlide[] = []
    const newHitEffects: ActiveHitEffect[] = []
    const newDamageNumbers: ActiveDamageNumber[] = []

    // Count attacks per attacker for slide probability
    const attacksPerAttacker = new Map<string, number>()
    // Count hits per target for stacking damage numbers
    const hitsPerTarget = new Map<string, number>()

    for (const attack of tickEntry.attacks) {
      attacksPerAttacker.set(
        attack.attackerId,
        (attacksPerAttacker.get(attack.attackerId) ?? 0) + 1
      )
      if (attack.hit) {
        hitsPerTarget.set(
          attack.targetId,
          (hitsPerTarget.get(attack.targetId) ?? 0) + 1
        )
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

      // ── Slide for attacker ──
      const attacksInTick = attacksPerAttacker.get(attackerId) ?? 1
      const robotRef = robotRefs[attackerId]
      const robotWidth = robotRef?.current?.getBoundingClientRect().width ?? 80

      // Determine effective slideEnabled — allow in-progress to finish
      const effectiveSlideEnabled =
        slideEnabled || slidesInProgressRef.current.has(attackerId)

      const slideDecision = evaluateSlide(
        attackerId,
        attacksInTick,
        {
          mode,
          slideEnabled: effectiveSlideEnabled,
          gameSpeed,
          robotWidth,
        },
        attackerHp?.eliminated ?? false,
        mode === '1v1' ? getRobotPosition(attackerId) : undefined
      )

      if (slideDecision.shouldSlide) {
        // Only add one slide per attacker per tick
        if (!newSlides.some((s) => s.robotId === attackerId)) {
          const slideId = nextEffectId('slide')
          newSlides.push({ id: slideId, robotId: attackerId, decision: slideDecision })
          slidesInProgressRef.current.add(attackerId)
        }
      }

      // ── Hit effect on target ──
      const targetBounds = getTargetBounds(targetId)
      if (targetBounds) {
        const effectIndex = newHitEffects.filter((h) => h.targetId === targetId).length
        const hitEffect = buildHitEffect(
          attack,
          getRobotWeapon(attackerId),
          robotColors[attackerId] ?? '#ffffff',
          { width: targetBounds.width, height: targetBounds.height },
          effectIndex
        )
        const hitId = nextEffectId('hit')
        newHitEffects.push({ id: hitId, effect: hitEffect, targetId })
      }

      // ── Damage number on target (only for hits) ──
      if (attack.hit) {
        const targetBoundsForDmg = getTargetBounds(targetId)
        if (targetBoundsForDmg) {
          const stackIndex = damageIndexPerTarget.get(targetId) ?? 0
          damageIndexPerTarget.set(targetId, stackIndex + 1)

          const dmgEffect = buildDamageNumber(
            attack,
            { width: targetBoundsForDmg.width, height: targetBoundsForDmg.height },
            gameSpeed,
            stackIndex
          )

          if (dmgEffect) {
            const dmgId = nextEffectId('dmg')
            newDamageNumbers.push({ id: dmgId, effect: dmgEffect, targetId })
          }
        }
      }
    }

    // Apply slide transforms directly to the actual robot elements
    for (const slide of newSlides) {
      const svgRef = robotSvgRefs?.[slide.robotId]
      const ref = svgRef?.current ? svgRef : robotRefs[slide.robotId]
      if (!ref?.current) continue

      const el = ref.current
      const { direction, offsetPx, durationMs } = slide.decision
      const halfDuration = durationMs / 2

      let transform = ''
      if (direction === 'right') transform = `translateX(${offsetPx}px)`
      else if (direction === 'left') transform = `translateX(${-offsetPx}px)`
      else if (direction === 'down') transform = `translateY(${offsetPx}px)`

      el.style.transition = `transform ${halfDuration}ms ease-in-out`
      el.style.transform = transform

      // Return to original position after half duration
      const returnTimeout = setTimeout(() => {
        el.style.transition = `transform ${halfDuration}ms ease-in-out`
        el.style.transform = ''
        cleanupTimeoutsRef.current.delete(returnTimeout)
      }, halfDuration)
      cleanupTimeoutsRef.current.add(returnTimeout)

      // Clean up transition property after full duration
      const cleanTransitionTimeout = setTimeout(() => {
        el.style.transition = ''
        slidesInProgressRef.current.delete(slide.robotId)
        cleanupTimeoutsRef.current.delete(cleanTransitionTimeout)
      }, durationMs + 50)
      cleanupTimeoutsRef.current.add(cleanTransitionTimeout)
    }

    // Add new effects to state (hit effects and damage numbers rendered by framer-motion)
    if (newHitEffects.length > 0) setActiveHitEffects((prev) => [...prev, ...newHitEffects])
    if (newDamageNumbers.length > 0) setActiveDamageNumbers((prev) => [...prev, ...newDamageNumbers])

    // Schedule cleanup for hit effects (fixed 150ms + CLEANUP_DELAY_MS)
    for (const hit of newHitEffects) {
      scheduleCleanup(hit.id, 'hit', hit.effect.durationMs + CLEANUP_DELAY_MS)
    }

    // Schedule cleanup for damage numbers
    for (const dmg of newDamageNumbers) {
      scheduleCleanup(dmg.id, 'damage', dmg.effect.durationMs + CLEANUP_DELAY_MS)
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
        {/* Hit effect SVGs */}
        {activeHitEffects.map((hitItem) => {
          const targetBounds = getTargetBounds(hitItem.targetId)
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
          const targetBounds = getTargetBounds(dmgItem.targetId)
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
