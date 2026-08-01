import type { GameResult } from "./core"

export interface BatchStatistics {
  playerCount: number
  gameCount: number
  roundCount: number

  // Score distribution
  meanScore: number
  stdDevScore: number
  minScore: number
  maxScore: number
  maxMinRatio: number

  // Inequality
  giniCoefficient: number

  // Win rates (playerPosition → rank → count)
  winRateDistribution: number[][]

  // Snowball detection
  earlyLeadCorrelation: number

  // Streak analysis (per player position)
  maxConsecutiveWins: number[]
  maxConsecutiveLosses: number[]

  // Per-round variance
  scoreVarianceByRound: number[]
}

export class StatisticsReporter {
  /**
   * Compute all statistics from a batch of game results.
   */
  compute(games: GameResult[], playerCount: number): BatchStatistics {
    const gameCount = games.length
    const roundCount = gameCount > 0 ? games[0].rounds.length : 0

    // Collect all final scores across all players and all games
    const allScores: number[] = []
    for (const game of games) {
      for (const score of Object.values(game.finalScores)) {
        allScores.push(score)
      }
    }

    // Core score statistics
    const meanScore = allScores.length > 0
      ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length
      : 0

    const variance = allScores.length > 0
      ? allScores.reduce((sum, s) => sum + (s - meanScore) ** 2, 0) / allScores.length
      : 0

    const stdDevScore = Math.sqrt(variance)

    let minScore = 0
    let maxScore = 0
    if (allScores.length > 0) {
      minScore = allScores[0]
      maxScore = allScores[0]
      for (let i = 1; i < allScores.length; i++) {
        if (allScores[i] < minScore) minScore = allScores[i]
        if (allScores[i] > maxScore) maxScore = allScores[i]
      }
    }
    const maxMinRatio = minScore === 0 ? Infinity : maxScore / minScore

    // Gini coefficient over all player final scores
    const giniCoefficient = this.computeGini(allScores)

    // Streak analysis: max consecutive wins/losses per player position
    const maxConsecutiveWins = new Array<number>(playerCount).fill(0)
    const maxConsecutiveLosses = new Array<number>(playerCount).fill(0)

    for (let p = 0; p < playerCount; p++) {
      const playerId = `bot-${p}`
      let currentWinStreak = 0
      let currentLossStreak = 0

      for (const game of games) {
        for (const round of game.rounds) {
          const delta = round.deltas[playerId] ?? 0

          if (delta > 0) {
            currentWinStreak++
            currentLossStreak = 0
            if (currentWinStreak > maxConsecutiveWins[p]) {
              maxConsecutiveWins[p] = currentWinStreak
            }
          } else if (delta < 0) {
            currentLossStreak++
            currentWinStreak = 0
            if (currentLossStreak > maxConsecutiveLosses[p]) {
              maxConsecutiveLosses[p] = currentLossStreak
            }
          } else {
            // delta === 0: neither win nor loss, resets both streaks
            currentWinStreak = 0
            currentLossStreak = 0
          }
        }
      }
    }

    // Per-round variance: variance of all deltas at each round position across all games and players
    const scoreVarianceByRound: number[] = []

    for (let r = 0; r < roundCount; r++) {
      const deltas: number[] = []

      for (const game of games) {
        if (r < game.rounds.length) {
          for (const delta of Object.values(game.rounds[r].deltas)) {
            deltas.push(delta)
          }
        }
      }

      if (deltas.length === 0) {
        scoreVarianceByRound.push(0)
      } else {
        const mean = deltas.reduce((sum, d) => sum + d, 0) / deltas.length
        const v = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length
        scoreVarianceByRound.push(v)
      }
    }

    // Win-rate distribution: [playerPosition][rank] = count of games where that position finished at that rank
    const winRateDistribution = this.computeWinRateDistribution(games, playerCount)

    // Snowball detection: Pearson correlation between early-round score (round 3) and final rank
    const earlyLeadCorrelation = this.computeEarlyLeadCorrelation(games, playerCount)

    return {
      playerCount,
      gameCount,
      roundCount,
      meanScore,
      stdDevScore,
      minScore,
      maxScore,
      maxMinRatio,
      giniCoefficient,
      winRateDistribution,
      earlyLeadCorrelation,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      scoreVarianceByRound,
    }
  }

  /**
   * Gini coefficient: 0 = perfect equality, 1 = maximum inequality.
   * Formula: G = (2 * Σ((i+1) * y_i)) / (n * Σ(y_i)) - (n+1)/n
   * where y_i are sorted scores and n = number of values.
   *
   * Handles negative scores by shifting all values up by |min| before computing.
   */
  computeGini(scores: number[]): number {
    const n = scores.length
    if (n === 0) return 0

    // Handle negative scores by shifting up
    let min = scores[0]
    for (let i = 1; i < n; i++) {
      if (scores[i] < min) min = scores[i]
    }
    const shifted = min < 0
      ? scores.map(s => s - min)
      : scores

    const sorted = [...shifted].sort((a, b) => a - b)
    const sum = sorted.reduce((acc, v) => acc + v, 0)
    if (sum === 0) return 0

    let weightedSum = 0
    for (let i = 0; i < n; i++) {
      weightedSum += (i + 1) * sorted[i]
    }
    return (2 * weightedSum) / (n * sum) - (n + 1) / n
  }

  /**
   * Compute win-rate distribution: a 2D array [playerCount][playerCount]
   * where [p][r] = count of games where player position p finished in rank r.
   * Player position is derived from the player ID (bot-0 = position 0, bot-1 = position 1).
   * Rank is 0-indexed (0 = 1st place).
   */
  private computeWinRateDistribution(games: GameResult[], playerCount: number): number[][] {
    // Initialize 2D array with zeros
    const distribution: number[][] = Array.from({ length: playerCount }, () =>
      new Array(playerCount).fill(0)
    )

    for (const game of games) {
      for (const entry of game.leaderboard) {
        // Extract player position from ID (e.g., "bot-0" → 0)
        const positionMatch = entry.playerId.match(/bot-(\d+)/)
        if (positionMatch) {
          const position = parseInt(positionMatch[1], 10)
          // rank is 1-indexed in leaderboard, convert to 0-indexed
          const rankIndex = entry.rank - 1
          if (position < playerCount && rankIndex >= 0 && rankIndex < playerCount) {
            distribution[position][rankIndex]++
          }
        }
      }
    }

    return distribution
  }

  /**
   * Compute early-lead correlation (snowball detection).
   * For each game and each player, gets their score at round 3 (or last round if < 3 rounds)
   * and their final rank. Computes Pearson correlation across all (game × player) pairs.
   */
  private computeEarlyLeadCorrelation(games: GameResult[], playerCount: number): number {
    const earlyScores: number[] = []
    const finalRanks: number[] = []

    for (const game of games) {
      if (game.rounds.length === 0) continue

      // Get score at round 3 (or last round if fewer than 3 rounds)
      const earlyRoundIndex = Math.min(2, game.rounds.length - 1)
      const earlyRound = game.rounds[earlyRoundIndex]

      // Build a map of playerId → final rank from leaderboard
      const rankMap = new Map<string, number>()
      for (const entry of game.leaderboard) {
        rankMap.set(entry.playerId, entry.rank)
      }

      // For each player, collect early score and final rank
      for (let p = 0; p < playerCount; p++) {
        const playerId = `bot-${p}`
        const earlyScore = earlyRound.cumulativeScores[playerId]
        const finalRank = rankMap.get(playerId)

        if (earlyScore !== undefined && finalRank !== undefined) {
          earlyScores.push(earlyScore)
          finalRanks.push(finalRank)
        }
      }
    }

    return this.computeCorrelation(earlyScores, finalRanks)
  }

  /**
   * Pearson correlation between two arrays.
   * Used for snowball detection (early score vs final rank).
   */
  computeCorrelation(x: number[], y: number[]): number {
    const n = x.length
    if (n === 0) return 0
    const meanX = x.reduce((a, b) => a + b, 0) / n
    const meanY = y.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denomX = 0
    let denomY = 0
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX
      const dy = y[i] - meanY
      numerator += dx * dy
      denomX += dx * dx
      denomY += dy * dy
    }

    const denom = Math.sqrt(denomX * denomY)
    return denom === 0 ? 0 : numerator / denom
  }
}
