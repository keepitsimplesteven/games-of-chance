# scripts/test-server.ps1
# Runs server tests with optional path filter.
# Usage: pwsh scripts/test-server.ps1 [optional-test-path]

if ($args.Count -gt 0) {
    $output = pnpm --filter @games-of-chance/server test -- $args[0] 2>&1
} else {
    $output = pnpm --filter @games-of-chance/server test 2>&1
}
$output | Select-Object -First 80
if ($LASTEXITCODE -ne 0) { exit 1 }
