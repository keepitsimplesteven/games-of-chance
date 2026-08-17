# scripts/typecheck-server.ps1
# Runs server typecheck and shows first 30 lines of output.
# Usage: pwsh scripts/typecheck-server.ps1

$output = pnpm --filter @games-of-chance/server typecheck 2>&1
$output | Select-Object -First 30
if ($LASTEXITCODE -ne 0) { exit 1 }
