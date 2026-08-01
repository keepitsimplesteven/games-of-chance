import type { CoinTossPick, CoinSide } from "@games-of-chance/shared"
import type { Rng } from "../rng"
import type { PickGenerator } from "../pick-generator"
import { pickGeneratorRegistry } from "../pick-generator"

const SIDES: CoinSide[] = ["HEADS", "TAILS"]

export const coinTossPickGenerator: PickGenerator<CoinTossPick> = {
  gameType: "coin-toss",
  generatePick(rng: Rng): CoinTossPick {
    return { side: SIDES[rng.nextInt(SIDES.length)] }
  },
}

pickGeneratorRegistry.register(coinTossPickGenerator)
