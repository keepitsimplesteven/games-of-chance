# Future Work: Big Wheel + Shared Leaderboard

## Live Score Tiles (Priority: High)
- Show descending point total rankings during the Big Wheel game as it's being played
- Use a small UI similar to the not-player-battles in Battle Bots
- Score tiles that slide up as scores surpass others (animated reordering)
- Updates in real-time as each player completes their turn

## Shared Compact Leaderboard Component (Priority: High)
- Create a lightweight shared "leaderboard" component usable by coin-toss, big-wheel, and future games
- Sits next to game UI on desktop, below on mobile
- Should function identically to current coin-toss leaderboard but be portable and open for extension
- Goal: games fully viewable in one non-scrolling screen on mobile (even if game UI shrinks to fit)
- Current `GameLeaderboard.tsx` is already semi-portable (reads from store, no coin-toss-specific logic beyond streak indicators)
- Refactor plan:
  1. Extract streak indicators as optional/plugin-specific
  2. Add animated tile reordering (framer-motion layout animations)
  3. Make it smaller/more compact
  4. Position it in a responsive layout (side on desktop, below on mobile)
  5. Let game plugins opt in/out of showing it during gameplay vs. only at END_GAME

## Auto-Advance Toggle (Priority: Low)
- Add a configurable setting: "Auto-advance between spins" with adjustable delay
- Option to skip and spin again immediately
- Currently manual (player/host must click to continue)
