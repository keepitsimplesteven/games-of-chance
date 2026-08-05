import type { ThemeDefinition } from "./types"

/**
 * Pixel Vapor — NES-era blocky shapes + purple/magenta/cyan neon glow.
 * Monospace font, thick pixel borders, glowing accents.
 */
export const pixelVapor: ThemeDefinition = {
  id: "pixel-vapor",
  name: "Pixel Vapor",

  // Page
  page: "bg-[#0d0018]",
  font: "font-mono",

  // Typography
  titleText: "text-[#e040fb] [text-shadow:0_0_12px_rgba(224,64,251,0.7),2px_2px_0_#6a0080]",
  headingText: "text-[#01cdfe] [text-shadow:0_0_6px_rgba(1,205,254,0.5)]",
  bodyText: "text-white/85",
  mutedText: "text-[#6a0080]",
  accentText: "text-[#ff71ce] [text-shadow:0_0_4px_rgba(255,113,206,0.5)]",

  // Containers
  card: "border-4 border-[#e040fb] bg-[#1a002e] shadow-[0_0_15px_rgba(224,64,251,0.3)]",
  cardHeader: "text-[#01cdfe] border-b-2 border-[#01cdfe] pb-1 [text-shadow:0_0_6px_rgba(1,205,254,0.4)]",
  listItem: "bg-[#0d0018] border-2 border-[#6a0080] shadow-[0_0_4px_rgba(106,0,128,0.3)]",

  // Buttons
  btnPrimary: "bg-[#e040fb] text-white border-4 border-[#8b00a8] shadow-[inset_0_-4px_0_#6a0080,0_4px_0_#3d004a,0_0_15px_rgba(224,64,251,0.4)] active:shadow-[0_0_15px_rgba(224,64,251,0.4)] active:translate-y-1 transition-transform",
  btnSecondary: "bg-[#01cdfe] text-[#0d0018] border-4 border-[#0090b3] shadow-[inset_0_-4px_0_#006680,0_4px_0_#004d60,0_0_15px_rgba(1,205,254,0.4)] active:shadow-[0_0_15px_rgba(1,205,254,0.4)] active:translate-y-1 transition-transform",
  btnGhost: "bg-transparent text-[#e040fb] border-2 border-[#6a0080] hover:border-[#e040fb] hover:shadow-[0_0_8px_rgba(224,64,251,0.3)] transition-all",

  // Status
  statusSuccess: "text-[#01cdfe] [text-shadow:0_0_6px_rgba(1,205,254,0.5)]",
  statusDanger: "text-[#ff71ce] [text-shadow:0_0_6px_rgba(255,113,206,0.5)]",
  statusNeutral: "text-[#e040fb]/60",

  // Field (SVG colors)
  field: {
    background: "#0d0018",
    surface: "#1a002e",
    line: "#e040fb",
    accent: "#01cdfe",
    ballFill: "#e040fb",
    ballStroke: "#ff71ce",
    glow: "rgba(224,64,251,0.5)",
  },
}
