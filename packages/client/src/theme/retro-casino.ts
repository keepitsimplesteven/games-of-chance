import type { ThemeDefinition } from "./types"

/**
 * Retro Casino — Poker chip palette (white, red, blue, green, black).
 * Gold headers, green felt surfaces, monospace font, chunky borders.
 */
export const retroCasino: ThemeDefinition = {
  id: "retro-casino",
  name: "Retro Casino",

  // Page
  page: "bg-[#111111]",
  font: "font-mono",

  // Typography
  titleText: "text-[#f5c542] [text-shadow:2px_2px_0_#8b6914,0_0_8px_rgba(245,197,66,0.3)]",
  headingText: "text-[#f5c542]",
  bodyText: "text-[#f0f0f0]",
  mutedText: "text-[#c8e6d0]",
  accentText: "text-[#f5c542]",

  // Containers
  card: "border-4 border-[#2a7a3a] bg-[#1b5e2a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4),0_4px_0_#0f3d18]",
  cardHeader: "text-[#f5c542] border-b-2 border-[#3a9a4a] pb-1",
  listItem: "bg-[#0f3d18] border-2 border-[#2a7a3a]",

  // Buttons
  btnPrimary: "bg-[#cc3333] text-white border-4 border-[#8b1a1a] shadow-[inset_0_-4px_0_#661a1a,0_4px_0_#3d0f0f] active:shadow-none active:translate-y-1 transition-transform",
  btnSecondary: "bg-[#2255aa] text-white border-4 border-[#143d7a] shadow-[inset_0_-4px_0_#0f2d5c,0_4px_0_#091d3d] active:shadow-none active:translate-y-1 transition-transform",
  btnGhost: "bg-transparent text-[#f0f0f0] border-2 border-[#2a7a3a] hover:border-[#3a9a4a] hover:bg-[#0f3d18] transition-all",

  // Status
  statusSuccess: "text-[#a8f0b8]",
  statusDanger: "text-[#ff6b6b]",
  statusNeutral: "text-[#f0f0f0]/60",

  // Leaderboard
  currentPlayerRing: "ring-1 ring-[#f5c542]",
  rankBadge1: "bg-[#f5c542] text-[#111111]",
  rankBadge2: "bg-[#c0c0c0] text-[#111111]",
  rankBadge3: "bg-[#cd7f32] text-[#111111]",
  rankBadgeDefault: "bg-[#1b5e2a] text-[#f0f0f0]",

  // Field (SVG colors)
  field: {
    background: "#111111",
    surface: "#1b5e2a",
    line: "#f0f0f0",
    accent: "#f5c542",
    ballFill: "#8b4513",
    ballStroke: "#5c2e0a",
    glow: "rgba(139,69,19,0.4)",
  },
}
