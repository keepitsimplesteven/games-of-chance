export class UnknownGameTypeError extends Error {
  constructor(public readonly gameType: string) {
    super(`Unknown game type "${gameType}" — not registered in GameRegistry`)
    this.name = "UnknownGameTypeError"
  }
}

export class MissingPickGeneratorError extends Error {
  constructor(public readonly gameType: string) {
    super(`No PickGenerator registered for game type "${gameType}"`)
    this.name = "MissingPickGeneratorError"
  }
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidConfigError"
  }
}
