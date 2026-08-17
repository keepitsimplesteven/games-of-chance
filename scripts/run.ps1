# scripts/run.ps1
# Generic bypass script for pnpm commands with optional output piping.
# Usage: .\scripts\run.ps1 "<pnpm-args>" ["<pipe-command>"]
#
# Examples:
#   .\scripts\run.ps1 "--filter @games-of-chance/server test -- --reporter=verbose" "Select-Object -Last 60"
#   .\scripts\run.ps1 "--filter @games-of-chance/server test -- src/games/playcaller" "Select-Object -Last 60"
#   .\scripts\run.ps1 "--filter @games-of-chance/server typecheck" "Select-Object -First 30"
#   .\scripts\run.ps1 "--filter @games-of-chance/client test -- --run"

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$PnpmArgs,

    [Parameter(Mandatory=$false, Position=1)]
    [string]$PipeCommand
)

# Split the pnpm args string into an array for splatting
$splitArgs = $PnpmArgs -split '\s+'

# Run pnpm with the provided arguments
$output = & pnpm @splitArgs 2>&1

# Apply pipe command if provided, otherwise output everything
if ($PipeCommand) {
    Invoke-Expression "`$output | $PipeCommand"
} else {
    $output
}

if ($LASTEXITCODE -ne 0) { exit 1 }
