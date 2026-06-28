param(
    [switch]$UninstallExisting
)
# Lynx native desktop build script
# Generate installer assets -> build native UI -> build Rust -> NSIS installer
# Use -UninstallExisting to force uninstall previous version before build

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$nsis = "$env:LOCALAPPDATA\tauri\NSIS\makensis.exe"
if (-not (Test-Path $nsis)) { $nsis = "D:\Lynn工作空间\LynnHub\Temp\NSIS\makensis.exe" }
$assetScript = Join-Path $root "..\scripts\generate-desktop-native-assets.py"

# ---------- Optional: uninstall existing version ----------
if ($UninstallExisting) {
    Write-Host "==> Uninstalling existing Lynx (if any)..."

    # Force kill running process to avoid file lock during uninstall
    $proc = Get-Process -Name "lynnhub-desktop-native" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "    Stopping running Lynx process..."
        Stop-Process -Name "lynnhub-desktop-native" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 800
    }

    $uninstReg = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx"
    $instDir = $null
    if (Test-Path $uninstReg) {
        $props = Get-ItemProperty $uninstReg
        $uninst = $props.UninstallString
        $instDir = $props.InstallLocation
        if ($uninst) {
            Write-Host "    Found uninstaller: $uninst"
            Start-Process -FilePath $uninst -ArgumentList "/S" -Wait -NoNewWindow
        }
    }

    # Fallback to default path if registry has no InstallLocation
    if (-not $instDir) {
        $instDir = "C:\Program Files\Lynx"
    }
    if (Test-Path $instDir) {
        Write-Host "    Cleaning residual directory: $instDir"
        Remove-Item -Recurse -Force $instDir -ErrorAction SilentlyContinue
    }

    # Clean registry entries
    if (Test-Path $uninstReg) {
        Remove-Item -Path $uninstReg -Recurse -Force -ErrorAction SilentlyContinue
    }
    $appPathReg = "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
    if (Test-Path $appPathReg) {
        Remove-Item -Path $appPathReg -Recurse -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 500
}

# ---------- Generate installer assets ----------
Write-Host "==> Generating installer assets..."
python $assetScript
if ($LASTEXITCODE -ne 0) { throw "Asset generation failed" }

# ---------- Build frontend native UI ----------
Write-Host "==> Cleaning old web assets..."
$outDir = Join-Path $root "out"
if (Test-Path $outDir) {
    Remove-Item -Recurse -Force $outDir -ErrorAction Stop
}

Write-Host "==> Building native UI..."
# Use Start-Process to avoid PowerShell NativeCommandError on stderr
$npmProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run","frontend:build" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "npm-stdout.log" -RedirectStandardError "npm-stderr.log"
if ($npmProc.ExitCode -ne 0) { throw "Frontend build failed" }

# Verify out/app exists
$appDir = Join-Path $outDir "app"
$appIndex = Join-Path $appDir "index.html"
if (-not (Test-Path $appIndex)) {
    throw "Native UI build output not found at $appIndex"
}
Write-Host "==> Native UI ready: $appIndex"

# ---------- Stage frontend assets to src-tauri/out/app (build.rs reads frontendDist) ----------
Write-Host "==> Staging frontend assets for Rust build..."
$tauriOutDir = Join-Path $root "src-tauri\out\app"
if (Test-Path $tauriOutDir) {
    Remove-Item -Recurse -Force $tauriOutDir -ErrorAction Stop
}
New-Item -ItemType Directory -Path $tauriOutDir -Force | Out-Null
Copy-Item -Path "$appDir\*" -Destination $tauriOutDir -Recurse -Force
Write-Host "==> Frontend assets staged at: $tauriOutDir"

# ---------- Build Rust binary ----------
Write-Host "==> Building Rust binary..."
Push-Location (Join-Path $root "src-tauri")
try {
    # Use Start-Process to avoid PowerShell NativeCommandError on stderr
    $cargoProc = Start-Process -FilePath "cargo.exe" -ArgumentList "build","--release" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "cargo-stdout.log" -RedirectStandardError "cargo-stderr.log"
    if ($cargoProc.ExitCode -ne 0) { throw "Rust build failed" }
} finally {
    Pop-Location
}

# Copy binary to fixed location for NSIS packaging
$here = (Get-Location).Path
$binDir = Join-Path $here "bin"
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$builtExe = "D:\cargo-target-native\release\lynnhub-desktop-native.exe"
$binExe = Join-Path $binDir "lynnhub-desktop-native.exe"
if (-not (Test-Path $builtExe)) { throw "Built binary not found at $builtExe" }
Copy-Item -Path $builtExe -Destination $binExe -Force
Write-Host "==> Binary staged: $binExe"

# ---------- Build NSIS installer ----------
Write-Host "==> Compiling NSIS installer..."
$distDir = Join-Path $root "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
# Use Start-Process to avoid PowerShell NativeCommandError on stderr
$nsisProc = Start-Process -FilePath $nsis -ArgumentList "/INPUTCHARSET UTF8","installer.nsi" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "nsis-stdout.log" -RedirectStandardError "nsis-stderr.log"
if ($nsisProc.ExitCode -ne 0) { throw "NSIS compile failed" }

$exe = Join-Path $root "dist\lynx_1.0.5.exe"
if (Test-Path $exe) {
    $size = (Get-Item $exe).Length
    Write-Host "==> Installer ready: $exe ($size bytes)"
} else {
    throw "Installer output not found"
}
