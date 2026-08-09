/**
 * Robot Name Generation — pools of prefixes and suffixes for random robot names.
 */

const NAME_PREFIXES = [
  "Iron",
  "Steel",
  "Chrome",
  "Volt",
  "Neon",
  "Turbo",
  "Mega",
  "Cyber",
  "Blitz",
  "Nitro",
  "Plasma",
  "Quantum",
  "Shadow",
  "Thunder",
  "Cobalt",
  "Titan",
  "Apex",
  "Razor",
  "Nova",
  "Crimson",
] as const

const NAME_SUFFIXES = [
  "Crusher",
  "Viper",
  "Fang",
  "Claw",
  "Bolt",
  "Mauler",
  "Shredder",
  "Striker",
  "Ripper",
  "Wrecker",
  "Fury",
  "Storm",
  "Reaper",
  "Brawler",
  "Spike",
  "Blaster",
  "Charger",
  "Smasher",
  "Phantom",
  "Hammer",
] as const

/** Pick a random element from an array */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Generate a random robot name from prefix + suffix */
export function generateRobotName(): string {
  return `${pickRandom(NAME_PREFIXES)} ${pickRandom(NAME_SUFFIXES)}`
}

/** Generate N unique robot names */
export function generateUniqueNames(count: number): string[] {
  const names = new Set<string>()
  let attempts = 0
  while (names.size < count && attempts < count * 10) {
    names.add(generateRobotName())
    attempts++
  }
  // Fallback if we somehow can't get enough unique names
  while (names.size < count) {
    names.add(`Bot-${names.size + 1}`)
  }
  return [...names]
}
