# scripts/typecheck-playcaller.ps1
# Runs server typecheck and filters to playcaller-related output only.
# Usage: .\scripts\typecheck-playcaller.ps1

$output = pnpm --filter @games-of-chance/server typecheck 2>&1
$filtered = $output | Where-Object { $_ -match "playcaller|lottery" -or $_ -match "^Found \d+ error" }
if ($filtered) { $filtered | Select-Object -First 30 } else { Write-Host "No playcaller/lottery type errors" }
if ($LASTEXITCODE -ne 0 -and $filtered) { exit 1 } else { exit 0 }
