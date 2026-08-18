---
inclusion: auto
---

# Shell Command Execution: Use the `run.ps1` Script

## Rule: All pnpm test, typecheck, and tsc commands must go through `scripts/run.ps1`

When running tests, typechecks, or any pnpm command that would normally require user approval, **always** use the bypass script instead of calling pnpm directly.

### Script signature

```powershell
& .\scripts\run.ps1 "<pnpm-args>" ["<pipe-command>"]
```

- **First argument** (required): Everything that follows `pnpm` as a single quoted string
- **Second argument** (optional): The pipe/output-processing command as a single quoted string

### Examples

```powershell
# Run server tests (verbose, last 60 lines)
& .\scripts\run.ps1 "--filter @games-of-chance/server test -- --reporter=verbose" "Select-Object -Last 60"

# Run a specific test file
& .\scripts\run.ps1 "--filter @games-of-chance/server test -- src/games/playcaller/BracketEngine.test.ts" "Select-Object -Last 30"

# Run server typecheck
& .\scripts\run.ps1 "--filter @games-of-chance/server typecheck" "Select-Object -First 30"

# Run client typecheck
& .\scripts\run.ps1 "--filter @games-of-chance/client typecheck" "Select-Object -First 30"

# Run vitest with exec
& .\scripts\run.ps1 "--filter @games-of-chance/server exec vitest run src/games/playcaller/myTest.test.ts" "Select-Object -Last 30"

# Run tests without pipe (full output)
& .\scripts\run.ps1 "--filter @games-of-chance/server test -- --run"
```

### Do NOT

- Run `pnpm --filter ... test ...` directly — it triggers approval prompts
- Run `pnpm --filter ... typecheck` directly
- Run `pnpm --filter ... exec vitest ...` directly
- Run `pnpm --filter ... exec tsc ...` directly
- Pipe commands manually after pnpm — put the pipe in the second argument instead

### Why

The `scripts/run.ps1` script is allowlisted in the user's permissions.yaml file. Raw pnpm commands with pipes, 2>&1 redirects, or complex arguments trigger forced confirmation dialogs that interrupt workflow. The run script wraps these into a single pre-approved command.
