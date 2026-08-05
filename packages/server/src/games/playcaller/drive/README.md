# Playcaller Drive Engine

A pure functional module that resolves football drives through a multi-step D&D-style roll system. The engine accepts play selections from offense and defense, applies defensive modifiers from a config-driven play matrix, rolls for outcomes via injectable RNG, and returns updated drive state with play-by-play text.

## How It Works

- A drive starts at the 25-yard line. The offense has 4 downs to gain 10 yards for a first down.
- Each play: the offense picks a play, the defense picks a counter-play, and the engine resolves the outcome using dice-roll mechanics.
- Critical successes yield breakaway gains. Critical failures cause turnovers (interceptions for passes, fumbles for runs).
- The drive ends when the offense scores a touchdown (reaches the 0-yard line), turns the ball over on downs (fails on 4th down), or suffers a turnover (interception/fumble).
- Correct defensive reads (matching axis) heavily penalize the offense. Wrong reads heavily reward it.

## Running the CLI

From the `packages/server` directory:

```bash
npm run drive:cli
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--offense` / `--o` | Play as offense (skip side prompt) |
| `--defense` / `--d` | Play as defense (skip side prompt) |
| `--bot <strategy>` | Set the bot's strategy (skip strategy prompt) |
| `--count <n>` | Simulate n games automatically (uses fundamentals for the human side) |

### Examples

```bash
# Interactive: prompts for side and bot strategy
npm run drive:cli

# Play offense against a random bot
npm run drive:cli -- --offense --bot random

# Play defense against fundamentals offense
npm run drive:cli -- --defense --bot fundamentals

# Play offense against the fundamentals defense
npm run drive:cli -- --offense --bot fundamentals

# Simulate 50 games: fundamentals offense vs random defense
npm run drive:cli -- --offense --bot random --count 50

# Simulate 50 games: fundamentals defense vs air-raid offense
npm run drive:cli -- --defense --bot air-raid --count 50
```

## Bot Strategies

### Offense Strategies (used when you play defense)

| Name | Flag | Description |
|------|------|-------------|
| Random | `random` | Picks plays uniformly at random |
| Football Fundamentals | `fundamentals` | Textbook play-calling: run on 1st, pass on 3rd-and-long, etc. |
| Safe Run Grind | `safe-run` | Safe run every play, deep pass on 4th-and-long |
| Air Raid | `air-raid` | Pass every play, aggressive on later downs |
| Ground & Pound | `ground-pound` | Run every play, aggressive when needing yards |

### Defense Strategies (used when you play offense)

| Name | Flag | Description |
|------|------|-------------|
| Random | `random` | Picks plays uniformly at random |
| Football Fundamentals | `fundamentals` | Mirrors expected offensive tendencies (run D on 1st, pass D on 3rd-and-long) |
| Anti-Fundamentals | `anti-fundamentals` | Intentionally picks the opposite of what's expected |

### Football Fundamentals Logic

The fundamentals strategy follows traditional play-calling wisdom:

**Offense:**
- 1st & 10: Inside Run (establish the run)
- 2nd & short (≤3): Deep Pass (take a shot)
- 2nd & medium (4-6): Short Pass (move the chains)
- 2nd & long (7+): Outside Run (chunk play)
- 3rd & short (≤3): Inside Run (power run)
- 3rd & medium (4-7): Short Pass (reliable conversion)
- 3rd & long (8+): Deep Pass (go for it)
- 4th & short (≤2): Inside Run (sneak)
- 4th & long (3+): Deep Pass (desperation)

**Defense (mirrors the above):**
- Calls the matching counter to what the textbook says offense should do
- Run Contain on 1st down, Man Press on 4th-and-long, etc.

## Play Selection

### Offense (you call the offensive play)

| Input | Play        | Style      | Description                              |
|-------|-------------|------------|------------------------------------------|
| 1     | Inside Run  | Safe       | High success rate, low yardage (1-6)     |
| 2     | Outside Run | Aggressive | Medium success rate, medium yardage (2-11) |
| 3     | Short Pass  | Safe       | High success rate, medium yardage (2-8)  |
| 4     | Deep Pass   | Aggressive | Low success rate, high yardage (4-17)    |

### Defense (you call the defensive play)

| Input | Play          | Style      | Description                                |
|-------|---------------|------------|--------------------------------------------|
| 1     | Run Contain   | Safe       | Counters run plays, shrinks their range    |
| 2     | Blitz         | Aggressive | High-risk run stop, coin-flip vs runs      |
| 3     | Zone Coverage | Safe       | Counters pass plays, shrinks their range   |
| 4     | Man Press     | Aggressive | High-risk pass stop, coin-flip vs passes   |

## Configuration Presets

Play stats and the defensive modifier matrix live in `./presets/`. The active preset is selected in `./config.ts`.

| Preset | File | Description |
|--------|------|-------------|
| v1-balanced | `presets/v1-balanced.ts` | Original tuning (20-yard start, gentle modifiers) |
| v2-25yard | `presets/v2-25yard.ts` | 25-yard start, wider yardage ranges |
| v3-decisive | `presets/v3-decisive.ts` | Strong read-reward: correct calls heavily favored, wrong calls punished |

To switch presets, change the import in `config.ts`:
```typescript
import { PLAY_CONFIG, PLAY_MATRIX } from "./presets/v3-decisive"
```

To test a preset without changing the active one:
```typescript
import { V1_PLAY_CONFIG, V1_PLAY_MATRIX } from "./presets"
```

## Balance Testing

```bash
# Run balance tests (win rate + avg yardage)
npx vitest run src/games/playcaller/drive/balance.property.test.ts

# Run exploitability tests (strategic advantage scenarios)
npx vitest run src/games/playcaller/drive/exploitability.test.ts

# Run all drive tests
npx vitest run src/games/playcaller/drive/
```

### V3 Balance Results

| Scenario | Offense | Defense |
|---|---|---|
| Random vs Random | 49.2% | 50.8% |
| Greedy O vs Random D | 60.0% | 40.0% |
| Fundamentals O vs Random D | 54.3% | 45.7% |
| Fundamentals O vs Fundamentals D (mirror) | 9.9% | 90.1% |
| Fundamentals O vs Anti-Fundamentals D | 86.8% | 13.2% |
| Best O + Worst D (ceiling) | 87.3% | 12.7% |
| Worst O + Best D (ceiling) | 13.8% | 86.2% |
