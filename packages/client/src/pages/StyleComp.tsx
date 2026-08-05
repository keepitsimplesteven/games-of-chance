import { useState } from "react"

type Theme = "nes" | "arcade" | "vaporwave" | "pixel-vapor" | "retro-casino" | "clean"

const THEMES: { id: Theme; name: string; description: string }[] = [
  { id: "nes", name: "NES Era", description: "8-bit pixel borders, limited palette, chunky text" },
  { id: "arcade", name: "Arcade Cabinet", description: "Dark background, neon glow, CRT scanlines" },
  { id: "vaporwave", name: "Vaporwave", description: "Gradient pastels, soft glow, geometric" },
  { id: "pixel-vapor", name: "Pixel Vapor", description: "Blocky NES shapes with purple neon glow" },
  { id: "retro-casino", name: "Retro Casino", description: "Felt table green, poker chips, Vegas vibes" },
  { id: "clean", name: "Clean Modern", description: "Minimal, card-based, subtle shadows" },
]

export default function StyleComp() {
  const [theme, setTheme] = useState<Theme>("nes")

  return (
    <div className={`min-h-screen transition-all duration-300 ${themeClasses[theme].page}`}>
      {/* Theme picker */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              theme === t.id
                ? themeClasses[theme].activeTab
                : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/80"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Main content — same layout, different skin */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
        {/* Title */}
        <h1 className={`text-center ${themeClasses[theme].title}`}>
          GAMES OF CHANCE
        </h1>

        {/* Coin graphic */}
        <div className={`relative ${themeClasses[theme].coinContainer}`}>
          <div className={`w-32 h-32 rounded-full flex items-center justify-center ${themeClasses[theme].coin}`}>
            <span className={themeClasses[theme].coinText}>H</span>
          </div>
        </div>

        {/* Status text */}
        <div className={`text-center ${themeClasses[theme].status}`}>
          <p className={themeClasses[theme].statusLabel}>ROUND 3 OF 5</p>
          <p className={themeClasses[theme].statusValue}>Waiting for flip...</p>
        </div>

        {/* Player list */}
        <div className={`w-full max-w-sm ${themeClasses[theme].card}`}>
          <h2 className={themeClasses[theme].cardTitle}>PLAYERS</h2>
          <ul className={themeClasses[theme].list}>
            {["Player 1 ★", "Player 2", "Player 3", "Bot 🤖"].map((name, i) => (
              <li key={i} className={themeClasses[theme].listItem}>
                {name}
                <span className={themeClasses[theme].score}>{3 - i} pts</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button className={themeClasses[theme].primaryBtn}>
            HEADS
          </button>
          <button className={themeClasses[theme].secondaryBtn}>
            TAILS
          </button>
        </div>

        {/* Theme description */}
        <p className={`text-xs opacity-60 ${themeClasses[theme].meta}`}>
          Theme: {THEMES.find((t) => t.id === theme)?.description}
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Theme class maps — each theme defines the same set of slots
// ═══════════════════════════════════════════════════════════

const themeClasses: Record<Theme, Record<string, string>> = {
  // ─────────────────────────────────────────────────
  // NES ERA: pixel borders, limited palette, chunky
  // ─────────────────────────────────────────────────
  nes: {
    page: "bg-[#0f0f0f] font-mono",
    title: "text-4xl font-bold text-white tracking-widest uppercase [text-shadow:2px_2px_0_#333] [-webkit-text-stroke:1px_#222]",
    coinContainer: "",
    coin: "bg-[#f8d030] border-[6px] border-[#a87820] shadow-[inset_0_-4px_0_#a87820,0_6px_0_#604000] [image-rendering:pixelated]",
    coinText: "text-5xl font-black text-[#604000]",
    status: "",
    statusLabel: "text-[#7cfc00] text-sm uppercase tracking-widest",
    statusValue: "text-white text-lg mt-1",
    card: "border-4 border-white bg-[#1a1a2e] p-4",
    cardTitle: "text-[#7cfc00] text-sm font-bold mb-3 uppercase tracking-wider border-b-2 border-[#7cfc00] pb-1",
    list: "space-y-2",
    listItem: "flex justify-between text-white text-sm px-2 py-1 bg-[#0f0f0f] border-2 border-[#333]",
    score: "text-[#f8d030] font-bold",
    primaryBtn: "px-6 py-3 bg-[#e04040] text-white font-bold text-lg border-4 border-[#a02020] shadow-[inset_0_-4px_0_#801010,0_4px_0_#400808] active:shadow-none active:translate-y-1 transition-transform uppercase tracking-wider",
    secondaryBtn: "px-6 py-3 bg-[#4040e0] text-white font-bold text-lg border-4 border-[#2020a0] shadow-[inset_0_-4px_0_#101080,0_4px_0_#080840] active:shadow-none active:translate-y-1 transition-transform uppercase tracking-wider",
    activeTab: "bg-[#e04040] text-white border-2 border-[#a02020]",
    meta: "text-gray-400",
  },

  // ─────────────────────────────────────────────────
  // ARCADE CABINET: dark, neon glow, CRT feel
  // ─────────────────────────────────────────────────
  arcade: {
    page: "bg-[#0a0a0a] font-mono bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]",
    title: "text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#ff0] to-[#f80] uppercase [text-shadow:0_0_20px_rgba(255,200,0,0.6)] drop-shadow-[0_0_10px_rgba(255,200,0,0.3)]",
    coinContainer: "animate-pulse",
    coin: "bg-gradient-to-br from-[#ff0] to-[#f80] border-4 border-[#fff3] shadow-[0_0_30px_rgba(255,200,0,0.5),inset_0_0_20px_rgba(0,0,0,0.3)]",
    coinText: "text-5xl font-black text-black/70",
    status: "",
    statusLabel: "text-[#0ff] text-sm uppercase tracking-[0.3em] [text-shadow:0_0_8px_rgba(0,255,255,0.6)]",
    statusValue: "text-white text-lg mt-1 [text-shadow:0_0_6px_rgba(255,255,255,0.3)]",
    card: "border border-[#0ff3] bg-[#111]/80 backdrop-blur-sm rounded-lg p-4 shadow-[0_0_15px_rgba(0,255,255,0.1)]",
    cardTitle: "text-[#0ff] text-sm font-bold mb-3 uppercase tracking-wider [text-shadow:0_0_8px_rgba(0,255,255,0.4)]",
    list: "space-y-2",
    listItem: "flex justify-between text-white/80 text-sm px-3 py-2 rounded bg-white/5 border border-white/10",
    score: "text-[#ff0] font-bold [text-shadow:0_0_4px_rgba(255,255,0,0.4)]",
    primaryBtn: "px-6 py-3 bg-gradient-to-b from-[#f00] to-[#a00] text-white font-bold text-lg rounded-lg shadow-[0_0_15px_rgba(255,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,0,0,0.6)] active:translate-y-0.5 transition-all uppercase tracking-wider",
    secondaryBtn: "px-6 py-3 bg-gradient-to-b from-[#00f] to-[#008] text-white font-bold text-lg rounded-lg shadow-[0_0_15px_rgba(0,0,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(0,0,255,0.6)] active:translate-y-0.5 transition-all uppercase tracking-wider",
    activeTab: "bg-[#0ff] text-black font-bold",
    meta: "text-gray-500",
  },

  // ─────────────────────────────────────────────────
  // VAPORWAVE: pastels, gradients, geometric, dreamy
  // ─────────────────────────────────────────────────
  vaporwave: {
    page: "bg-gradient-to-br from-[#1a0033] via-[#0d001a] to-[#000d1a] font-sans",
    title: "text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ff71ce] via-[#01cdfe] to-[#b967ff] uppercase tracking-wide",
    coinContainer: "",
    coin: "bg-gradient-to-br from-[#ff71ce] to-[#b967ff] border-4 border-[#01cdfe] shadow-[0_0_40px_rgba(185,103,255,0.4),0_0_80px_rgba(1,205,254,0.2)]",
    coinText: "text-5xl font-black text-white/90 [text-shadow:0_0_10px_rgba(255,255,255,0.5)]",
    status: "",
    statusLabel: "text-[#01cdfe] text-sm uppercase tracking-[0.4em]",
    statusValue: "text-[#ff71ce] text-lg mt-1 font-medium",
    card: "border border-[#b967ff40] bg-[#0d001a]/60 backdrop-blur-md rounded-2xl p-5 shadow-[0_0_30px_rgba(185,103,255,0.1)]",
    cardTitle: "text-[#01cdfe] text-sm font-bold mb-3 uppercase tracking-wider",
    list: "space-y-2",
    listItem: "flex justify-between text-white/70 text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-[#b967ff10] to-[#01cdfe10] border border-[#b967ff20]",
    score: "text-[#ff71ce] font-bold",
    primaryBtn: "px-6 py-3 bg-gradient-to-r from-[#ff71ce] to-[#b967ff] text-white font-bold text-lg rounded-full shadow-[0_4px_20px_rgba(255,113,206,0.4)] hover:shadow-[0_4px_30px_rgba(255,113,206,0.6)] hover:scale-105 active:scale-95 transition-all uppercase",
    secondaryBtn: "px-6 py-3 bg-gradient-to-r from-[#01cdfe] to-[#05ffa1] text-black font-bold text-lg rounded-full shadow-[0_4px_20px_rgba(1,205,254,0.4)] hover:shadow-[0_4px_30px_rgba(1,205,254,0.6)] hover:scale-105 active:scale-95 transition-all uppercase",
    activeTab: "bg-gradient-to-r from-[#ff71ce] to-[#b967ff] text-white",
    meta: "text-[#b967ff80]",
  },

  // ─────────────────────────────────────────────────
  // CLEAN MODERN: minimal, card shadows, neutral
  // ─────────────────────────────────────────────────
  clean: {
    page: "bg-gray-50 font-sans",
    title: "text-4xl font-bold text-gray-900 tracking-tight",
    coinContainer: "",
    coin: "bg-gradient-to-br from-amber-400 to-amber-500 border-2 border-amber-600/30 shadow-lg",
    coinText: "text-5xl font-bold text-amber-900/70",
    status: "",
    statusLabel: "text-gray-500 text-sm uppercase tracking-wider font-medium",
    statusValue: "text-gray-900 text-lg mt-1 font-semibold",
    card: "bg-white rounded-xl border border-gray-200 p-5 shadow-sm",
    cardTitle: "text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wider",
    list: "space-y-1.5",
    listItem: "flex justify-between text-gray-700 text-sm px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100",
    score: "text-amber-600 font-semibold",
    primaryBtn: "px-6 py-3 bg-gray-900 text-white font-semibold text-base rounded-lg shadow-sm hover:bg-gray-800 active:translate-y-0.5 transition-all",
    secondaryBtn: "px-6 py-3 bg-white text-gray-900 font-semibold text-base rounded-lg border border-gray-300 shadow-sm hover:bg-gray-50 active:translate-y-0.5 transition-all",
    activeTab: "bg-gray-900 text-white",
    meta: "text-gray-400",
  },

  // ─────────────────────────────────────────────────
  // PIXEL VAPOR: NES blocky shapes + purple neon glow
  // Thick pixel borders like NES but purple/magenta palette with glow
  // ─────────────────────────────────────────────────
  "pixel-vapor": {
    page: "bg-[#0d0018] font-mono",
    title: "text-4xl font-bold text-[#e040fb] uppercase tracking-widest [text-shadow:0_0_12px_rgba(224,64,251,0.7),2px_2px_0_#6a0080]",
    coinContainer: "",
    coin: "bg-[#2d004f] border-[6px] border-[#e040fb] shadow-[0_0_20px_rgba(224,64,251,0.5),inset_0_-4px_0_#1a002e,0_6px_0_#4a007a]",
    coinText: "text-5xl font-black text-[#01cdfe] [text-shadow:0_0_8px_rgba(1,205,254,0.8)]",
    status: "",
    statusLabel: "text-[#01cdfe] text-sm uppercase tracking-widest [text-shadow:0_0_6px_rgba(1,205,254,0.5)]",
    statusValue: "text-[#e040fb] text-lg mt-1 [text-shadow:0_0_6px_rgba(224,64,251,0.4)]",
    card: "border-4 border-[#e040fb] bg-[#1a002e] p-4 shadow-[0_0_15px_rgba(224,64,251,0.3)]",
    cardTitle: "text-[#01cdfe] text-sm font-bold mb-3 uppercase tracking-wider border-b-2 border-[#01cdfe] pb-1 [text-shadow:0_0_6px_rgba(1,205,254,0.4)]",
    list: "space-y-2",
    listItem: "flex justify-between text-white/80 text-sm px-2 py-1 bg-[#0d0018] border-2 border-[#6a0080] shadow-[0_0_4px_rgba(106,0,128,0.3)]",
    score: "text-[#ff71ce] font-bold [text-shadow:0_0_4px_rgba(255,113,206,0.5)]",
    primaryBtn: "px-6 py-3 bg-[#e040fb] text-white font-bold text-lg border-4 border-[#8b00a8] shadow-[inset_0_-4px_0_#6a0080,0_4px_0_#3d004a,0_0_15px_rgba(224,64,251,0.4)] active:shadow-[0_0_15px_rgba(224,64,251,0.4)] active:translate-y-1 transition-transform uppercase tracking-wider",
    secondaryBtn: "px-6 py-3 bg-[#01cdfe] text-[#0d0018] font-bold text-lg border-4 border-[#0090b3] shadow-[inset_0_-4px_0_#006680,0_4px_0_#004d60,0_0_15px_rgba(1,205,254,0.4)] active:shadow-[0_0_15px_rgba(1,205,254,0.4)] active:translate-y-1 transition-transform uppercase tracking-wider",
    activeTab: "bg-[#e040fb] text-white border-2 border-[#8b00a8] shadow-[0_0_8px_rgba(224,64,251,0.5)]",
    meta: "text-[#6a0080]",
  },

  // ─────────────────────────────────────────────────
  // RETRO CASINO: Poker chip palette (white, red, blue, green, black)
  // Gold/yellow for headers. Green felt. Red/blue buttons like chip stacks.
  // White for general text and borders. Black background.
  // ─────────────────────────────────────────────────
  "retro-casino": {
    page: "bg-[#111111] font-mono",
    title: "text-4xl font-bold text-[#f5c542] uppercase tracking-widest [text-shadow:2px_2px_0_#8b6914,0_0_8px_rgba(245,197,66,0.3)]",
    coinContainer: "",
    coin: "bg-[#f0f0f0] border-[6px] border-[#cccccc] shadow-[inset_0_-4px_0_#aaaaaa,0_6px_0_#666666,0_0_12px_rgba(255,255,255,0.1)]",
    coinText: "text-5xl font-black text-[#333333]",
    status: "",
    statusLabel: "text-[#f5c542] text-sm uppercase tracking-widest",
    statusValue: "text-[#f0f0f0] text-lg mt-1",
    card: "border-4 border-[#2a7a3a] bg-[#1b5e2a] p-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.4),0_4px_0_#0f3d18]",
    cardTitle: "text-[#f5c542] text-sm font-bold mb-3 uppercase tracking-wider border-b-2 border-[#3a9a4a] pb-1",
    list: "space-y-2",
    listItem: "flex justify-between text-[#f0f0f0] text-sm px-2 py-1.5 bg-[#0f3d18] border-2 border-[#2a7a3a]",
    score: "text-[#f5c542] font-bold",
    primaryBtn: "px-6 py-3 bg-[#cc3333] text-white font-bold text-lg border-4 border-[#8b1a1a] shadow-[inset_0_-4px_0_#661a1a,0_4px_0_#3d0f0f] active:shadow-none active:translate-y-1 transition-transform uppercase tracking-wider",
    secondaryBtn: "px-6 py-3 bg-[#2255aa] text-white font-bold text-lg border-4 border-[#143d7a] shadow-[inset_0_-4px_0_#0f2d5c,0_4px_0_#091d3d] active:shadow-none active:translate-y-1 transition-transform uppercase tracking-wider",
    activeTab: "bg-[#cc3333] text-white border-2 border-[#8b1a1a]",
    meta: "text-[#3a9a4a]",
  },
}
