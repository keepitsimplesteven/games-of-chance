import { useState } from "react"

type Theme = "pixel-vapor" | "retro-casino" | "nes" | "clean"

const THEMES: { id: Theme; name: string }[] = [
  { id: "pixel-vapor", name: "Pixel Vapor" },
  { id: "retro-casino", name: "Retro Casino" },
  { id: "nes", name: "NES Era" },
  { id: "clean", name: "Clean Modern" },
]

interface FieldProps {
  yardLine: number // 0-35, where 0 = end zone (touchdown)
  theme: Theme
}

/**
 * Vertical football half-field (end zone at top, 35-yard line at bottom).
 * Flat top-down view — no isometric perspective. Compact and fits in a card.
 *
 * NOTE: An isometric diamond version existed previously but was too space-hungry.
 * See git history for the isometric variant using matrix(0.866, 0.5, -0.866, 0.5, 0, 0).
 */
function IsometricField({ yardLine, theme }: FieldProps) {
  const t = fieldThemes[theme]

  const fieldW = 120 // sideline-to-sideline
  const endZoneH = 35 // end zone depth
  const playFieldH = 280 // 35 yards of playing field
  const totalH = endZoneH + playFieldH
  const yardsPerUnit = playFieldH / 35

  // Ball position: yardLine 0 = goal line (top), 35 = bottom
  const ballY = endZoneH + yardLine * yardsPerUnit
  const ballX = fieldW / 2

  const svgW = fieldW + 30 // padding for yard numbers
  const svgH = totalH + 10

  return (
    <div className={`w-full max-w-[200px] mx-auto ${t.container}`}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
        <g transform="translate(15, 5)">
          {/* End zone */}
          <rect
            x={0}
            y={0}
            width={fieldW}
            height={endZoneH}
            fill={t.endZoneFill}
            stroke={t.lineColor}
            strokeWidth={t.lineWidth}
          />
          {/* End zone text */}
          <text
            x={fieldW / 2}
            y={endZoneH / 2 + 4}
            textAnchor="middle"
            fill={t.endZoneText}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="3"
          >
            END ZONE
          </text>

          {/* Playing field background */}
          <rect
            x={0}
            y={endZoneH}
            width={fieldW}
            height={playFieldH}
            fill={t.fieldFill}
            stroke={t.lineColor}
            strokeWidth={t.lineWidth}
          />

          {/* Yard lines (every 5 yards) */}
          {Array.from({ length: 8 }, (_, i) => i * 5).map((yard) => {
            const y = endZoneH + yard * yardsPerUnit
            const isMajor = yard % 10 === 0
            return (
              <g key={yard}>
                <line
                  x1={0}
                  y1={y}
                  x2={fieldW}
                  y2={y}
                  stroke={t.lineColor}
                  strokeWidth={yard === 0 ? t.lineWidth * 2.5 : isMajor ? t.lineWidth * 1.5 : t.lineWidth * 0.7}
                  strokeDasharray={isMajor || yard === 0 ? "none" : "4,3"}
                />
                {/* Yard numbers on the left side */}
                {yard > 0 && isMajor && (
                  <text
                    x={-10}
                    y={y + 4}
                    textAnchor="middle"
                    fill={t.yardNumberColor}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {yard}
                  </text>
                )}
              </g>
            )
          })}

          {/* Hash marks */}
          {Array.from({ length: 7 }, (_, i) => (i + 1) * 5).map((yard) => {
            const y = endZoneH + yard * yardsPerUnit
            return (
              <g key={`hash-${yard}`}>
                <line x1={fieldW * 0.33 - 2} y1={y} x2={fieldW * 0.33 + 2} y2={y} stroke={t.lineColor} strokeWidth={1.2} />
                <line x1={fieldW * 0.67 - 2} y1={y} x2={fieldW * 0.67 + 2} y2={y} stroke={t.lineColor} strokeWidth={1.2} />
              </g>
            )
          })}

          {/* Football marker */}
          <g transform={`translate(${ballX}, ${ballY})`}>
            {/* Glow */}
            <ellipse cx={0} cy={0} rx={10} ry={6} fill={t.ballGlow} />
            {/* Ball body */}
            <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={t.ballFill} stroke={t.ballStroke} strokeWidth={1.5} />
            {/* Laces */}
            <line x1={-3} y1={0} x2={3} y2={0} stroke={t.ballLaces} strokeWidth={1} />
            <line x1={-2} y1={-1.8} x2={-2} y2={1.8} stroke={t.ballLaces} strokeWidth={0.7} />
            <line x1={0} y1={-2.2} x2={0} y2={2.2} stroke={t.ballLaces} strokeWidth={0.7} />
            <line x1={2} y1={-1.8} x2={2} y2={1.8} stroke={t.ballLaces} strokeWidth={0.7} />
          </g>

          {/* Outer border */}
          <rect
            x={0}
            y={0}
            width={fieldW}
            height={totalH}
            fill="none"
            stroke={t.lineColor}
            strokeWidth={t.lineWidth * 2}
          />
        </g>
      </svg>
    </div>
  )
}

export default function FieldComp() {
  const [theme, setTheme] = useState<Theme>("pixel-vapor")
  const [yardLine, setYardLine] = useState(25)

  const t = pageThemes[theme]

  return (
    <div className={`min-h-screen transition-all duration-300 ${t.page}`}>
      {/* Theme picker */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {THEMES.map((th) => (
          <button
            key={th.id}
            onClick={() => setTheme(th.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
              theme === th.id ? t.activeTab : "bg-gray-800/60 text-gray-300 hover:bg-gray-700/80"
            }`}
          >
            {th.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-5">
        <h1 className={t.title}>PLAYCALLER</h1>

        {/* Down & Distance info */}
        <div className={`text-center ${t.status}`}>
          <span className={t.statusLabel}>2nd & 7</span>
          <span className={t.statusSep}> | </span>
          <span className={t.statusValue}>Ball on the {yardLine}</span>
        </div>

        {/* The field */}
        <IsometricField yardLine={yardLine} theme={theme} />

        {/* Yard line slider */}
        <div className="w-full max-w-xs flex items-center gap-3">
          <span className={`text-xs font-mono ${t.sliderLabel}`}>TD</span>
          <input
            type="range"
            min={0}
            max={35}
            value={yardLine}
            onChange={(e) => setYardLine(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-white/20 cursor-pointer"
          />
          <span className={`text-xs font-mono ${t.sliderLabel}`}>35</span>
        </div>

        {/* Play buttons */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <button className={t.runBtn}>🏈 Inside Run</button>
          <button className={t.runBtn}>🏈 Outside Run</button>
          <button className={t.passBtn}>🎯 Short Pass</button>
          <button className={t.passBtn}>🎯 Deep Pass</button>
        </div>

        {/* Play-by-play */}
        <div className={`w-full max-w-xs ${t.pbpBox}`}>
          <p className={t.pbpText}>Gains 4 yards on the play.</p>
          <p className={t.pbpText}>BREAKAWAY! A huge 12-yard gain!</p>
          <p className={t.pbpText}>Pass falls incomplete.</p>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Field SVG theme tokens
// ═══════════════════════════════════════════════════════════

const fieldThemes: Record<Theme, {
  container: string
  fieldFill: string
  endZoneFill: string
  endZoneText: string
  lineColor: string
  lineWidth: number
  yardNumberColor: string
  ballFill: string
  ballStroke: string
  ballLaces: string
  ballGlow: string
}> = {
  "pixel-vapor": {
    container: "border-4 border-[#e040fb] shadow-[0_0_20px_rgba(224,64,251,0.4)] rounded",
    fieldFill: "#1a002e",
    endZoneFill: "#2d004f",
    endZoneText: "#e040fb",
    lineColor: "#e040fb",
    lineWidth: 1.5,
    yardNumberColor: "#01cdfe",
    ballFill: "#e040fb",
    ballStroke: "#ff71ce",
    ballLaces: "#01cdfe",
    ballGlow: "rgba(224,64,251,0.5)",
  },
  "retro-casino": {
    container: "border-4 border-[#2a7a3a] shadow-[inset_0_0_15px_rgba(0,0,0,0.3)]",
    fieldFill: "#1b5e2a",
    endZoneFill: "#0f3d18",
    endZoneText: "#f5c542",
    lineColor: "#f0f0f0",
    lineWidth: 1.5,
    yardNumberColor: "#f5c542",
    ballFill: "#8b4513",
    ballStroke: "#5c2e0a",
    ballLaces: "#f0f0f0",
    ballGlow: "rgba(139,69,19,0.4)",
  },
  nes: {
    container: "border-4 border-white",
    fieldFill: "#2d7a2d",
    endZoneFill: "#1a4d1a",
    endZoneText: "#ffffff",
    lineColor: "#ffffff",
    lineWidth: 2,
    yardNumberColor: "#ffffff",
    ballFill: "#a0522d",
    ballStroke: "#5c2e0a",
    ballLaces: "#ffffff",
    ballGlow: "rgba(160,82,45,0.4)",
  },
  clean: {
    container: "border border-gray-200 rounded-xl shadow-sm overflow-hidden",
    fieldFill: "#4ade80",
    endZoneFill: "#22c55e",
    endZoneText: "#ffffff",
    lineColor: "#ffffff",
    lineWidth: 1,
    yardNumberColor: "#166534",
    ballFill: "#92400e",
    ballStroke: "#451a03",
    ballLaces: "#fbbf24",
    ballGlow: "rgba(146,64,14,0.3)",
  },
}

// ═══════════════════════════════════════════════════════════
// Page-level theme classes
// ═══════════════════════════════════════════════════════════

const pageThemes: Record<Theme, Record<string, string>> = {
  "pixel-vapor": {
    page: "bg-[#0d0018] font-mono",
    title: "text-3xl font-bold text-[#e040fb] uppercase tracking-widest [text-shadow:0_0_12px_rgba(224,64,251,0.7),2px_2px_0_#6a0080]",
    status: "",
    statusLabel: "text-[#01cdfe] text-sm font-bold [text-shadow:0_0_6px_rgba(1,205,254,0.5)]",
    statusSep: "text-[#6a0080]",
    statusValue: "text-[#e040fb] text-sm [text-shadow:0_0_6px_rgba(224,64,251,0.4)]",
    activeTab: "bg-[#e040fb] text-white border-2 border-[#8b00a8] shadow-[0_0_8px_rgba(224,64,251,0.5)]",
    sliderLabel: "text-[#01cdfe]",
    runBtn: "px-3 py-2.5 bg-[#2d004f] text-[#01cdfe] font-bold text-sm border-4 border-[#e040fb] shadow-[inset_0_-3px_0_#1a002e,0_3px_0_#4a007a,0_0_10px_rgba(224,64,251,0.3)] active:translate-y-0.5 active:shadow-[0_0_10px_rgba(224,64,251,0.3)] transition-transform uppercase",
    passBtn: "px-3 py-2.5 bg-[#001a33] text-[#ff71ce] font-bold text-sm border-4 border-[#01cdfe] shadow-[inset_0_-3px_0_#000d1a,0_3px_0_#005577,0_0_10px_rgba(1,205,254,0.3)] active:translate-y-0.5 active:shadow-[0_0_10px_rgba(1,205,254,0.3)] transition-transform uppercase",
    pbpBox: "border-4 border-[#6a0080] bg-[#0d0018] p-3 max-h-24 overflow-y-auto",
    pbpText: "text-[#e040fb]/70 text-xs font-mono leading-relaxed",
  },
  "retro-casino": {
    page: "bg-[#111111] font-mono",
    title: "text-3xl font-bold text-[#f5c542] uppercase tracking-widest [text-shadow:2px_2px_0_#8b6914,0_0_8px_rgba(245,197,66,0.3)]",
    status: "",
    statusLabel: "text-[#f5c542] text-sm font-bold",
    statusSep: "text-[#3a9a4a]",
    statusValue: "text-[#f0f0f0] text-sm",
    activeTab: "bg-[#cc3333] text-white border-2 border-[#8b1a1a]",
    sliderLabel: "text-[#f5c542]",
    runBtn: "px-3 py-2.5 bg-[#1b5e2a] text-[#f0f0f0] font-bold text-sm border-4 border-[#2a7a3a] shadow-[inset_0_-3px_0_#0f3d18,0_3px_0_#071f0c] active:translate-y-0.5 active:shadow-none transition-transform uppercase",
    passBtn: "px-3 py-2.5 bg-[#2255aa] text-[#f0f0f0] font-bold text-sm border-4 border-[#143d7a] shadow-[inset_0_-3px_0_#0f2d5c,0_3px_0_#091d3d] active:translate-y-0.5 active:shadow-none transition-transform uppercase",
    pbpBox: "border-4 border-[#2a7a3a] bg-[#0f3d18] p-3 max-h-24 overflow-y-auto shadow-[inset_0_0_10px_rgba(0,0,0,0.4)]",
    pbpText: "text-[#f0f0f0]/70 text-xs font-mono leading-relaxed",
  },
  nes: {
    page: "bg-[#0f0f0f] font-mono",
    title: "text-3xl font-bold text-white uppercase tracking-widest [text-shadow:2px_2px_0_#333]",
    status: "",
    statusLabel: "text-[#7cfc00] text-sm font-bold",
    statusSep: "text-gray-600",
    statusValue: "text-white text-sm",
    activeTab: "bg-[#e04040] text-white border-2 border-[#a02020]",
    sliderLabel: "text-[#7cfc00]",
    runBtn: "px-3 py-2.5 bg-[#2d7a2d] text-white font-bold text-sm border-4 border-[#1a4d1a] shadow-[inset_0_-3px_0_#143614,0_3px_0_#0a1f0a] active:translate-y-0.5 active:shadow-none transition-transform uppercase",
    passBtn: "px-3 py-2.5 bg-[#4040e0] text-white font-bold text-sm border-4 border-[#2020a0] shadow-[inset_0_-3px_0_#101080,0_3px_0_#080840] active:translate-y-0.5 active:shadow-none transition-transform uppercase",
    pbpBox: "border-4 border-white bg-[#1a1a2e] p-3 max-h-24 overflow-y-auto",
    pbpText: "text-white/70 text-xs font-mono leading-relaxed",
  },
  clean: {
    page: "bg-gray-50 font-sans",
    title: "text-3xl font-bold text-gray-900 tracking-tight",
    status: "",
    statusLabel: "text-gray-600 text-sm font-semibold",
    statusSep: "text-gray-300",
    statusValue: "text-gray-900 text-sm font-medium",
    activeTab: "bg-gray-900 text-white",
    sliderLabel: "text-gray-500",
    runBtn: "px-3 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-green-700 active:translate-y-0.5 transition-all",
    passBtn: "px-3 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-blue-700 active:translate-y-0.5 transition-all",
    pbpBox: "bg-white border border-gray-200 rounded-xl p-3 max-h-24 overflow-y-auto shadow-sm",
    pbpText: "text-gray-600 text-xs leading-relaxed",
  },
}
