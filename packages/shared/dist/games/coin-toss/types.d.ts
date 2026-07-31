/** The two possible sides of a coin */
export type CoinSide = "HEADS" | "TAILS";
/** A player's pick for a coin toss round */
export interface CoinTossPick {
    side: CoinSide;
}
/** The result of a coin toss round resolved by the server */
export interface CoinTossResult {
    outcome: CoinSide;
    /** Timestamp (epoch ms) when the coin was flipped — used for animation sync */
    flippedAt: number;
}
//# sourceMappingURL=types.d.ts.map