# Pre-commit check script - enforce development spec
#
# Install: run `powershell -File scripts/install-hooks.ps1` in project root
# Auto-runs on each git commit; blocks commit if checks fail
#
# Checks:
#   1. Hardcoded credentials scan (passwords, tokens, keys)
#   2. Debug code residue (console.log / debugger)
#   3. Required spec files exist (DEVELOPMENT_SPEC.md / DEV_LOG.md / docs/QA_TEST_SPEC.md)
#   4. Desktop version consistency (tauri.conf.json / Cargo.toml / package.json)
#   5. .env.deploy not committed (credential file)
#
# Bypass (emergency only): `git commit --no-verify`, explain reason in commit message

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

$Errors = @()
$Warnings = @()

# ============ 1. Hardcoded credentials scan ============
$ForbiddenPatterns = @(
    @{ Pattern = "Ee9527ffss"; Desc = "Server SSH password hardcoded" },
    @{ Pattern = "12293158d567645bf7b3d16dcad8e005"; Desc = "Gitee Token hardcoded" },
    @{ Pattern = "lynxtest123"; Desc = "Android signing password hardcoded" }
)

# Only scan staged files, not the whole repo
$StagedFiles = git diff --cached --name-only --diff-filter=ACM 2>$null
if (-not $StagedFiles) {
    exit 0
}

foreach ($file in $StagedFiles) {
    if (-not (Test-Path $file)) { continue }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    if ($ext -in @(".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp", ".mp4", ".mp3", ".pdf", ".zip", ".gz", ".tar", ".pfx", ".cer", ".key")) { continue }
    if ($file -match "^(node_modules|\.next|target|cargo-target-native|deploy/dist|\.git)/") { continue }
    # Skip self (contains check patterns) and android test keystore fallback
    if ($file -match "scripts/pre-commit-check\.ps1$") { continue }
    if ($file -match "^android/app/build\.gradle\.kts$") { continue }

    $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    foreach ($p in $ForbiddenPatterns) {
        if ($content -match [regex]::Escape($p.Pattern)) {
            $Errors += "[$file] $($p.Desc): found $($p.Pattern)"
        }
    }
}

# ============ 2. Debug code residue check ============
foreach ($file in $StagedFiles) {
    if (-not (Test-Path $file)) { continue }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    if ($ext -notin @(".ts", ".tsx", ".js", ".jsx", ".rs")) { continue }
    if ($file -match "^(src/lib/__tests__|e2e|scripts/deploy)/") { continue }
    if ($file -match "logger\.ts$|client-logger\.ts$") { continue }

    $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    if ($content -match "(?<![\w.])debugger\s*;") {
        $Errors += "[$file] debugger statement found, must remove"
    }
    $consoleLogMatches = [regex]::Matches($content, "(?<![\w.])console\.log\s*\(")
    if ($consoleLogMatches.Count -gt 3) {
        $Warnings += "[$file] $($consoleLogMatches.Count) console.log found, consider cleanup"
    }
}

# ============ 3. Required spec files ============
$RequiredFiles = @(
    "DEVELOPMENT_SPEC.md",
    "DEV_LOG.md",
    "docs/QA_TEST_SPEC.md"
)
foreach ($f in $RequiredFiles) {
    if (-not (Test-Path "$ProjectRoot\$f")) {
        $Errors += "Missing required spec file: $f"
    }
}

# ============ 4. Desktop version consistency ============
$HasDesktopChange = $StagedFiles | Where-Object { $_ -match "^desktop-native/" }
if ($HasDesktopChange) {
    $tauriConf = "$ProjectRoot\desktop-native\src-tauri\tauri.conf.json"
    $cargoToml = "$ProjectRoot\desktop-native\src-tauri\Cargo.toml"
    $desktopPkg = "$ProjectRoot\desktop-native\native-ui\package.json"

    if ((Test-Path $tauriConf) -and (Test-Path $cargoToml) -and (Test-Path $desktopPkg)) {
        $tauriVer = (Get-Content $tauriConf -Raw -Encoding UTF8 | ConvertFrom-Json).version
        $cargoVer = ([regex]::Match((Get-Content $cargoToml -Raw), 'version\s*=\s*"([^"]+)"').Groups[1].Value)
        $pkgVer = (Get-Content $desktopPkg -Raw | ConvertFrom-Json).version

        if ($tauriVer -ne $cargoVer -or $tauriVer -ne $pkgVer) {
            $Errors += "Desktop version mismatch: tauri.conf.json=$tauriVer, Cargo.toml=$cargoVer, package.json=$pkgVer (must sync, +0.01 per change)"
        }
    }
}

# ============ 5. .env.deploy not committed ============
foreach ($file in $StagedFiles) {
    if ($file -match "^\.env\.deploy$") {
        $Errors += ".env.deploy is forbidden (contains deploy credentials). Use .env.deploy.example template instead"
    }
    if ($file -match "^\.env\.production$" -and -not (Get-Content "$ProjectRoot\.gitignore" | Select-String "^\.env\.production$")) {
        $Errors += ".env.production may not be gitignored, please check"
    }
}

# ============ Output ============
if ($Warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "[pre-commit] Warnings (non-blocking):" -ForegroundColor Yellow
    foreach ($w in $Warnings) { Write-Host "  $w" -ForegroundColor Yellow }
}

if ($Errors.Count -gt 0) {
    Write-Host ""
    Write-Host "[pre-commit] FAILED, commit blocked:" -ForegroundColor Red
    foreach ($e in $Errors) { Write-Host "  $e" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Fix above issues and retry. Emergency bypass: git commit --no-verify" -ForegroundColor Cyan
    exit 1
}

Write-Host "[pre-commit] checks passed" -ForegroundColor Green
exit 0
