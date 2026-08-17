# Design Document

## Overview

This design covers the combat rebalance for Battle Bots: introducing a deterministic reference bot for simulation, tightening the balance band to 49–51%, capping speed at 50 energyPerTick, preserving the 90% accuracy cap, rebalancing the MODIFIER_TABLE, fixing the EnergyBar snap-back artifact, and updating the fairness simulator to dual-pass methodology.

## Architecture

The rebalance touches three layers:

1. **Server — ModifierTable.ts**: New multiplier values tuned to the tighter balance band with the new speed range (12→50 energyPerTick).
2. **Server — tuneEnergyValues.ts**: Rewritten fairness simulator using a deterministic reference bot and dual-pass validation.
3. **Client — EnergyBar.tsx**: Energy direction tracking to conditionally apply/skip CSS transitions.

No new packages or services are introduced. The existing `BattleEngine.ts` simulation logic is unchanged — it already supports arbitrary `energyPerTick` values and the accuracy cap. Only the constants feeding into it change.

## Components and Interfaces

### 1. ModifierTable (Updated Constants)

**File:** `packages/server/src/games/battle-bots/ModifierTable.ts`

The MODIFIER_TABLE is updated with new values tuned via the fairness simulator. The structure (`ModifierEntry` interface) and the `deriveCombatStats` function remain unchanged — only the numeric values change.

```typescript
export const MODIFIER_TABLE: Record<number, ModifierEntry> = {
  1: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 12 },
  2: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 18 },
  3: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 25 },
  4: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 31 },
  5: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 38 },
  6: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 44 },
  7: { damageMultiplier: <tuned>, accuracyMultiplier: <tuned>, attackEnergyPerTick: 50 },
}
```

**Constraints:**
- `attackEnergyPerTick`: 12 at star 1, 50 at star 7, monotonically increasing
- `damageMultiplier`: monotonically increasing, `floor(5 * mult) >= 1` for all stars
- `accuracyMultiplier`: monotonically increasing, `floor(56 * mult) <= 90` for all stars (cap: mult ≤ 1.607)
- `BASE_HP`, `BASE_MAX_HIT`, `BASE_ACCURACY` remain unchanged (100, 5, 56)

### 2. Reference Bot (New Concept in Simulator)

**File:** `packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts`

The reference bot is a simulation-only construct (not a `CombatRobot`). It is modeled as a separate entity in the simulation loop with hardcoded behavior:

```typescript
interface ReferenceBotConfig {
  hp: number          // 100 (BASE_HP)
  damagePerTick: 1    // always deals exactly 1
  alwaysHits: true    // no accuracy roll
  bypassesEnergy: true // not subject to energy accumulation
}
```

The reference bot does NOT use the standard energy accumulation → attack cycle. On every tick it is alive, it deals 1 damage to the challenger. This makes it a fixed baseline: it kills any 100 HP bot in exactly 100 ticks (10 seconds at 100ms ticks).

### 3. Fairness Simulator (Rewritten)

**File:** `packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts`

The simulator is restructured into two passes:

#### Pass 1: Reference Bot Validation
- For each of 28 builds, run 10,000 trials against the reference bot
- Challenger uses normal combat (energy accumulation, accuracy rolls, damage rolls)
- Reference bot uses deterministic behavior (1 damage/tick, guaranteed hit, no energy)
- Report per-build win rates; flag any outside 49%–51%

#### Pass 2: All-vs-All Mirror Matches (Secondary Validation)
- For each of 28 builds, run random mirror matches against other builds
- Both sides use normal combat mechanics
- Reports per-build aggregate win rates as a secondary fairness check

```typescript
function simulateVsReference(
  challenger: CombatRobot,
  referenceHp: number
): { winnerId: "challenger" | "reference" } {
  let challengerHp = challenger.currentHp
  let refHp = referenceHp
  let energy = 0

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    // Reference bot always deals 1 damage to challenger
    challengerHp = Math.max(0, challengerHp - 1)
    if (challengerHp <= 0) return { winnerId: "reference" }

    // Challenger accumulates energy normally
    energy += challenger.energyPerTick
    if (energy >= 100) {
      energy -= 100
      // Roll accuracy
      const hit = Math.floor(Math.random() * 100) + 1 <= challenger.accuracy
      if (hit) {
        const damage = Math.floor(Math.random() * challenger.maxHit) + 1
        refHp = Math.max(0, refHp - damage)
      }
      if (refHp <= 0) return { winnerId: "challenger" }
    }
  }

  // Timeout: whoever has more HP wins
  return { winnerId: challengerHp >= refHp ? "challenger" : "reference" }
}
```

#### Build Enumeration

Unchanged from current implementation — enumerates all (D, A, S) where D+A+S=9, each in [1,7], yielding exactly 28 configurations.

### 4. EnergyBar Component (Snap-Back Fix)

**File:** `packages/client/src/games/battle-bots/BattlePhase/EnergyBar.tsx`

The fix adds state tracking for the previous energy value to detect the direction of change:

```typescript
import { useRef } from "react"

interface EnergyBarProps {
  currentEnergy: number
  maxEnergy: number
  gameSpeed: number
  isEliminated?: boolean
}

export function EnergyBar({ currentEnergy, maxEnergy, gameSpeed, isEliminated }: EnergyBarProps) {
  const prevEnergyRef = useRef(currentEnergy)
  const isIncreasing = currentEnergy > prevEnergyRef.current

  // Update ref after direction check
  prevEnergyRef.current = currentEnergy

  const percentage = Math.max(0, Math.min(100, (currentEnergy / maxEnergy) * 100))

  // Only apply transition when energy is increasing (charging).
  // Skip transition on reset (energy decreased) to avoid visual snap-back.
  const transition = isIncreasing ? `width ${gameSpeed}ms linear` : "none"

  return (
    <div className="w-full">
      <div
        className={`w-full bg-[#0f2d3d] rounded-full h-2.5 overflow-hidden border border-[#2a5a7a] ${
          isEliminated ? "opacity-50 grayscale" : ""
        }`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: "#4fc3f7",
            transition,
          }}
        />
      </div>
    </div>
  )
}
```

**Key logic:** `currentEnergy > prevEnergyRef.current` means energy is charging → apply smooth transition. When energy drops (attack fired, reset to 0 or overflow), the bar snaps instantly to the new width.

### 5. Interfaces

#### ModifierEntry (Unchanged)

```typescript
export interface ModifierEntry {
  damageMultiplier: number
  accuracyMultiplier: number
  attackEnergyPerTick: number
}
```

#### deriveCombatStats (Unchanged Signature)

```typescript
export function deriveCombatStats(stars: {
  damage: number
  accuracy: number
  speed: number
}): {
  maxHit: number      // floor(BASE_MAX_HIT * damageMultiplier), min 1
  accuracy: number    // min(floor(BASE_ACCURACY * accuracyMultiplier), 90)
  energyPerTick: number
  hp: number          // BASE_HP (100)
}
```

#### Simulator Output Types

```typescript
interface TuningResult {
  stars: { damage: number; accuracy: number; speed: number }
  winRate: number
  matchesPlayed: number
  inBand: boolean
}

interface SimulatorReport {
  pass1Results: TuningResult[]  // vs reference bot
  pass2Results: TuningResult[]  // mirror matches
  allInBand: boolean
}
```

#### EnergyBar Props (Unchanged)

```typescript
interface EnergyBarProps {
  currentEnergy: number
  maxEnergy: number
  gameSpeed: number
  isEliminated?: boolean
}
```

## Data Models

No database or persistence changes. All modifications are to in-memory constants and runtime simulation logic. The `MODIFIER_TABLE` is a compile-time constant. The EnergyBar uses a React ref for previous energy tracking (component-local state).

## Error Handling

| Scenario | Handling |
|----------|----------|
| `deriveCombatStats` receives out-of-range stars | Existing behavior: accesses `MODIFIER_TABLE[star]` which returns `undefined`. No change needed — caller validates stars at build submission. |
| Simulator timeout (1000 ticks) | Winner determined by HP comparison, random tiebreak. Same as current. |
| EnergyBar receives energy > maxEnergy | Clamped via `Math.min(100, ...)` in percentage calc. Already handled. |
| Mirror match pass detects imbalance | Logged as warning — pass 2 is advisory, not gating. |

## Testing Strategy

### Property-Based Tests
- **ModifierTable invariants**: Monotonicity of all three columns, accuracy cap, damage minimum — run against the actual MODIFIER_TABLE constants with all 7 star levels as input domain.
- **Accuracy formula**: Generate random accuracyMultiplier values and verify deriveCombatStats produces min(floor(56 × mult), 90).
- **EnergyBar transition logic**: Generate arbitrary sequences of energy values and verify transition is applied only when energy increases.
- **Build enumeration**: Verify allBuilds() produces exactly 28 unique configurations satisfying D+A+S=9, each in [1,7].
- **Reference bot simulation**: For any number of ticks, verify the reference bot deals exactly 1 damage per tick it's alive.
- **Balance band classification**: For any float in [0, 1], verify classification matches the 49–51% boundaries.

### Unit Tests
- Star 7 speed produces exactly 50 energyPerTick
- Star 1 speed produces approximately 12 energyPerTick
- Star 7 accuracy produces exactly 89 or 90 (verifies cap)
- Reference bot HP is 100
- EnergyBar renders correct transition value for specific known transitions (e.g., 0→50 = transition, 99→0 = none)

### Integration Tests
- Run full simulator (10,000 trials × 28 builds) and verify all builds within 49–51% band
- Run dual-pass simulator and verify both passes complete and report results
- Verify pass 2 (mirror matches) completes for all 28 builds

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Reference Bot Deterministic Behavior

*For any* simulation tick where the reference bot is alive, it SHALL deal exactly 1 damage to the challenger without an accuracy roll and independently of the energy accumulation system.

**Validates: Requirements 1.1, 1.2, 1.5**

### Property 2: Balance Band Classification

*For any* win rate value, the classification function SHALL flag it as out-of-band if and only if it is below 0.49 or above 0.51.

**Validates: Requirements 2.2, 2.3**

### Property 3: Accuracy Cap Formula

*For any* star level in [1, 7] and its corresponding accuracyMultiplier from the MODIFIER_TABLE, the derived accuracy SHALL equal min(floor(56 × accuracyMultiplier), 90), and SHALL never exceed 90.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Modifier Table Monotonicity

*For any* pair of consecutive star levels (n, n+1) where n is in [1, 6], all three multiplier columns (damageMultiplier, accuracyMultiplier, attackEnergyPerTick) SHALL be strictly less at star n than at star n+1.

**Validates: Requirements 4.3, 5.4, 5.5**

### Property 5: Damage Minimum Guarantee

*For any* star level in [1, 7] and its corresponding damageMultiplier from the MODIFIER_TABLE, the derived maxHit (floor(5 × damageMultiplier)) SHALL be at least 1.

**Validates: Requirements 5.1**

### Property 6: EnergyBar Transition Direction

*For any* sequence of energy values delivered to the EnergyBar component, when the new energy is greater than the previous energy the component SHALL render with a CSS transition, and when the new energy is less than or equal to the previous energy the component SHALL render without a CSS transition (transition: "none").

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Build Enumeration Completeness

*For any* enumeration of star distributions satisfying D+A+S=9 with each value in [1, 7], the result SHALL contain exactly 28 configurations with no duplicates.

**Validates: Requirements 7.6**
