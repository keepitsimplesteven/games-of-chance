---
inclusion: auto
---

# Deferred Reveal Values

## Rule

**`useDeferredRevealValue` MUST be used for any presentational scoring or suspenseful UI result that occurs after a delay.** This applies to:

- **Playcaller**: play results, drive outcomes, and scoring updates that follow a play animation
- **Coin Toss**: coin flip results, toss sequences, and scoring that follows the flip animation
- **Big Wheel**: spin results, landed values, and scoring that follows the wheel animation

## When to use

Any UI element that reveals or implies the outcome of a round — including leaderboard scores, point deltas, flip sequences, result text, accuracy indicators — MUST be gated behind `useDeferredRevealValue` so the value stays stale (previous round's data) until `roundAnimationDone === true`.

## Import

```typescript
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"
```

## Pattern

```tsx
// Gate the leaderboard data so scores don't update mid-animation
const leaderboard = useDeferredRevealValue(roomState.gameLeaderboard)

// Gate the coin-toss history so new toss results don't appear before the flip lands
const tossHistory = useDeferredRevealValue(roomState.coinTossGameState?.tossHistory ?? [])
```

## What NOT to do

- ❌ Show live `gameLeaderboard` scores directly during RESOLVING phase
- ❌ Display the latest toss outcome in a sequence before the flip animation completes
- ❌ Show point deltas (+10, +20, +30) before the animation reveals the result
- ❌ Use raw `roomState` values for any scoring or outcome display without gating

## Relationship to animation-gated-results

This rule is complementary to the `animation-gated-results` steering file. That file defines the `roundAnimationDone` flag and the overall principle. This file specifies the **exact hook** that must be used to implement it in components.
