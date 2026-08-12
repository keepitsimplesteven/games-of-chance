import { useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { PlaycallerGameState, CoinTossCeremonyMatchupState, CoinSide, SideSelection } from "@games-of-chance/shared"
import { usePlayerName } from "./hooks/usePlayerName"
import { CoinTossCountdown } from "./CoinTossCountdown"
import { CoinFlipResult } from "./CoinFlipResult"

/**
 * CoinTossCeremony — Container component for the coin toss ceremony phase.
 *
 * Determines the current player's role in the ceremony (Caller, Waiter/Chooser,
 * or Spectator) and renders the appropriate sub-component based on the ceremony
 * step and role.
 *
 * Validates: Requirements 2.2, 4.1, 6.1
 */
export function CoinTossCeremony() {
  const playerId = useGameStore((s) => s.playerId)
  const playcallerGameState = useGameStore(
    (s) => s.roomState?.playcallerGameState as PlaycallerGameState | null | undefined
  )
  const getRawPlayerName = usePlayerName()
  const theme = useTheme()

  if (!playcallerGameState || !playerId) return null

  const { ceremonyStates, bracket } = playcallerGameState
  if (!ceremonyStates) return null

  // Wrap getPlayerName to include bracket seed prefix
  const seeds = bracket?.seeds ?? {}
  const getPlayerName = (id: string | null | undefined): string => {
    if (!id) return "Unknown"
    const name = getRawPlayerName(id)
    const seed = seeds[id]
    return seed ? `(${seed}) ${name}` : name
  }

  // Find the matchup this player belongs to
  const playerCeremony = findPlayerCeremony(playerId, ceremonyStates)

  // Spectator: player is not in any active matchup
  if (!playerCeremony) {
    return <SpectatorCeremonyView ceremonyStates={ceremonyStates} getPlayerName={getPlayerName} />
  }

  const { matchupId, matchupState } = playerCeremony

  // Determine the player's role and render appropriate UI
  switch (matchupState.step) {
    case "AWAITING_CALL":
      if (matchupState.callerId === playerId) {
        return <CoinCallUI matchupId={matchupId} matchupState={matchupState} getPlayerName={getPlayerName} />
      }
      return <WaitingView matchupState={matchupState} getPlayerName={getPlayerName} label="coin call" />

    case "AWAITING_CHOICE":
      if (matchupState.chooserId === playerId) {
        return <SideSelectionUI matchupId={matchupId} matchupState={matchupState} getPlayerName={getPlayerName} />
      }
      return <WaitingView matchupState={matchupState} getPlayerName={getPlayerName} label="side selection" />

    case "COMPLETE":
      return <CeremonyResult matchupState={matchupState} getPlayerName={getPlayerName} />

    default:
      return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findPlayerCeremony(
  playerId: string,
  ceremonyStates: Record<string, CoinTossCeremonyMatchupState>
): { matchupId: string; matchupState: CoinTossCeremonyMatchupState } | null {
  for (const [matchupId, state] of Object.entries(ceremonyStates)) {
    if (state.callerId === playerId || state.waiterId === playerId) {
      return { matchupId, matchupState: state }
    }
  }
  return null
}

function getOffenseDefense(matchupState: CoinTossCeremonyMatchupState, getPlayerName: (id: string | null | undefined) => string) {
  const otherPlayer = matchupState.chooserId === matchupState.callerId ? matchupState.waiterId : matchupState.callerId
  const offensePlayer = matchupState.sideSelection === "OFFENSE"
    ? getPlayerName(matchupState.chooserId)
    : getPlayerName(otherPlayer)
  const defensePlayer = matchupState.sideSelection === "DEFENSE"
    ? getPlayerName(matchupState.chooserId)
    : getPlayerName(otherPlayer)
  return { offensePlayer, defensePlayer }
}

// ── Sub-Components ────────────────────────────────────────────────────────────

interface CeremonyProps {
  matchupState: CoinTossCeremonyMatchupState
  getPlayerName: (id: string | null | undefined) => string
}

interface CoinCallUIProps extends CeremonyProps {
  matchupId: string
}

/**
 * CoinCallUI — Caller's interactive coin call buttons.
 */
function CoinCallUI({ matchupId, matchupState, getPlayerName }: CoinCallUIProps) {
  const [submitted, setSubmitted] = useState(false)
  const [selectedSide, setSelectedSide] = useState<CoinSide | null>(null)
  const theme = useTheme()

  const opponentName = getPlayerName(matchupState.waiterId)

  function handleCall(side: CoinSide) {
    if (submitted) return
    setSubmitted(true)
    setSelectedSide(side)
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "COIN_TOSS_CALL", payload: { matchupId, side } })
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-6 py-8 ${theme.font}`}>
      <div className={`text-lg font-bold uppercase tracking-wider ${theme.titleText}`}>
        Coin Toss
      </div>
      <CoinTossCountdown deadlineMs={matchupState.coinCallDeadlineMs} />
      <div className={`text-sm ${theme.bodyText}`}>
        You are the <span className={`font-bold ${theme.accentText}`}>Caller</span> — vs{" "}
        <span className="font-bold">{opponentName}</span>
      </div>
      <div className={`text-sm ${theme.mutedText}`}>Call it — heads or tails?</div>

      <div className="flex gap-4">
        <button
          type="button"
          disabled={submitted}
          onClick={() => handleCall("HEADS")}
          className={`px-8 py-4 rounded text-lg font-bold uppercase tracking-wider transition-all
            ${submitted && selectedSide === "HEADS"
              ? `${theme.btnPrimary} ring-2 ring-[#f5c542]`
              : submitted
                ? "opacity-40 cursor-not-allowed bg-[#0f3d18] text-[#7dcea0] border border-[#2a7a3a]"
                : `${theme.btnPrimary} active:scale-95 cursor-pointer`
            }`}
        >
          Heads
        </button>
        <button
          type="button"
          disabled={submitted}
          onClick={() => handleCall("TAILS")}
          className={`px-8 py-4 rounded text-lg font-bold uppercase tracking-wider transition-all
            ${submitted && selectedSide === "TAILS"
              ? `${theme.btnPrimary} ring-2 ring-[#f5c542]`
              : submitted
                ? "opacity-40 cursor-not-allowed bg-[#0f3d18] text-[#7dcea0] border border-[#2a7a3a]"
                : `${theme.btnPrimary} active:scale-95 cursor-pointer`
            }`}
        >
          Tails
        </button>
      </div>

      {submitted && (
        <div className={`text-xs ${theme.mutedText} animate-pulse`}>
          Flipping the coin…
        </div>
      )}
    </div>
  )
}

/**
 * SideSelectionUI — Chooser's interactive offense/defense buttons.
 * Content below the coin flip is gated behind the flip animation reveal.
 */
function SideSelectionUI({ matchupId, matchupState, getPlayerName }: CoinCallUIProps) {
  const [submitted, setSubmitted] = useState(false)
  const [selectedSide, setSelectedSide] = useState<SideSelection | null>(null)
  const [flipRevealed, setFlipRevealed] = useState(false)
  const theme = useTheme()

  const opponentName = getPlayerName(
    matchupState.chooserId === matchupState.callerId ? matchupState.waiterId : matchupState.callerId
  )

  function handleChoice(selection: SideSelection) {
    if (submitted) return
    setSubmitted(true)
    setSelectedSide(selection)
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "COIN_TOSS_CHOICE", payload: { matchupId, selection } })
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-6 py-8 ${theme.font}`}>
      <CoinFlipResult matchupState={matchupState} getPlayerName={getPlayerName} onRevealed={() => setFlipRevealed(true)} />

      {/* All content below is gated behind the flip reveal */}
      {flipRevealed && (
        <>
          <div className={`text-lg font-bold uppercase tracking-wider ${theme.titleText}`}>
            Choose Your Side
          </div>
          <CoinTossCountdown deadlineMs={matchupState.sideChoiceDeadlineMs} />
          <div className={`text-sm ${theme.bodyText}`}>
            You won the toss! Playing against{" "}
            <span className="font-bold">{opponentName}</span>
          </div>
          <div className={`text-sm ${theme.mutedText}`}>Pick offense or defense</div>

          <div className="flex gap-4">
            <button
              type="button"
              disabled={submitted}
              onClick={() => handleChoice("OFFENSE")}
              className={`px-8 py-4 rounded text-lg font-bold uppercase tracking-wider transition-all
                ${submitted && selectedSide === "OFFENSE"
                  ? `${theme.btnPrimary} ring-2 ring-[#f5c542]`
                  : submitted
                    ? "opacity-40 cursor-not-allowed bg-[#0f3d18] text-[#7dcea0] border border-[#2a7a3a]"
                    : `${theme.btnPrimary} active:scale-95 cursor-pointer`
                }`}
            >
              Offense
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => handleChoice("DEFENSE")}
              className={`px-8 py-4 rounded text-lg font-bold uppercase tracking-wider transition-all
                ${submitted && selectedSide === "DEFENSE"
                  ? `${theme.btnSecondary} ring-2 ring-[#f5c542]`
                  : submitted
                    ? "opacity-40 cursor-not-allowed bg-[#0f3d18] text-[#7dcea0] border border-[#2a7a3a]"
                    : `${theme.btnSecondary} active:scale-95 cursor-pointer`
                }`}
            >
              Defense
            </button>
          </div>

          {submitted && (
            <div className={`text-xs ${theme.mutedText} animate-pulse`}>
              Locking in…
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * WaitingView — Shown to the Waiter while the other player acts.
 * During side selection step, content is gated behind the flip animation reveal.
 */
function WaitingView({ matchupState, getPlayerName, label }: CeremonyProps & { label: string }) {
  const theme = useTheme()
  const [flipRevealed, setFlipRevealed] = useState(false)
  const isCoinCall = label === "coin call"
  const isSideSelection = label === "side selection"
  const activePlayerName = isCoinCall
    ? getPlayerName(matchupState.callerId)
    : getPlayerName(matchupState.chooserId)
  const actionText = isCoinCall ? "calling the coin" : "choosing a side"
  const deadlineMs = isCoinCall
    ? matchupState.coinCallDeadlineMs
    : matchupState.sideChoiceDeadlineMs

  return (
    <div className={`flex flex-col items-center justify-center gap-5 py-8 ${theme.font}`}>
      {/* Coin flip result — shown to the Waiter during side selection step */}
      {isSideSelection && matchupState.flipOutcome && (
        <CoinFlipResult matchupState={matchupState} getPlayerName={getPlayerName} onRevealed={() => setFlipRevealed(true)} />
      )}

      {/* Pulsing coin indicator — only shown during coin call step */}
      {isCoinCall && (
        <div className="relative flex items-center justify-center">
          <div className="absolute h-14 w-14 animate-ping rounded-full bg-[#f5c542]/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1b5e2a] border border-[#f5c542]/40 animate-pulse">
            <span className="text-2xl" aria-hidden="true">🪙</span>
          </div>
        </div>
      )}

      {/* Content below is always shown for coin call, but gated behind reveal for side selection */}
      {(isCoinCall || flipRevealed) && (
        <>
          <div className={`text-lg font-bold uppercase tracking-wider ${theme.titleText}`}>
            Coin Toss
          </div>

          <CoinTossCountdown deadlineMs={deadlineMs} />

          <div className={`text-center text-sm ${theme.bodyText} max-w-xs`}>
            Waiting for{" "}
            <span className={`font-bold ${theme.accentText}`}>{activePlayerName}</span>
            {" "}to finish {actionText}…
          </div>

          {/* Three-dot bouncing indicator */}
          <div className="flex items-center gap-1.5" aria-label="Loading">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dcea0] animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dcea0] animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dcea0] animate-bounce [animation-delay:300ms]" />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * CeremonyResult — Final result with offense/defense assignments.
 */
function CeremonyResult({ matchupState, getPlayerName }: CeremonyProps) {
  const theme = useTheme()
  const chooserName = getPlayerName(matchupState.chooserId)
  const { offensePlayer, defensePlayer } = getOffenseDefense(matchupState, getPlayerName)

  return (
    <div className={`flex flex-col items-center justify-center gap-5 py-8 animate-fade-in ${theme.font}`}>
      <CoinFlipResult matchupState={matchupState} getPlayerName={getPlayerName} />

      <div className={`text-sm ${theme.bodyText}`}>
        <span className={`font-bold ${theme.accentText}`}>{chooserName}</span>
        {" chose "}
        <span className="font-bold">
          {matchupState.sideSelection}
        </span>
      </div>

      {/* Role assignment cards */}
      <div className="flex items-stretch gap-3 animate-result-reveal">
        <div className={`flex flex-col items-center gap-1.5 rounded px-5 py-3 min-w-[110px] ${theme.card}`}>
          <span className={`text-xs uppercase tracking-wider font-bold ${theme.accentText}`}>
            Offense
          </span>
          <span className={`text-base font-bold ${theme.bodyText}`}>
            {offensePlayer}
          </span>
          <span className="text-lg" aria-hidden="true">🏈</span>
        </div>
        <div className={`flex items-center font-bold text-xs ${theme.mutedText}`}>vs</div>
        <div className={`flex flex-col items-center gap-1.5 rounded px-5 py-3 min-w-[110px] ${theme.card}`}>
          <span className={`text-xs uppercase tracking-wider font-bold ${theme.mutedText}`}>
            Defense
          </span>
          <span className={`text-base font-bold ${theme.bodyText}`}>
            {defensePlayer}
          </span>
          <span className="text-lg" aria-hidden="true">🛡️</span>
        </div>
      </div>
    </div>
  )
}

// ── Spectator View ────────────────────────────────────────────────────────────

interface SpectatorViewProps {
  ceremonyStates: Record<string, CoinTossCeremonyMatchupState>
  getPlayerName: (id: string | null | undefined) => string
}

function SpectatorCeremonyView({ ceremonyStates, getPlayerName }: SpectatorViewProps) {
  const theme = useTheme()
  const matchups = Object.entries(ceremonyStates)
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null)

  const singleMatchup = matchups.length === 1
  const activeMatchupId = singleMatchup ? matchups[0][0] : selectedMatchupId
  const activeMatchupState = activeMatchupId ? ceremonyStates[activeMatchupId] : null

  if (activeMatchupState) {
    return (
      <SpectatorDetailView
        matchupState={activeMatchupState}
        getPlayerName={getPlayerName}
        onBack={singleMatchup ? undefined : () => setSelectedMatchupId(null)}
      />
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-8 ${theme.font}`}>
      <div className={`text-lg font-bold uppercase tracking-wider ${theme.titleText}`}>
        Coin Toss Ceremony
      </div>
      <div className={`text-sm ${theme.mutedText}`}>
        Spectating — {matchups.length} matchup{matchups.length !== 1 ? "s" : ""}
      </div>
      <div className="space-y-2 w-full max-w-sm">
        {matchups.map(([matchupId, m]) => {
          const { offensePlayer, defensePlayer } = getOffenseDefense(m, getPlayerName)
          return (
            <button
              key={matchupId}
              type="button"
              onClick={() => setSelectedMatchupId(matchupId)}
              className={`w-full rounded px-4 py-3 text-left transition-all cursor-pointer ${theme.listItem} hover:ring-1 hover:ring-[#f5c542]/40`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm ${theme.bodyText}`}>
                  <span className="font-bold">{getPlayerName(m.callerId)}</span>
                  {" vs "}
                  <span className="font-bold">{getPlayerName(m.waiterId)}</span>
                </span>
                <CoinTossCountdown
                  deadlineMs={
                    m.step === "AWAITING_CALL"
                      ? m.coinCallDeadlineMs
                      : m.step === "AWAITING_CHOICE"
                        ? m.sideChoiceDeadlineMs
                        : null
                  }
                />
              </div>
              <div className={`text-xs ${theme.mutedText}`}>
                {m.step === "AWAITING_CALL" && (
                  <>Waiting for <span className={`font-bold ${theme.accentText}`}>{getPlayerName(m.callerId)}</span> to call</>
                )}
                {m.step === "AWAITING_CHOICE" && (
                  <>Waiting for <span className={`font-bold ${theme.accentText}`}>{getPlayerName(m.chooserId)}</span> to choose</>
                )}
                {m.step === "COMPLETE" && (
                  <span>
                    <span className={theme.accentText}>⚡ {offensePlayer}</span> offense
                    {" • "}
                    <span>{defensePlayer}</span> defense
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Spectator Detail View ─────────────────────────────────────────────────────

interface SpectatorDetailViewProps {
  matchupState: CoinTossCeremonyMatchupState
  getPlayerName: (id: string | null | undefined) => string
  onBack?: () => void
}

function SpectatorDetailView({ matchupState, getPlayerName, onBack }: SpectatorDetailViewProps) {
  const theme = useTheme()
  const [flipRevealed, setFlipRevealed] = useState(false)
  const callerName = getPlayerName(matchupState.callerId)
  const waiterName = getPlayerName(matchupState.waiterId)
  const chooserName = getPlayerName(matchupState.chooserId)

  return (
    <div className={`flex flex-col items-center justify-center gap-5 py-8 ${theme.font}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`self-start text-xs ${theme.mutedText} hover:${theme.bodyText} transition-colors flex items-center gap-1 cursor-pointer`}
        >
          <span aria-hidden="true">←</span> All matchups
        </button>
      )}

      <div className={`text-lg font-bold uppercase tracking-wider ${theme.titleText}`}>
        Coin Toss
      </div>
      <div className={`text-sm ${theme.bodyText}`}>
        <span className="font-bold">{callerName}</span>
        {" vs "}
        <span className="font-bold">{waiterName}</span>
      </div>
      <div className={`text-[10px] uppercase tracking-widest ${theme.mutedText} px-2 py-0.5 rounded bg-[#0f3d18]`}>
        Spectating
      </div>

      {matchupState.step === "AWAITING_CALL" && (
        <>
          <CoinTossCountdown deadlineMs={matchupState.coinCallDeadlineMs} />
          <div className="relative flex items-center justify-center">
            <div className="absolute h-14 w-14 animate-ping rounded-full bg-[#f5c542]/20" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1b5e2a] border border-[#f5c542]/40 animate-pulse">
              <span className="text-2xl" aria-hidden="true">🪙</span>
            </div>
          </div>
          <div className={`text-center text-sm ${theme.bodyText}`}>
            Waiting for <span className={`font-bold ${theme.accentText}`}>{callerName}</span> to call…
          </div>
        </>
      )}

      {matchupState.step === "AWAITING_CHOICE" && (
        <>
          <CoinFlipResult matchupState={matchupState} getPlayerName={getPlayerName} onRevealed={() => setFlipRevealed(true)} />
          {flipRevealed && (
            <>
              <CoinTossCountdown deadlineMs={matchupState.sideChoiceDeadlineMs} />
              <div className={`text-center text-sm ${theme.bodyText}`}>
                Waiting for <span className={`font-bold ${theme.accentText}`}>{chooserName}</span> to choose a side…
              </div>
            </>
          )}
        </>
      )}

      {matchupState.step === "COMPLETE" && (
        <CeremonyResult matchupState={matchupState} getPlayerName={getPlayerName} />
      )}
    </div>
  )
}
