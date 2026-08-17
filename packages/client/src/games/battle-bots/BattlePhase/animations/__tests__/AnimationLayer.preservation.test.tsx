/**
 * Preservation Property Tests — Position Animation, Hit Effects, Final HP Values, and Fast-Speed Clamping
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * These tests encode EXISTING correct behavior that MUST be preserved.
 * On UNFIXED code, they MUST PASS — confirming baseline behavior to protect against regressions.
 *
 * Preservation Properties:
 *   - Exit phase moves from attackerOrigin to attackerExit positionally (30% gameSpeed)
 *   - Travel phase moves from targetEntry to targetImpact positionally (50% gameSpeed)
 *   - handleProjectileImpact triggers hit effects and damage numbers for hits
 *   - Fast-speed clamping applies 0.9 factor when gameSpeed < 150ms
 *   - Projectile creation skipped when attacker or target is eliminated
 *   - Final HP values equal attack.targetHpAfter from tick data
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React, { createRef } from 'react'
import * as fc from 'fast-check'

// ── Track motion.div props for inspection ──

interface MotionDivCall {
  initial: Record<string, unknown>
  animate: Record<string, unknown>
  transition: Record<string, unknown>
  onAnimationComplete?: () => void
  style: Record<string, unknown>
  key?: string
}

let motionDivCalls: MotionDivCall[] = []

// Mock framer-motion to capture props passed to motion.div
vi.mock('framer-motion', () => {
  const React = require('react')

  const MotionDiv = React.forwardRef(function MotionDiv(
    props: Record<string, unknown>,
    ref: React.Ref<HTMLDivElement>
  ) {
    const { initial, animate, transition, onAnimationComplete, style, children, ...rest } =
      props as any

    // Record each motion.div render for inspection
    motionDivCalls.push({
      initial: initial ?? {},
      animate: animate ?? {},
      transition: transition ?? {},
      onAnimationComplete,
      style: style ?? {},
      key: rest.key,
    })

    return React.createElement(
      'div',
      {
        ref,
        style,
        'data-testid': rest['data-testid'],
        'data-motion-initial': JSON.stringify(initial),
        'data-motion-animate': JSON.stringify(animate),
      },
      children
    )
  })

  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

// Mock the theme module
vi.mock('../../../../../theme', () => ({
  useTheme: () => ({
    card: 'mock-card',
    accentText: 'mock-accent',
    bodyText: 'mock-body',
    mutedText: 'mock-muted',
    statusDanger: 'mock-danger',
    page: 'mock-page',
    font: 'mock-font',
    btnPrimary: 'mock-btn',
  }),
}))

// Mock child components to avoid deep rendering
vi.mock('../../../assets/RobotParts', () => ({
  CompositeRobot: ({ config, size, className }: any) =>
    React.createElement('div', { 'data-testid': `robot-${config.color}`, className }),
}))

vi.mock('../../../PrepPhase/StarDisplay', () => ({
  StarDisplay: () => React.createElement('div', { 'data-testid': 'star-display' }),
}))

vi.mock('../../HPBar', () => ({
  HPBar: ({ currentHp, maxHp }: any) =>
    React.createElement('div', { 'data-testid': 'hp-bar', 'data-hp': currentHp, 'data-max': maxHp }),
}))

vi.mock('../../EnergyBar', () => ({
  EnergyBar: () => React.createElement('div', { 'data-testid': 'energy-bar' }),
}))

import { AnimationLayer } from '../AnimationLayer'
import type { AnimationLayerProps } from '../types'
import type { TickEntry } from '../../ReplayController'
import { computeProjectilePhases } from '../ProjectileEngine'
import { ANIMATION_CONSTANTS } from '../constants'

// ── Test Fixtures ──

function createMockTickEntry(overrides: Partial<TickEntry> = {}): TickEntry {
  return {
    tick: 1,
    attacks: [
      {
        attackerId: 'player-1',
        targetId: 'player-2',
        hit: true,
        damage: 15,
        targetHpAfter: 85,
      },
    ],
    eliminations: [],
    energyStates: { 'player-1': 50, 'player-2': 50 },
    ...overrides,
  }
}

function createMockRobotRefs(): Record<string, React.RefObject<HTMLDivElement>> {
  return {
    'player-1': createRef<HTMLDivElement>(),
    'player-2': createRef<HTMLDivElement>(),
  }
}

function createMockRobotSvgRefs(): Record<string, React.RefObject<HTMLDivElement>> {
  return {
    'player-1': createRef<HTMLDivElement>(),
    'player-2': createRef<HTMLDivElement>(),
  }
}

/**
 * Wrapper component that provides DOM elements with getBoundingClientRect
 * so that AnimationLayer can compute bounds.
 */
function TestWrapper({
  props,
  robotRefs,
  robotSvgRefs,
}: {
  props: Omit<AnimationLayerProps, 'robotRefs' | 'robotSvgRefs'>
  robotRefs: Record<string, React.RefObject<HTMLDivElement>>
  robotSvgRefs: Record<string, React.RefObject<HTMLDivElement>>
}) {
  return React.createElement(
    'div',
    { style: { position: 'relative', width: 800, height: 600 } },
    React.createElement('div', {
      ref: robotSvgRefs['player-1'],
      style: { position: 'absolute', left: 50, top: 200, width: 80, height: 120 },
      'data-testid': 'robot-svg-player-1',
    }),
    React.createElement('div', {
      ref: robotSvgRefs['player-2'],
      style: { position: 'absolute', left: 600, top: 200, width: 80, height: 120 },
      'data-testid': 'robot-svg-player-2',
    }),
    React.createElement(AnimationLayer, {
      ...props,
      robotRefs,
      robotSvgRefs,
    } as AnimationLayerProps)
  )
}

function defaultProps(overrides: Partial<Omit<AnimationLayerProps, 'robotRefs' | 'robotSvgRefs'>> = {}): Omit<AnimationLayerProps, 'robotRefs' | 'robotSvgRefs'> {
  return {
    tickEntry: createMockTickEntry(),
    hpStates: {
      'player-1': { currentHp: 100, maxHp: 100, eliminated: false },
      'player-2': { currentHp: 100, maxHp: 100, eliminated: false },
    },
    robots: [
      {
        ownerId: 'player-1',
        visual: { weapon: 'blaster', head: 'square', body: 'square', color: '#e53935' },
      },
      {
        ownerId: 'player-2',
        visual: { weapon: 'drill', head: 'square', body: 'square', color: '#1e88e5' },
      },
    ],
    robotColors: { 'player-1': '#e53935', 'player-2': '#1e88e5' },
    gameSpeed: 300,
    isPlaying: true,
    isComplete: false,
    mode: '1v1',
    robotColumns: { 'player-1': 0, 'player-2': 1 },
    ...overrides,
  }
}

function setupBoundingClientRectMock() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const testId = this.getAttribute('data-testid')
    if (testId === 'robot-svg-player-1') {
      return {
        x: 50, y: 200, left: 50, top: 200, width: 80, height: 120, right: 130, bottom: 320,
      } as DOMRect
    }
    if (testId === 'robot-svg-player-2') {
      return {
        x: 600, y: 200, left: 600, top: 200, width: 80, height: 120, right: 680, bottom: 320,
      } as DOMRect
    }
    return {
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
    } as DOMRect
  })
}

// ── Tests ──

describe('Preservation Property Tests: Position Animation, Hit Effects, HP Values, Fast-Speed Clamping', () => {
  let robotRefs: Record<string, React.RefObject<HTMLDivElement>>
  let robotSvgRefs: Record<string, React.RefObject<HTMLDivElement>>

  beforeEach(() => {
    motionDivCalls = []
    robotRefs = createMockRobotRefs()
    robotSvgRefs = createMockRobotSvgRefs()
    setupBoundingClientRectMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Fast-Speed Clamping (pure function — ideal for fast-check)
  // Validates: Requirement 3.4
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Phase duration computation with fast-speed clamping', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For all gameSpeed values, exit duration === effective * 0.3,
     * delay === effective * 0.2, travel === effective * 0.5
     * where effective = gameSpeed * 0.9 when gameSpeed < 150ms, else gameSpeed
     */
    it('computes correct phase split for all gameSpeed values (property-based)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 2000 }),
          (gameSpeed) => {
            const phases = computeProjectilePhases(gameSpeed)
            const effective =
              gameSpeed < ANIMATION_CONSTANTS.FAST_SPEED_THRESHOLD_MS
                ? gameSpeed * ANIMATION_CONSTANTS.FAST_SPEED_CLAMP_FACTOR
                : gameSpeed

            // 30% exit, 20% delay, 50% travel
            expect(phases.exitDurationMs).toBeCloseTo(effective * 0.3, 5)
            expect(phases.delayMs).toBeCloseTo(effective * 0.2, 5)
            expect(phases.travelDurationMs).toBeCloseTo(effective * 0.5, 5)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('applies 0.9 clamping factor when gameSpeed < 150ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 149 }),
          (gameSpeed) => {
            const phases = computeProjectilePhases(gameSpeed)
            const clamped = gameSpeed * 0.9
            const total = phases.exitDurationMs + phases.delayMs + phases.travelDurationMs
            expect(total).toBeCloseTo(clamped, 5)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does NOT apply clamping when gameSpeed >= 150ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 150, max: 2000 }),
          (gameSpeed) => {
            const phases = computeProjectilePhases(gameSpeed)
            const total = phases.exitDurationMs + phases.delayMs + phases.travelDurationMs
            expect(total).toBeCloseTo(gameSpeed, 5)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Exit phase position animation
  // Validates: Requirement 3.1
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Exit phase position animation from attackerOrigin to attackerExit', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For all ticks with attacks, exit phase position animates
     * from attackerOrigin to attackerExit with correct duration.
     */
    it('exit phase animates position from attackerOrigin to attackerExit', () => {
      const props = defaultProps()

      render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Find exit-phase motion.div — has position animation with initial left/top
      const exitPhaseCalls = motionDivCalls.filter(
        (call) =>
          call.initial &&
          typeof call.initial === 'object' &&
          'left' in call.initial &&
          'top' in call.initial &&
          call.animate &&
          typeof call.animate === 'object' &&
          'left' in call.animate &&
          'top' in call.animate &&
          call.transition &&
          typeof call.transition === 'object' &&
          'ease' in call.transition &&
          call.transition.ease === 'linear' &&
          call.onAnimationComplete != null
      )

      expect(exitPhaseCalls.length).toBeGreaterThan(0)
      const exitPhase = exitPhaseCalls[0]

      // Attacker (player-1) is left side (column 0): origin at right edge, exit further right
      // Based on computeAttackerPoints for side='left':
      // origin.x = attackerBounds.x + width = 50 + 80 = 130
      // origin.y = attackerBounds.y + height/2 = 200 + 60 = 260
      // exit.x = origin.x + width * 0.3 = 130 + 24 = 154
      // exit.y = origin.y = 260
      // motion.div is 8x8 centered, so left = x - 4, top = y - 4
      expect(exitPhase.initial).toHaveProperty('left', 130 - 4)
      expect(exitPhase.initial).toHaveProperty('top', 260 - 4)
      expect(exitPhase.animate).toHaveProperty('left', 154 - 4)
      expect(exitPhase.animate).toHaveProperty('top', 260 - 4)
    })

    it('exit phase uses correct duration (30% of gameSpeed)', () => {
      const gameSpeed = 300
      const props = defaultProps({ gameSpeed })

      render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      const exitPhaseCalls = motionDivCalls.filter(
        (call) =>
          call.initial &&
          typeof call.initial === 'object' &&
          'left' in call.initial &&
          call.animate &&
          typeof call.animate === 'object' &&
          'left' in call.animate &&
          call.transition &&
          typeof call.transition === 'object' &&
          'duration' in call.transition
      )

      expect(exitPhaseCalls.length).toBeGreaterThan(0)
      const exitPhase = exitPhaseCalls[0]

      // Expected: 300 * 0.3 / 1000 = 0.09s
      const expectedDuration = (gameSpeed * 0.3) / 1000
      expect(exitPhase.transition).toHaveProperty('duration', expectedDuration)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Travel phase position animation
  // Validates: Requirement 3.2
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Travel phase position animation from targetEntry to targetImpact', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For all ticks with attacks, travel phase position animates
     * from targetEntry to targetImpact with correct duration.
     */
    it('travel phase animates position from targetEntry to targetImpact', () => {
      const props = defaultProps()

      const { rerender } = render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Advance past exit phase
      const exitPhaseCall = motionDivCalls.find(
        (call) =>
          call.initial &&
          typeof call.initial === 'object' &&
          'left' in call.initial &&
          call.onAnimationComplete
      )
      expect(exitPhaseCall).toBeDefined()
      act(() => { exitPhaseCall!.onAnimationComplete!() })

      // After advancing to delay phase, rerender to capture it
      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Find delay phase — the delay phase renders with style opacity:0 and has onAnimationComplete
      // In the unfixed code, delay phase uses style={{ opacity: 0 }} and initial/animate both { opacity: 0 }
      const delayPhaseCall = motionDivCalls.find(
        (call) =>
          call.style &&
          typeof call.style === 'object' &&
          'opacity' in call.style &&
          call.style.opacity === 0 &&
          call.onAnimationComplete
      )
      expect(delayPhaseCall).toBeDefined()
      act(() => { delayPhaseCall!.onAnimationComplete!() })

      // Capture travel phase
      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Find travel phase — has position animation with left/top and linear ease
      const travelPhaseCalls = motionDivCalls.filter(
        (call) =>
          call.initial &&
          typeof call.initial === 'object' &&
          'left' in call.initial &&
          'top' in call.initial &&
          call.animate &&
          typeof call.animate === 'object' &&
          'left' in call.animate &&
          'top' in call.animate &&
          call.transition &&
          typeof call.transition === 'object' &&
          'ease' in call.transition &&
          call.transition.ease === 'linear'
      )

      expect(travelPhaseCalls.length).toBeGreaterThan(0)
      const travelPhase = travelPhaseCalls[0]

      // Target (player-2) is right side (column 1): entry from left of target
      // Based on computeTargetEntry for side='right':
      // entry.x = targetBounds.x - width * 1.5 = 600 - 120 = 480
      // entry.y = targetBounds.y + height/2 = 200 + 60 = 260
      // Impact is at a random position within target bounds, but we verify it's within bounds
      expect(travelPhase.initial).toHaveProperty('left', 480 - 4)
      expect(travelPhase.initial).toHaveProperty('top', 260 - 4)

      // Impact point should be within target area (x: 600-680, y: 200-320) minus 4px centering
      const animateLeft = travelPhase.animate['left'] as number
      const animateTop = travelPhase.animate['top'] as number
      expect(animateLeft).toBeGreaterThanOrEqual(600 - 4 - 1) // -1 for float tolerance
      expect(animateLeft).toBeLessThanOrEqual(680 - 4 + 1)
      expect(animateTop).toBeGreaterThanOrEqual(200 - 4 - 1)
      expect(animateTop).toBeLessThanOrEqual(320 - 4 + 1)
    })

    it('travel phase uses correct duration (50% of gameSpeed)', () => {
      const gameSpeed = 300
      const props = defaultProps({ gameSpeed })

      const { rerender } = render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Advance to travel phase
      const exitPhaseCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'left' in call.initial && call.onAnimationComplete
      )
      expect(exitPhaseCall).toBeDefined()
      act(() => { exitPhaseCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Find delay phase via style opacity
      const delayPhaseCall = motionDivCalls.find(
        (call) =>
          call.style && typeof call.style === 'object' && 'opacity' in call.style &&
          call.style.opacity === 0 && call.onAnimationComplete
      )
      expect(delayPhaseCall).toBeDefined()
      act(() => { delayPhaseCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      const travelPhaseCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' && 'left' in call.initial &&
          call.transition && typeof call.transition === 'object' && 'duration' in call.transition &&
          call.transition.ease === 'linear'
      )

      expect(travelPhaseCalls.length).toBeGreaterThan(0)
      const travelPhase = travelPhaseCalls[0]

      // Expected: 300 * 0.5 / 1000 = 0.15s
      const expectedDuration = (gameSpeed * 0.5) / 1000
      expect(travelPhase.transition).toHaveProperty('duration', expectedDuration)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Hit effects and damage numbers triggered on impact
  // Validates: Requirements 3.3
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Hit effects and damage numbers triggered after projectile impact', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For all attacks where hit === true, hit effect SVG is rendered after impact.
     * For all attacks where hit === true and damage > 0, floating damage number appears.
     */
    it('hit effect is rendered after travel phase completes for hit attacks', () => {
      const props = defaultProps()

      const { rerender } = render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Advance through exit → delay → travel phases
      const exitCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'left' in call.initial && call.onAnimationComplete
      )
      expect(exitCall).toBeDefined()
      act(() => { exitCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      const delayCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'opacity' in call.initial &&
          call.initial.opacity === 0 && call.animate && typeof call.animate === 'object' &&
          'opacity' in call.animate && call.animate.opacity === 0 && call.onAnimationComplete
      )
      expect(delayCall).toBeDefined()
      act(() => { delayCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Find travel phase and trigger its completion (impact)
      const travelCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'left' in call.initial &&
          call.transition && typeof call.transition === 'object' &&
          call.transition.ease === 'linear' && call.onAnimationComplete
      )
      expect(travelCall).toBeDefined()

      // Trigger impact
      act(() => { travelCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // After impact, should see hit effect (scale animation) and damage number (y animation)
      const hitEffectCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' &&
          'scale' in call.initial && call.initial.scale === 0.8
      )

      // Hit effect should be rendered (for hit === true attack)
      expect(hitEffectCalls.length).toBeGreaterThan(0)
    })

    it('damage number is rendered after travel phase completes for hit attacks with damage > 0', () => {
      const props = defaultProps()

      const { rerender } = render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Advance through all phases to impact
      const exitCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'left' in call.initial && call.onAnimationComplete
      )
      expect(exitCall).toBeDefined()
      act(() => { exitCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      const delayCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'opacity' in call.initial &&
          call.initial.opacity === 0 && call.onAnimationComplete
      )
      expect(delayCall).toBeDefined()
      act(() => { delayCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      const travelCall = motionDivCalls.find(
        (call) => call.initial && typeof call.initial === 'object' && 'left' in call.initial &&
          call.transition && typeof call.transition === 'object' &&
          call.transition.ease === 'linear' && call.onAnimationComplete
      )
      expect(travelCall).toBeDefined()
      act(() => { travelCall!.onAnimationComplete!() })

      motionDivCalls = []
      rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Damage numbers animate y from 0 → -50 with opacity fade
      const dmgNumberCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' &&
          'y' in call.initial && call.initial.y === 0 &&
          call.animate && typeof call.animate === 'object' &&
          'y' in call.animate && (call.animate.y as number) < 0
      )

      expect(dmgNumberCalls.length).toBeGreaterThan(0)
    })

    it('no hit effect or damage number before impact (during exit/delay/travel phases)', () => {
      const props = defaultProps()

      render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Check immediately after render (exit phase) — should have no hit effects or damage numbers
      const hitEffectCalls = motionDivCalls.filter(
        (call) => call.initial && typeof call.initial === 'object' && 'scale' in call.initial
      )
      const dmgCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' &&
          'y' in call.initial && call.initial.y === 0 &&
          call.animate && typeof call.animate === 'object' && 'y' in call.animate
      )

      expect(hitEffectCalls.length).toBe(0)
      expect(dmgCalls.length).toBe(0)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Eliminated robots skipped for projectile creation
  // Validates: Requirement 3.5
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Eliminated robots are skipped for projectile creation', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For eliminated robots, no new projectiles are created.
     */
    it('no projectile created when attacker is eliminated', () => {
      const props = defaultProps({
        hpStates: {
          'player-1': { currentHp: 0, maxHp: 100, eliminated: true },
          'player-2': { currentHp: 100, maxHp: 100, eliminated: false },
        },
      })

      render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Should have no projectile motion.divs (no position animation with left/top)
      const projectileCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' && 'left' in call.initial &&
          call.animate && typeof call.animate === 'object' && 'left' in call.animate
      )

      expect(projectileCalls.length).toBe(0)
    })

    it('no projectile created when target is eliminated', () => {
      const props = defaultProps({
        hpStates: {
          'player-1': { currentHp: 100, maxHp: 100, eliminated: false },
          'player-2': { currentHp: 0, maxHp: 100, eliminated: true },
        },
      })

      render(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

      // Should have no projectile motion.divs
      const projectileCalls = motionDivCalls.filter(
        (call) =>
          call.initial && typeof call.initial === 'object' && 'left' in call.initial &&
          call.animate && typeof call.animate === 'object' && 'left' in call.animate
      )

      expect(projectileCalls.length).toBe(0)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Property: Final HP values equal attack.targetHpAfter
  // Validates: Requirement 3.6
  // ──────────────────────────────────────────────────────────────────────────────

  describe('Property: Final HP values equal attack.targetHpAfter from tick data', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * For any tick log, after all projectile impacts resolve, final hpStates values
     * equal attack.targetHpAfter from tick data.
     *
     * With deferred HP, we mock AnimationLayer to call onImpact via useEffect
     * (simulating what happens when projectiles complete their travel phase).
     */
    it('processTick applies correct final HP values (property-based)', async () => {
      // Mock AnimationLayer to fire onImpact for all attacks via useEffect
      vi.doMock('../AnimationLayer', () => {
        const React = require('react')
        return {
          AnimationLayer: ({ tickEntry, onImpact }: any) => {
            React.useEffect(() => {
              if (tickEntry && onImpact) {
                for (const attack of tickEntry.attacks) {
                  onImpact({
                    attackerId: attack.attackerId,
                    targetId: attack.targetId,
                    hit: attack.hit,
                    damage: attack.damage,
                    targetHpAfter: attack.targetHpAfter,
                    isElimination: tickEntry.eliminations?.includes(attack.targetId) ?? false,
                  })
                }
              }
            }, [tickEntry, onImpact])
            return null
          },
        }
      })

      const { ReplayBattleArena } = await import('../../ReplayBattleArena')

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 95 }),
          (damage) => {
            const hpAfter = 100 - damage

            const tickLog: TickEntry[] = [
              {
                tick: 1,
                attacks: [
                  {
                    attackerId: 'player-1',
                    targetId: 'player-2',
                    hit: true,
                    damage,
                    targetHpAfter: hpAfter,
                  },
                ],
                eliminations: [],
                energyStates: { 'player-1': 50, 'player-2': 50 },
              },
            ]

            const tickLogPayload = {
              battleId: 'test-battle',
              robots: [
                {
                  ownerId: 'player-1',
                  name: 'Bot Alpha',
                  stars: { damage: 3, accuracy: 2, speed: 1 },
                  visual: { weapon: 'blaster', head: 'square', body: 'square', color: '#e53935' },
                  maxHp: 100,
                },
                {
                  ownerId: 'player-2',
                  name: 'Bot Beta',
                  stars: { damage: 2, accuracy: 3, speed: 1 },
                  visual: { weapon: 'drill', head: 'square', body: 'square', color: '#1e88e5' },
                  maxHp: 100,
                },
              ],
              tickLog,
              gameSpeed: 300,
            }

            vi.useFakeTimers()

            let getAllByTestId: any
            let unmount: any
            act(() => {
              const result = render(
                React.createElement(ReplayBattleArena, {
                  tickLogPayload,
                  playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
                  currentPlayerId: 'player-1',
                })
              )
              getAllByTestId = result.getAllByTestId
              unmount = result.unmount
            })

            // After impacts resolve (mocked via useEffect), final HP values should match
            const hpBars = getAllByTestId('hp-bar')
            const player2HpBar = hpBars.find(
              (bar: HTMLElement) => bar.getAttribute('data-hp') === String(hpAfter)
            )
            expect(player2HpBar).toBeDefined()

            unmount()
            vi.useRealTimers()
          }
        ),
        { numRuns: 20 }
      )

      vi.doUnmock('../AnimationLayer')
    })

    it('multiple attacks in one tick apply cumulative HP correctly', async () => {
      // Mock AnimationLayer to fire onImpact for all attacks via useEffect
      vi.doMock('../AnimationLayer', () => {
        const React = require('react')
        return {
          AnimationLayer: ({ tickEntry, onImpact }: any) => {
            React.useEffect(() => {
              if (tickEntry && onImpact) {
                for (const attack of tickEntry.attacks) {
                  onImpact({
                    attackerId: attack.attackerId,
                    targetId: attack.targetId,
                    hit: attack.hit,
                    damage: attack.damage,
                    targetHpAfter: attack.targetHpAfter,
                    isElimination: tickEntry.eliminations?.includes(attack.targetId) ?? false,
                  })
                }
              }
            }, [tickEntry, onImpact])
            return null
          },
        }
      })

      const { ReplayBattleArena } = await import('../../ReplayBattleArena')

      const tickLog: TickEntry[] = [
        {
          tick: 1,
          attacks: [
            {
              attackerId: 'player-1',
              targetId: 'player-2',
              hit: true,
              damage: 20,
              targetHpAfter: 80,
            },
            {
              attackerId: 'player-1',
              targetId: 'player-2',
              hit: true,
              damage: 15,
              targetHpAfter: 65,
            },
          ],
          eliminations: [],
          energyStates: { 'player-1': 50, 'player-2': 50 },
        },
      ]

      const tickLogPayload = {
        battleId: 'test-battle',
        robots: [
          {
            ownerId: 'player-1',
            name: 'Bot Alpha',
            stars: { damage: 3, accuracy: 2, speed: 1 },
            visual: { weapon: 'blaster', head: 'square', body: 'square', color: '#e53935' },
            maxHp: 100,
          },
          {
            ownerId: 'player-2',
            name: 'Bot Beta',
            stars: { damage: 2, accuracy: 3, speed: 1 },
            visual: { weapon: 'drill', head: 'square', body: 'square', color: '#1e88e5' },
            maxHp: 100,
          },
        ],
        tickLog,
        gameSpeed: 300,
      }

      vi.useFakeTimers()

      let getAllByTestId: any
      let unmount: any
      act(() => {
        const result = render(
          React.createElement(ReplayBattleArena, {
            tickLogPayload,
            playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
            currentPlayerId: 'player-1',
          })
        )
        getAllByTestId = result.getAllByTestId
        unmount = result.unmount
      })

      // Final HP for player-2 should be 65 (last attack's targetHpAfter after all impacts)
      const hpBars = getAllByTestId('hp-bar')
      const player2HpBar = hpBars.find(
        (bar: HTMLElement) => bar.getAttribute('data-hp') === '65'
      )
      expect(player2HpBar).toBeDefined()

      unmount()
      vi.useRealTimers()
      vi.doUnmock('../AnimationLayer')
    })
  })
})
