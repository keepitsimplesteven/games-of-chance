/**
 * Bug Condition Exploration Tests — Projectile Opacity and Premature HP Application
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5**
 *
 * CRITICAL: These tests encode the EXPECTED (correct) behavior.
 * On UNFIXED code, they MUST FAIL — failure confirms the bugs exist.
 * DO NOT fix the code or tests when they fail.
 *
 * Bug Condition: isBugCondition(input) where tickEntry.attacks.length > 0
 *   AND (opacityTransitionMissing(phase) OR hpAppliedBeforeImpact(tickEntry))
 *
 * Expected Behavior:
 *   - Exit phase: animate.opacity === 0 (fade-out as projectile leaves attacker)
 *   - Travel phase: initial.opacity === 0, animate.opacity === 1 (fade-in approaching target)
 *   - hpStates only updates after onImpact fires (not on tick)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React, { createRef } from 'react'

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
  const ref1 = createRef<HTMLDivElement>()
  const ref2 = createRef<HTMLDivElement>()
  return {
    'player-1': ref1,
    'player-2': ref2,
  }
}

function createMockRobotSvgRefs(): Record<string, React.RefObject<HTMLDivElement>> {
  const ref1 = createRef<HTMLDivElement>()
  const ref2 = createRef<HTMLDivElement>()
  return {
    'player-1': ref1,
    'player-2': ref2,
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
    // Robot 1 placeholder (attacker)
    React.createElement('div', {
      ref: robotSvgRefs['player-1'],
      style: { position: 'absolute', left: 50, top: 200, width: 80, height: 120 },
      'data-testid': 'robot-svg-player-1',
    }),
    // Robot 2 placeholder (target)
    React.createElement('div', {
      ref: robotSvgRefs['player-2'],
      style: { position: 'absolute', left: 600, top: 200, width: 80, height: 120 },
      'data-testid': 'robot-svg-player-2',
    }),
    // The AnimationLayer under test
    React.createElement(AnimationLayer, {
      ...props,
      robotRefs,
      robotSvgRefs,
    } as AnimationLayerProps)
  )
}

// ── Tests ──

describe('Bug Condition Exploration: Projectile Opacity and Premature HP', () => {
  let robotRefs: Record<string, React.RefObject<HTMLDivElement>>
  let robotSvgRefs: Record<string, React.RefObject<HTMLDivElement>>

  beforeEach(() => {
    motionDivCalls = []
    robotRefs = createMockRobotRefs()
    robotSvgRefs = createMockRobotSvgRefs()

    // Mock getBoundingClientRect for all elements
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const testId = this.getAttribute('data-testid')
      if (testId === 'robot-svg-player-1') {
        return {
          x: 50,
          y: 200,
          left: 50,
          top: 200,
          width: 80,
          height: 120,
          right: 130,
          bottom: 320,
        } as DOMRect
      }
      if (testId === 'robot-svg-player-2') {
        return {
          x: 600,
          y: 200,
          left: 600,
          top: 200,
          width: 80,
          height: 120,
          right: 680,
          bottom: 320,
        } as DOMRect
      }
      // Default for animation-layer overlay
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
      } as DOMRect
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test 1a — Exit opacity bug
   *
   * Render AnimationLayer with a tick containing one attack.
   * Assert the exit-phase motion.div animates opacity from 1 → 0 over exitDurationMs.
   *
   * On UNFIXED code: exit phase has animate.opacity === 1 (no fade-out) → test FAILS
   * Expected behavior: animate.opacity === 0
   */
  it('1a — Exit phase should animate opacity from 1 to 0 (fade-out)', () => {
    const tickEntry = createMockTickEntry()
    const props: Omit<AnimationLayerProps, 'robotRefs' | 'robotSvgRefs'> = {
      tickEntry,
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
    }

    render(
      React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs })
    )

    // Find the exit-phase motion.div — it's the first projectile rendered
    // The exit phase should have initial.opacity = 1 and animate.opacity = 0
    const exitPhaseCalls = motionDivCalls.filter(
      (call) =>
        call.initial &&
        typeof call.initial === 'object' &&
        'opacity' in call.initial &&
        call.initial.opacity === 1 &&
        'left' in (call.animate as Record<string, unknown>)
    )

    expect(exitPhaseCalls.length).toBeGreaterThan(0)

    // The exit phase SHOULD fade opacity from 1 → 0
    // Bug: animate.opacity is 1 (no fade-out)
    // Expected: animate.opacity is 0
    const exitPhase = exitPhaseCalls[0]
    expect(exitPhase.animate).toHaveProperty('opacity', 0)
  })

  /**
   * Test 1b — Travel opacity bug
   *
   * Render AnimationLayer with a tick containing one attack.
   * Advance projectile to travel phase by triggering exit/delay onAnimationComplete.
   * Assert travel-phase motion.div has initial.opacity === 0 and animate.opacity === 1.
   *
   * On UNFIXED code: travel phase has initial.opacity === 1 (no fade-in) → test FAILS
   * Expected behavior: initial.opacity === 0, animate.opacity === 1
   */
  it('1b — Travel phase should animate opacity from 0 to 1 (fade-in)', async () => {
    const tickEntry = createMockTickEntry()
    const props: Omit<AnimationLayerProps, 'robotRefs' | 'robotSvgRefs'> = {
      tickEntry,
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
    }

    const { rerender } = render(
      React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs })
    )

    // Advance past exit phase by calling onAnimationComplete on exit-phase motion.div
    const exitPhaseCall = motionDivCalls.find(
      (call) =>
        call.initial &&
        typeof call.initial === 'object' &&
        'opacity' in call.initial &&
        call.initial.opacity === 1 &&
        'left' in (call.animate as Record<string, unknown>) &&
        call.onAnimationComplete
    )

    expect(exitPhaseCall).toBeDefined()

    // Trigger exit phase completion → transitions to delay phase
    act(() => {
      exitPhaseCall!.onAnimationComplete!()
    })

    // Clear and re-render to capture delay phase
    motionDivCalls = []
    rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

    // Find the delay phase (opacity 0 → 0)
    const delayPhaseCall = motionDivCalls.find(
      (call) =>
        call.initial &&
        typeof call.initial === 'object' &&
        'opacity' in call.initial &&
        call.initial.opacity === 0 &&
        call.animate &&
        typeof call.animate === 'object' &&
        'opacity' in call.animate &&
        call.animate.opacity === 0 &&
        call.onAnimationComplete
    )

    expect(delayPhaseCall).toBeDefined()

    // Trigger delay phase completion → transitions to travel phase
    act(() => {
      delayPhaseCall!.onAnimationComplete!()
    })

    // Clear and re-render to capture travel phase
    motionDivCalls = []
    rerender(React.createElement(TestWrapper, { props, robotRefs, robotSvgRefs }))

    // Find travel phase — has position animation (left/top) with opacity
    const travelPhaseCalls = motionDivCalls.filter(
      (call) =>
        call.initial &&
        typeof call.initial === 'object' &&
        'left' in call.initial &&
        'opacity' in call.initial &&
        call.animate &&
        typeof call.animate === 'object' &&
        'left' in call.animate
    )

    expect(travelPhaseCalls.length).toBeGreaterThan(0)

    const travelPhase = travelPhaseCalls[0]

    // Travel phase SHOULD fade opacity from 0 → 1
    // Bug: initial.opacity is 1 (no fade-in)
    // Expected: initial.opacity is 0
    expect(travelPhase.initial).toHaveProperty('opacity', 0)
    expect(travelPhase.animate).toHaveProperty('opacity', 1)
  })

  /**
   * Test 1c — Premature HP bug
   *
   * Render ReplayBattleArena with a tick log containing one attack (targetHpAfter < maxHp).
   * After the tick fires but before any animation completes, assert hpStates has NOT
   * yet been updated.
   *
   * On UNFIXED code: hpStates updates immediately in processTick → test FAILS
   * Expected behavior: HP should remain at maxHp until onImpact fires
   */
  it('1c — HP should NOT be updated until projectile impact (deferred HP)', async () => {
    // We test this by checking if the HP bar shows damage immediately after tick fires.
    // Import ReplayBattleArena separately
    const { ReplayBattleArena } = await import('../../ReplayBattleArena')

    const tickLog: TickEntry[] = [
      {
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

    const onComplete = vi.fn()

    // Use fake timers to control tick playback
    vi.useFakeTimers()

    render(
      React.createElement(ReplayBattleArena, {
        tickLogPayload,
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        currentPlayerId: 'player-1',
        onComplete,
      })
    )

    // The ReplayController fires first tick immediately on start().
    // After that, processTick is called synchronously.
    // In the buggy code, HP is updated immediately in processTick.
    // In the fixed code, HP should remain at 100 until projectile impact callback fires.

    // Check HP bars — player-2 should NOT show damage yet
    const hpBars = screen.getAllByTestId('hp-bar')
    // Find player-2's HP bar — it should still show maxHp (100) if HP is deferred
    const player2HpBar = hpBars.find((bar) => bar.getAttribute('data-hp') === '85')

    // Bug: HP bar immediately shows 85 (damage applied)
    // Expected: HP bar should still show 100 (deferred until impact)
    expect(player2HpBar).toBeUndefined()

    // All HP bars should show 100 (no damage applied yet)
    const allAt100 = hpBars.every((bar) => bar.getAttribute('data-hp') === '100')
    expect(allAt100).toBe(true)

    vi.useRealTimers()
  })

  /**
   * Test 1d — Premature elimination bug
   *
   * Render ReplayBattleArena with a tick containing an elimination.
   * Assert the robot is NOT marked eliminated until projectile impact.
   *
   * On UNFIXED code: eliminated is set immediately in processTick → test FAILS
   * Expected behavior: robot remains visible until killing blow projectile impacts
   */
  it('1d — Elimination should NOT be applied until projectile impact', async () => {
    const { ReplayBattleArena } = await import('../../ReplayBattleArena')

    const tickLog: TickEntry[] = [
      {
        tick: 1,
        attacks: [
          {
            attackerId: 'player-1',
            targetId: 'player-2',
            hit: true,
            damage: 100,
            targetHpAfter: 0,
          },
        ],
        eliminations: ['player-2'],
        energyStates: { 'player-1': 50, 'player-2': 0 },
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

    render(
      React.createElement(ReplayBattleArena, {
        tickLogPayload,
        playerNames: { 'player-1': 'Alice', 'player-2': 'Bob' },
        currentPlayerId: 'player-1',
      })
    )

    // After first tick fires (immediately), in buggy code the elimination is applied
    // and the robot shows "DEFEATED" text and 0 HP immediately.
    // In fixed code, elimination should be deferred until projectile impact.

    // Check that "DEFEATED" text does NOT appear yet
    const defeatedText = screen.queryByText('DEFEATED')

    // Bug: "DEFEATED" appears immediately
    // Expected: "DEFEATED" should NOT appear until projectile impact
    expect(defeatedText).toBeNull()

    // Check HP bar for player-2 should NOT show 0
    const hpBars = screen.getAllByTestId('hp-bar')
    const zeroHpBar = hpBars.find((bar) => bar.getAttribute('data-hp') === '0')

    // Bug: HP shows 0 immediately
    // Expected: HP should remain at 100 until impact
    expect(zeroHpBar).toBeUndefined()

    vi.useRealTimers()
  })
})
