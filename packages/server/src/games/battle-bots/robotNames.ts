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
  "Hyper",
  "Arctic",
  "Inferno",
  "Onyx",
  "Toxic",
  "Venom",
  "Omega",
  "Alpha",
  "Havoc",
  "Phantom",
  "Obsidian",
  "Savage",
  "Brutal",
  "Atomic",
  "Wicked",
  "Rogue",
  "Feral",
  "Primal",
  "Molten",
  "Frost",
  "Ember",
  "Grim",
  "Rapid",
  "Solar",
  "Lunar",
  "Dread",
  "Chaos",
  "Fury",
  "Vengeful",
  "Silent",
  "Sonic",
  "Tempest",
  "Darksteel",
  "Scarlet",
  "Golden",
  "Violet",
  "Jade",
  "Copper",
  "Midnight",
  "Marble",
  "Rusty",
  "Warp",
  "Flux",
  "Photon",
  "Gravity",
  "Zero",
  "Mach",
  "Comet",
  "Orbital",
  "Scrap",
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
  "Basher",
  "Gnasher",
  "Chopper",
  "Slammer",
  "Scorcher",
  "Pulsar",
  "Ravager",
  "Dagger",
  "Mangler",
  "Torque",
  "Grinder",
  "Juggernaut",
  "Marauder",
  "Bruiser",
  "Annihilator",
  "Demolisher",
  "Obliterator",
  "Destroyer",
  "Punisher",
  "Gladiator",
  "Sentinel",
  "Prowler",
  "Stalker",
  "Hunter",
  "Slasher",
  "Buzzsaw",
  "Rampage",
  "Uppercut",
  "Tornado",
  "Avalanche",
  "Inferno",
  "Berserker",
  "Predator",
  "Warhead",
  "Barrage",
  "Gauntlet",
  "Piston",
  "Jackhammer",
  "Bulldozer",
  "Typhoon",
  "Voltage",
  "Behemoth",
  "Colossus",
  "Goliath",
  "Cyclone",
  "Vendetta",
  "Mayhem",
  "Havoc",
  "Onslaught",
  "Carnage",
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
