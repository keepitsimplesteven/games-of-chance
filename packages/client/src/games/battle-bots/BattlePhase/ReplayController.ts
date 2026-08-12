// ─── Local types (matching server shapes — client can't import server code) ───

/** An individual attack event within a tick */
export interface AttackEvent {
  attackerId: string
  targetId: string
  hit: boolean
  damage: number
  targetHpAfter: number
}

/** A single tick in the battle log */
export interface TickEntry {
  tick: number
  attacks: AttackEvent[]
  eliminations: string[]
}

// ─── Replay State & Callback Types ────────────────────────────────────────────

export interface ReplayState {
  tickLog: TickEntry[]
  currentTickIndex: number
  gameSpeed: number
  isPlaying: boolean
  isComplete: boolean
}

export type TickCallback = (tickEntry: TickEntry, index: number) => void

// ─── ReplayController ─────────────────────────────────────────────────────────

/**
 * Manages client-side tick playback of a pre-computed battle simulation.
 * Pure TypeScript — no React dependency. React components use this via hooks.
 */
export class ReplayController {
  private state: ReplayState
  private intervalId: number | null = null
  private callbacks: TickCallback[] = []

  constructor() {
    this.state = {
      tickLog: [],
      currentTickIndex: 0,
      gameSpeed: 100,
      isPlaying: false,
      isComplete: false,
    }
  }

  /**
   * Begin playback of a tick log at the specified game speed.
   * Starts a setInterval that advances one tick per interval.
   */
  start(tickLog: TickEntry[], gameSpeed: number): void {
    // Clean up any existing interval
    this.clearInterval()

    this.state = {
      tickLog,
      currentTickIndex: 0,
      gameSpeed,
      isPlaying: true,
      isComplete: false,
    }

    // If the tick log is empty, mark as complete immediately
    if (tickLog.length === 0) {
      this.state.isPlaying = false
      this.state.isComplete = true
      return
    }

    // Fire the first tick immediately
    this.fireCurrentTick()

    // Only start interval if there are more ticks to play
    if (tickLog.length > 1) {
      this.intervalId = window.setInterval(() => {
        this.advance()
      }, gameSpeed)
    } else {
      // Single tick — already fired, mark complete
      this.state.isPlaying = false
      this.state.isComplete = true
    }
  }

  /**
   * Pause playback without resetting position.
   */
  stop(): void {
    this.clearInterval()
    this.state.isPlaying = false
  }

  /**
   * Returns an immutable snapshot of the current replay state.
   */
  getCurrentState(): ReplayState {
    return { ...this.state }
  }

  /**
   * Register a tick listener for UI updates.
   * Returns an unsubscribe function.
   */
  onTick(callback: TickCallback): () => void {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback)
    }
  }

  /**
   * Jump to a specific tick index (for reconnect resume).
   * Sets the current position without replaying previous ticks.
   * Does NOT auto-start playback — call start() or resume after jumping.
   */
  jumpToTick(index: number): void {
    if (index < 0 || index >= this.state.tickLog.length) {
      return
    }

    this.state.currentTickIndex = index
    this.state.isComplete = index >= this.state.tickLog.length - 1

    // Fire the callback for the tick we jumped to
    this.fireCurrentTick()
  }

  /**
   * Clean up interval and callbacks (for component unmount).
   */
  destroy(): void {
    this.clearInterval()
    this.callbacks = []
    this.state.isPlaying = false
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private advance(): void {
    const nextIndex = this.state.currentTickIndex + 1

    if (nextIndex >= this.state.tickLog.length) {
      // Reached the end of the tick log
      this.clearInterval()
      this.state.isPlaying = false
      this.state.isComplete = true
      return
    }

    this.state.currentTickIndex = nextIndex
    this.fireCurrentTick()

    // Check if this was the last tick
    if (nextIndex >= this.state.tickLog.length - 1) {
      this.clearInterval()
      this.state.isPlaying = false
      this.state.isComplete = true
    }
  }

  private fireCurrentTick(): void {
    const entry = this.state.tickLog[this.state.currentTickIndex]
    if (entry) {
      for (const cb of this.callbacks) {
        cb(entry, this.state.currentTickIndex)
      }
    }
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
