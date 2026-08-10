---
inclusion: auto
---

# Retro Casino Theme Standards

## Rule

All game UIs MUST use the `retro-casino` theme via the `useTheme()` hook. Hardcoded color values (e.g. `bg-white`, `text-gray-900`, `bg-blue-50`) are NOT allowed in game components. Use theme slots instead.

## Theme hook

```typescript
import { useTheme } from "../../theme"

const theme = useTheme()
```

## Required theme slots

| Slot | Purpose |
|------|---------|
| `theme.page` | Root container background |
| `theme.font` | Font family |
| `theme.titleText` | Primary headings (game titles, big labels) |
| `theme.headingText` | Secondary headings (section labels) |
| `theme.bodyText` | Primary body text |
| `theme.mutedText` | Secondary/dim text |
| `theme.accentText` | Highlights, scores, emphasis |
| `theme.card` | Panel/card backgrounds with borders |
| `theme.cardHeader` | Card header styling |
| `theme.listItem` | Individual list items within a card |
| `theme.btnPrimary` | Primary action buttons |
| `theme.btnSecondary` | Secondary action buttons |
| `theme.btnGhost` | Ghost/tertiary buttons |
| `theme.statusSuccess` | Correct/success state |
| `theme.statusDanger` | Wrong/error state |
| `theme.statusNeutral` | Neutral/pending state |

## Retro Casino palette reference

- Background: `#111111` (near-black)
- Green felt: `#1b5e2a` (card surfaces)
- Dark green: `#0f3d18` (list items, deeper surfaces)
- Border green: `#2a7a3a`
- Gold accent: `#f5c542` (titles, scores, emphasis)
- Body text: `#f0f0f0` (light text on dark)
- Muted: `#7dcea0` (secondary green text — WCAG AA compliant on dark green)
- Red chip: `#cc3333` (danger, primary buttons)
- Blue chip: `#2255aa` (secondary buttons)
- Font: `font-mono`

## What NOT to do

- ❌ Use `bg-white`, `bg-gray-50`, `text-gray-900` in game components
- ❌ Hardcode colors instead of using theme slots
- ❌ Use `font-sans` in game-phase UI (theme enforces `font-mono`)
- ❌ Mix light-theme Tailwind classes with the dark retro-casino palette
