# Install Git hooks to .git/hooks/ directory
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install-hooks.ps1
#
# Installed hooks:
#   - pre-commit: invokes scripts/pre-commit-check.ps1 to enforce dev spec
#
# After install, every git commit auto-triggers the check, no extra config needed

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$HooksDir = "$ProjectRoot\.git\hooks"
$PreCommitScript = "$ProjectRoot\scripts\pre-commit-check.ps1"

if (-not (Test-Path $HooksDir)) {
    Write-Host "[install-hooks] .git/hooks not found, please run inside a git repo" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $PreCommitScript)) {
    Write-Host "[install-hooks] scripts/pre-commit-check.ps1 not found" -ForegroundColor Red
    exit 1
}

# pre-commit hook
$PreCommitHook = "$HooksDir\pre-commit"
$HookContent = @"
#!/bin/sh
# Auto-installed by scripts/install-hooks.ps1
# Pre-commit: enforce dev spec (credential scan, version sync, etc.)
powershell -ExecutionPolicy Bypass -File "`$PWD/scripts/pre-commit-check.ps1"
exit `$?
"@

Set-Content -Path $PreCommitHook -Value $HookContent -Encoding ASCII
Write-Host "[install-hooks] pre-commit hook installed to $PreCommitHook" -ForegroundColor Green

Write-Host ""
Write-Host "Done! Every git commit will now run the spec check automatically" -ForegroundColor Cyan
Write-Host "  - Skip check (emergency only): git commit --no-verify"
Write-Host "  - Uninstall: delete .git/hooks/pre-commit"
