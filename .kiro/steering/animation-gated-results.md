---
inclusion: auto
---

# Animation-Gated Results

## Core Principle

**The result of any game round MUST ALWAYS wait for the visual animation to fully resolve before updating anywhere else in the UI.** This includes leaderboards, score displays, result text, and any other UI element that would reveal the outcome.

## Rules

1. **No spoilers**: Never show a score, result value, or leaderboard update while an animation (spin, flip, battle tick, etc.) is still in progress
2. **Synchronize reveals**: The result text ("Spin 1 landed on: 75") and the leaderboard score update must appear at the same moment — when the animation completes
3. **Use `roundAnimationDone`**: The store's `roundAnimationDone` flag is the canonical signal that the current round's animation has completed. Set it to `true` only after the primary game animation finishes (e.g., wheel stops spinning, coin lands, battle ends)
4. **Gate secondary UI**: Any component that displays round outcomes (GameLeaderboard, score summaries, result banners) must check `roundAnimationDone` before rendering updated values
5. **Reset on new round**: The `roundAnimationDone` flag automatically resets to `false` when a new round/phase begins via STATE_SYNC

## Pattern

```tsx
// In the game container (e.g., BigWheelContainer, CoinTossContainer):
const handleAnimationComplete = () => {
  useGameStore.setState({ roundAnimationDone: true })
  // Now safe to show result text, update local confirmed state, etc.
}

// In GameView:
const showLeaderboard = phase === "PICKING" || roundAnimationDone
```

## What NOT to do

- ❌ Show `gameLeaderboard` data immediately when STATE_SYNC arrives during an animation
- ❌ Display result text while `wheelSpinning === true` or before `roundAnimationDone`
- ❌ Update score UI elements based on server state without checking animation status
- ❌ Use `setTimeout` to approximate animation duration — always use the animation's actual completion callback

## Exceptions

- During PICKING phase, the leaderboard shows previous round scores (already revealed)
- Host-only debug/admin views may bypass this for development purposes
- SKIP_ANIMATION message immediately sets `roundAnimationDone = true` for all clients
