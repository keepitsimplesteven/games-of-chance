import { describe, it, expect } from "vitest"
import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process"
import { resolve } from "node:path"

const cwd = resolve(__dirname, "..")
const execOpts: ExecSyncOptionsWithStringEncoding = { cwd, encoding: "utf-8" }

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx src/cli.ts ${args}`, execOpts)
    return { stdout, exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: (error.stderr || error.stdout || "") as string,
      exitCode: error.status as number,
    }
  }
}

describe("CLI argument parsing and error handling", () => {
  it("valid args exit 0 and produce results output", () => {
    const { stdout, exitCode } = runCli(
      "--game coin-toss --players 4 --rounds 5 --games 10 --seed 42"
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain("Results")
    expect(stdout).toContain("coin-toss")
  })

  it("invalid game type exits with code 1 and prints error", () => {
    const { stdout, exitCode } = runCli("--game nonexistent --games 1")
    expect(exitCode).toBe(1)
    expect(stdout.toLowerCase()).toContain("error")
    expect(stdout).toContain("nonexistent")
  })

  it("invalid player count (< 2) exits with code 1 and mentions playerCount", () => {
    const { stdout, exitCode } = runCli(
      "--game coin-toss --players 1 --games 1"
    )
    expect(exitCode).toBe(1)
    expect(stdout).toContain("playerCount")
  })

  it("default values work (no explicit args uses coin-toss, 4 players, 10 rounds, 10000 games)", () => {
    const { stdout, exitCode } = runCli("--seed 123")
    expect(exitCode).toBe(0)
    expect(stdout).toContain("coin-toss")
    expect(stdout).toContain("Players: 4")
    expect(stdout).toContain("Rounds/game: 10")
    expect(stdout).toContain("10000 games")
  })
})
