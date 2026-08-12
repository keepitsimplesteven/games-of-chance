import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ReplayController, type TickEntry } from "./ReplayController"

function makeTickLog(count: number): TickEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    tick: i + 1,
    attacks: [
      {
        attackerId: "p1",
        targetId: "p2",
        hit: true,
        damage: 10,
        targetHpAfter: 100 - (i + 1) * 10,
      },
    ],
    eliminations: i === count - 1 ? ["p2"] : [],
  }))
}

describe("ReplayController", () => {
  let controller: ReplayController

  beforeEach(() => {
    vi.useFakeTimers()
    controller = new ReplayController()
  })

  afterEach(() => {
    controller.destroy()
    vi.useRealTimers()
  })

  it("initializes with default state", () => {
    const state = controller.getCurrentState()
    expect(state.tickLog).toEqual([])
    expect(state.currentTickIndex).toBe(0)
    expect(state.gameSpeed).toBe(50)
    expect(state.isPlaying).toBe(false)
    expect(state.isComplete).toBe(false)
  })

  it("starts playback and fires the first tick immediately", () => {
    const tickLog = makeTickLog(5)
    const cb = vi.fn()
    controller.onTick(cb)

    controller.start(tickLog, 100)

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(tickLog[0], 0)

    const state = controller.getCurrentState()
    expect(state.isPlaying).toBe(true)
    expect(state.isComplete).toBe(false)
    expect(state.gameSpeed).toBe(100)
  })

  it("advances through ticks at gameSpeed interval", () => {
    const tickLog = makeTickLog(3)
    const cb = vi.fn()
    controller.onTick(cb)

    controller.start(tickLog, 100)
    expect(cb).toHaveBeenCalledTimes(1) // first tick fired immediately

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(tickLog[1], 1)

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(3)
    expect(cb).toHaveBeenLastCalledWith(tickLog[2], 2)
  })

  it("marks isComplete when reaching end of tickLog", () => {
    const tickLog = makeTickLog(2)
    controller.start(tickLog, 50)

    vi.advanceTimersByTime(50) // advances to index 1 (last)

    const state = controller.getCurrentState()
    expect(state.isComplete).toBe(true)
    expect(state.isPlaying).toBe(false)
  })

  it("does not advance past the end", () => {
    const tickLog = makeTickLog(2)
    const cb = vi.fn()
    controller.onTick(cb)
    controller.start(tickLog, 100)

    vi.advanceTimersByTime(500) // way past the end

    // Only called for tick 0 (immediate) + tick 1 (one interval)
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it("stop() pauses playback without resetting position", () => {
    const tickLog = makeTickLog(5)
    controller.start(tickLog, 100)

    vi.advanceTimersByTime(200) // index should be 2
    controller.stop()

    const state = controller.getCurrentState()
    expect(state.isPlaying).toBe(false)
    expect(state.currentTickIndex).toBe(2)

    // No further advances
    vi.advanceTimersByTime(500)
    expect(controller.getCurrentState().currentTickIndex).toBe(2)
  })

  it("onTick returns an unsubscribe function", () => {
    const tickLog = makeTickLog(3)
    const cb = vi.fn()
    const unsub = controller.onTick(cb)

    controller.start(tickLog, 100)
    expect(cb).toHaveBeenCalledTimes(1)

    unsub()

    vi.advanceTimersByTime(100)
    // Should not have been called again
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it("jumpToTick sets position for reconnect resume", () => {
    const tickLog = makeTickLog(10)
    const cb = vi.fn()
    controller.onTick(cb)

    controller.start(tickLog, 100)
    cb.mockClear()

    controller.jumpToTick(5)

    const state = controller.getCurrentState()
    expect(state.currentTickIndex).toBe(5)
    expect(cb).toHaveBeenCalledWith(tickLog[5], 5)
  })

  it("jumpToTick ignores out-of-bounds indices", () => {
    const tickLog = makeTickLog(5)
    controller.start(tickLog, 100)

    controller.jumpToTick(-1)
    expect(controller.getCurrentState().currentTickIndex).toBe(0)

    controller.jumpToTick(99)
    expect(controller.getCurrentState().currentTickIndex).toBe(0)
  })

  it("jumpToTick to last index marks isComplete", () => {
    const tickLog = makeTickLog(5)
    controller.start(tickLog, 100)

    controller.jumpToTick(4) // last index

    const state = controller.getCurrentState()
    expect(state.isComplete).toBe(true)
  })

  it("handles empty tickLog gracefully", () => {
    controller.start([], 100)

    const state = controller.getCurrentState()
    expect(state.isPlaying).toBe(false)
    expect(state.isComplete).toBe(true)
  })

  it("handles single-tick tickLog", () => {
    const tickLog = makeTickLog(1)
    const cb = vi.fn()
    controller.onTick(cb)

    controller.start(tickLog, 100)

    expect(cb).toHaveBeenCalledTimes(1)
    const state = controller.getCurrentState()
    expect(state.isComplete).toBe(true)
    expect(state.isPlaying).toBe(false)
  })

  it("destroy() clears interval and callbacks", () => {
    const tickLog = makeTickLog(10)
    const cb = vi.fn()
    controller.onTick(cb)
    controller.start(tickLog, 100)
    cb.mockClear()

    controller.destroy()

    vi.advanceTimersByTime(1000)
    expect(cb).not.toHaveBeenCalled()
    expect(controller.getCurrentState().isPlaying).toBe(false)
  })

  it("getCurrentState returns a snapshot (not a reference)", () => {
    const tickLog = makeTickLog(3)
    controller.start(tickLog, 100)

    const state1 = controller.getCurrentState()
    vi.advanceTimersByTime(100)
    const state2 = controller.getCurrentState()

    expect(state1.currentTickIndex).toBe(0)
    expect(state2.currentTickIndex).toBe(1)
  })

  it("respects custom gameSpeed", () => {
    const tickLog = makeTickLog(5)
    const cb = vi.fn()
    controller.onTick(cb)

    controller.start(tickLog, 200)

    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledTimes(1) // only the immediate first tick

    vi.advanceTimersByTime(100) // now 200ms total
    expect(cb).toHaveBeenCalledTimes(2) // second tick fires
  })
})
