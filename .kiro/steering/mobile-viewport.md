---
inclusion: auto
---

# Mobile Viewport Constraint

## Rule: No scroll during active gameplay

All game plugin UIs (the in-game view during PICKING, RESOLVING, and RESULT phases) must fit within a standard iPhone viewport (~390×844px) **without scrolling**. This is a hard constraint for all new game UI work.

### What this means in practice:

- The game play area, action buttons, and essential feedback must all be visible simultaneously
- Status/result messages should be compact (single line) or ephemeral (toast-style, auto-dismiss)
- No vertical overflow during active play — everything fits in one screen

### Exceptions (scrolling is acceptable):

- The lobby/menu screen (game tile selection, settings) — scrolling is fine here
- The session leaderboard — should be tucked into a floating drawer (like host panel), not inline
- Play-by-play history / detailed results — can be in a scrollable area or expandable section

### Space-saving strategies:

1. **Session leaderboard**: Move to a floating drawer accessible via a button tap (similar to the host control panel). For the host, combine leaderboard + host controls into one drawer.
2. **Status messages**: Keep them as a single compact line at the top, or use brief toast notifications that auto-dismiss. Avoid multi-line status banners.
3. **Compact layouts**: Use tight spacing (gap-2, py-1.5) for game-phase UI. Reserve larger spacing for the lobby.
4. **Shared header during gameplay**: Minimize to just the game name + connection dot. No full standings bar.

### Target viewport budget (during active gameplay):

- Header: ~40px
- Game visual/field: ~250-300px (flexible)
- Action buttons: ~100px
- Compact feedback line: ~30px
- **Total: ≤ 420-470px content height** (leaves room for system UI chrome)

### When building new game plugin UIs:

Always test at 390px width × 844px height (iPhone 14/15 viewport). If the player needs to scroll to see their action buttons while the game visual is showing, the layout needs to be compressed.


## Rule: All splash screens must use SplashLayout

Game splash screens (shown during the SPLASH phase before gameplay starts) MUST be built using the `SplashLayout` component at `src/components/game/SplashLayout.tsx`.

### Why

Splash screens render inside the ViewportContainer's grid area. Custom fixed-height layouts with large padding/margins will overflow and get clipped by `overflow: hidden` on short viewports (600–700px). SplashLayout handles this correctly with:

- `h-full min-h-0` to fill exactly the available grid slot
- Flexbox centering (no fixed padding)
- `overflow-y-auto` on the card so content scrolls internally if needed
- Compact spacing that works down to 600px

### How to use

```tsx
import { SplashLayout } from "../../components/game/SplashLayout"

export function MyGameSplash() {
  return (
    <SplashLayout
      emoji="🎲"
      title="My Game"
      action={<button>Play Game</button>}
    >
      {/* Optional: rules, scoring info, etc. */}
      <div>Custom content here</div>
    </SplashLayout>
  )
}
```

### Do NOT:

- Build splash screens with `py-16` or large fixed vertical padding
- Use `min-h-screen` or `h-screen` in splash layouts
- Create splash screens that assume they have unlimited vertical space
- Skip `SplashLayout` and build a custom container — always use it as the foundation
