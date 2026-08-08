import { useState } from "react"

/**
 * FieldCompGrid — Clean rebuild of the Playcaller gameplay layout using pure CSS Grid.
 * No flexbox for layout (only for text alignment within cells).
 * Route: /field-grid
 *
 * Grid structure (4 rows × 2 columns):
 * ┌─────────────────────────────────┐
 * │       HEADER (spans 2 cols)     │  row 1: auto
 * ├──────────────────┬──────────────┤
 * │                  │ Other Games  │
 * │   FIELD + INFO   │  (scrollable) │  row 2: 30dvh
 * │                  │              │
 * ├──────────────────┴──────────────┤
 * │     PLAY-BY-PLAY (spans 2)     │  row 3: auto
 * ├─────────┬───────────────────────┤
 * │  Card1  │  Card2               │  row 4: 1fr (fills rest)
 * ├─────────┼───────────────────────┤
 * │  Card3  │  Card4               │  (part of row 4 via nested grid)
 * └─────────┴───────────────────────┘
 */

export default function FieldCompGrid() {
  const [yardLine, setYardLine] = useState(25)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div
      className="h-[100dvh] overflow-hidden bg-[#111] font-mono text-white p-2"
      style={{
        display: "grid",
        gridTemplateColumns: "60fr 40fr",
        gridTemplateRows: "auto 40dvh auto 33dvh",
        gap: "6px",
      }}
    >
      {/* ═══ ROW 1: Header (spans 2 cols) ═══ */}
      <header style={{ gridColumn: "1 / -1" }} className="flex items-center justify-between">
        <span className="text-xl font-bold text-[#f5c542] uppercase tracking-widest"
          style={{ textShadow: "2px 2px 0 #8b6914" }}>
          Quarterfinal
        </span>
        <span className="text-[12px] text-white/80">You (OFF) vs Bot_2</span>
      </header>

      {/* ═══ ROW 2, COL 1: Field ═══ */}
      <div className="overflow-hidden relative"
        style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
        {/* Down/Distance */}
        <div className="text-center text-[11px] py-0.5">
          <span className="font-bold text-[#f5c542]">2nd & 7</span>
          <span className="text-white/60 ml-1 text-[9px]">• {yardLine} yd</span>
        </div>
        {/* Field SVG */}
        <div className="overflow-hidden">
          <svg viewBox="0 0 120 280" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* End zone */}
            <rect x="10" y="5" width="100" height="30" fill="#0f3d18" stroke="#2a7a3a" strokeWidth="2" />
            <text x="60" y="23" textAnchor="middle" fill="#f5c542" fontSize="8" fontFamily="monospace" fontWeight="bold">END ZONE</text>
            {/* Field */}
            <rect x="10" y="35" width="100" height="240" fill="#1b5e2a" stroke="#2a7a3a" strokeWidth="2" />
            {/* Yard lines every ~34px (7 lines for 35 yards at 5-yard intervals) */}
            {[5, 10, 15, 20, 25, 30, 35].map((yd) => {
              const y = 35 + (yd / 35) * 240
              const major = yd % 10 === 0
              return (
                <g key={yd}>
                  <line x1="10" y1={y} x2="110" y2={y}
                    stroke="white" strokeWidth={major ? 1.5 : 0.8}
                    strokeDasharray={major ? "none" : "4,3"} />
                  {major && (
                    <text x="5" y={y + 3} fill="#f5c542" fontSize="7" fontFamily="monospace" textAnchor="end">{yd}</text>
                  )}
                </g>
              )
            })}
            {/* Football marker */}
            {(() => {
              const ballY = 35 + (yardLine / 35) * 240
              return (
                <g>
                  <ellipse cx="60" cy={ballY} rx="8" ry="5" fill="#8b4513" stroke="#5c2e0a" strokeWidth="1.5" />
                  <line x1="57" y1={ballY} x2="63" y2={ballY} stroke="white" strokeWidth="1" />
                </g>
              )
            })()}
            {/* Outer border */}
            <rect x="10" y="5" width="100" height="270" fill="none" stroke="#2a7a3a" strokeWidth="3" />
          </svg>
        </div>
        {/* Invisible slider for demo */}
        <input type="range" min={0} max={35} value={yardLine}
          onChange={(e) => setYardLine(Number(e.target.value))}
          className="absolute bottom-0 left-0 right-0 opacity-0 cursor-pointer h-6" />
      </div>

      {/* ═══ ROW 2, COL 2: Other Games ═══ */}
      <div className="overflow-hidden"
        style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
        <div className="text-[9px] font-bold uppercase tracking-wider text-[#f5c542] pb-1">Other Games</div>
        <div className="overflow-y-auto"
          style={{ display: "grid", gridAutoRows: "min-content", gap: "4px" }}>
          {[
            { p1: "Alice", p2: "Dave", info: "1st & 10 • Ball on 20" },
            { p1: "Bot_1", p2: "Charlie", info: "3rd & 4 • Ball on 12" },
            { p1: "Eve", p2: "Bot_3", info: "4th & 8 • Ball on 31" },
            { p1: "Frank", p2: "Bot_4", info: "✓ Frank wins (TD)", done: true },
          ].map((g, i) => (
            <div key={i} className={`border-2 border-[#2a7a3a] bg-[#0f3d18] rounded px-2 py-1.5 ${g.done ? "opacity-40" : ""}`}>
              <div className="flex justify-between text-[12px] font-bold text-white">
                <span>{g.p1}</span>
                <span className="text-[8px] opacity-40">vs</span>
                <span>{g.p2}</span>
              </div>
              <div className="text-[9px] text-center text-white/60 mt-0.5">{g.info}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ROW 3: Play-by-play + History button (spans 2 cols) ═══ */}
      <div style={{ gridColumn: "1 / -1" }} className="flex items-center justify-center gap-2 relative">
        <span className="text-[12px] text-white/60">HB Dive — Gains 4 yards on the play.</span>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="text-[9px] text-[#f5c542] font-bold uppercase border border-[#f5c542]/40 rounded px-1.5 py-0.5 hover:bg-[#f5c542]/10"
        >
          {historyOpen ? "✕" : "History"}
        </button>

        {/* History popover — overlays play cards area */}
        {historyOpen && (
          <>
            {/* Backdrop — clicking anywhere closes */}
            <div className="fixed inset-0 z-10" onClick={() => setHistoryOpen(false)} />
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#111] border-2 border-[#2a7a3a] rounded p-2 max-h-[33dvh] overflow-y-auto shadow-lg">
              <div className="text-[9px] font-bold uppercase text-[#f5c542] mb-1">Drive History</div>
              {[
                { down: "1st & 10", play: "HB Dive", result: "4 yards" },
                { down: "2nd & 6", play: "Slant Route", result: "Incomplete" },
                { down: "3rd & 6", play: "Stretch Run", result: "1st down!" },
                { down: "1st & 10", play: "Fly Route", result: "INTERCEPTED!" },
              ].map((entry, i) => (
                <div key={i} className="grid py-0.5 border-b border-white/5 last:border-0 text-[9px]"
                  style={{ gridTemplateColumns: "60px 1fr 70px" }}>
                  <span className="text-white/40">{entry.down}</span>
                  <span className="font-medium text-white/80 text-center">{entry.play}</span>
                  <span className={`text-right ${entry.result.includes("!") ? "text-[#cc3333] font-bold" : "text-white/60"}`}>{entry.result}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ ROW 4: Play Cards 2×2 (spans 2 cols) ═══ */}
      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "4px" }}
        className="overflow-hidden min-h-0">
        {/* Card 1: HB Dive */}
        <button onClick={() => setHistoryOpen(false)} className="bg-[#1b5e2a] border-2 border-[#2a7a3a] rounded overflow-hidden grid place-items-center p-1"
          style={{ gridTemplateRows: "1fr auto auto" }}>
          <svg viewBox="0 0 100 60" className="w-full max-h-[5dvh]">
            <line x1="5" y1="35" x2="95" y2="35" stroke="white" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
            <rect x="33" y="32" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="40" y="32" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="47" y="32" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="54" y="32" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="61" y="32" width="5" height="5" fill="white" opacity="0.6" />
            <circle cx="50" cy="44" r="3" fill="white" opacity="0.6" />
            <circle cx="50" cy="52" r="3.5" fill="white" />
            <line x1="50" y1="48" x2="50" y2="15" stroke="white" strokeWidth="2" markerEnd="url(#a1)" />
            <defs><marker id="a1" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5Z" fill="white"/></marker></defs>
          </svg>
          <span className="text-[16px] font-bold text-white leading-none pb-2">HB Dive</span>
          <span className="text-[9px] text-white/50 leading-none mb-2 mb-2">Safe Run</span>
        </button>

        {/* Card 2: Four Verts */}
        <button onClick={() => setHistoryOpen(false)} className="bg-[#2255aa] border-2 border-[#143d7a] rounded overflow-hidden grid place-items-center p-1"
          style={{ gridTemplateRows: "1fr auto auto" }}>
          <svg viewBox="0 0 100 60" className="w-full max-h-[5dvh]">
            <line x1="5" y1="40" x2="95" y2="40" stroke="white" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
            <rect x="33" y="37" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="40" y="37" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="47" y="37" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="54" y="37" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="61" y="37" width="5" height="5" fill="white" opacity="0.6" />
            <circle cx="50" cy="50" r="3" fill="white" />
            <circle cx="20" cy="38" r="2.5" fill="white" opacity="0.8" />
            <circle cx="80" cy="38" r="2.5" fill="white" opacity="0.8" />
            <circle cx="35" cy="38" r="2.5" fill="white" opacity="0.8" />
            <line x1="20" y1="35" x2="20" y2="8" stroke="white" strokeWidth="1.5" markerEnd="url(#a2)" />
            <line x1="80" y1="35" x2="80" y2="8" stroke="white" strokeWidth="1.5" markerEnd="url(#a2)" />
            <line x1="35" y1="35" x2="35" y2="12" stroke="white" strokeWidth="1.5" markerEnd="url(#a2)" />
            <line x1="65" y1="37" x2="65" y2="12" stroke="white" strokeWidth="1.5" markerEnd="url(#a2)" />
            <defs><marker id="a2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5Z" fill="white"/></marker></defs>
          </svg>
          <span className="text-[16px] font-bold text-white leading-none pb-2">Four Verts</span>
          <span className="text-[9px] text-white/50 leading-none mb-2">Aggressive Pass</span>
        </button>

        {/* Card 3: Cover 2 */}
        <button onClick={() => setHistoryOpen(false)} className="bg-[#2255aa] border-2 border-[#143d7a] rounded overflow-hidden grid place-items-center p-1"
          style={{ gridTemplateRows: "1fr auto auto" }}>
          <svg viewBox="0 0 100 60" className="w-full max-h-[5dvh]">
            <line x1="5" y1="40" x2="95" y2="40" stroke="white" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
            <rect x="35" y="34" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="43" y="34" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="51" y="34" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="59" y="34" width="5" height="5" fill="white" opacity="0.6" />
            <circle cx="35" cy="28" r="2.5" fill="white" opacity="0.7" />
            <circle cx="50" cy="26" r="2.5" fill="white" opacity="0.7" />
            <circle cx="65" cy="28" r="2.5" fill="white" opacity="0.7" />
            <circle cx="20" cy="14" r="2.5" fill="white" opacity="0.7" />
            <circle cx="40" cy="12" r="2.5" fill="white" opacity="0.7" />
            <circle cx="60" cy="12" r="2.5" fill="white" opacity="0.7" />
            <circle cx="80" cy="14" r="2.5" fill="white" opacity="0.7" />
            <ellipse cx="30" cy="18" rx="16" ry="9" fill="white" opacity="0.08" stroke="white" strokeWidth="0.6" strokeDasharray="3,2" />
            <ellipse cx="70" cy="18" rx="16" ry="9" fill="white" opacity="0.08" stroke="white" strokeWidth="0.6" strokeDasharray="3,2" />
          </svg>
          <span className="text-[16px] font-bold text-white leading-none pb-2">Cover 2</span>
          <span className="text-[9px] text-white/50 leading-none mb-2">Safe Pass D</span>
        </button>

        {/* Card 4: Blitz Package */}
        <button onClick={() => setHistoryOpen(false)} className="bg-[#1b5e2a] border-2 border-[#2a7a3a] rounded overflow-hidden grid place-items-center p-1"
          style={{ gridTemplateRows: "1fr auto auto" }}>
          <svg viewBox="0 0 100 60" className="w-full max-h-[5dvh]">
            <line x1="5" y1="35" x2="95" y2="35" stroke="white" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
            <rect x="35" y="30" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="43" y="30" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="51" y="30" width="5" height="5" fill="white" opacity="0.6" />
            <rect x="59" y="30" width="5" height="5" fill="white" opacity="0.6" />
            <circle cx="28" cy="26" r="3" fill="white" />
            <circle cx="72" cy="26" r="3" fill="white" />
            <circle cx="50" cy="12" r="2.5" fill="white" opacity="0.6" />
            <circle cx="15" cy="20" r="2.5" fill="white" opacity="0.6" />
            <circle cx="85" cy="20" r="2.5" fill="white" opacity="0.6" />
            <line x1="28" y1="29" x2="42" y2="42" stroke="white" strokeWidth="2" markerEnd="url(#a3)" />
            <line x1="72" y1="29" x2="58" y2="42" stroke="white" strokeWidth="2" markerEnd="url(#a3)" />
            <defs><marker id="a3" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5Z" fill="white"/></marker></defs>
          </svg>
          <span className="text-[16px] font-bold text-white leading-none pb-2">Blitz Package</span>
          <span className="text-[9px] text-white/50 leading-none mb-2">Aggressive Run D</span>
        </button>
      </div>
    </div>
  )
}
