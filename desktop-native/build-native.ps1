param(
    [switch]$UninstallExisting
)
# Lynx native desktop build script
# 生成安装资源 -> 构建 native UI -> 编译 Rust -> NSIS 打包
# 参数：-UninstallExisting 构建前强制卸载本地已安装版本（测试用）

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$nsis = Join-Path (Split-Path -Parent $root) "Temp\NSIS\makensis.exe"
$assetScript = Join-Path $root "..\scripts\generate-desktop-native-assets.py"

# ---------- 可选：卸载本地已安装版本 ----------
if ($UninstallExisting) {
    Write-Host "==> Uninstalling existing Lynx (if any)..."

    # 先强制关闭进程，避免卸载时文件被占用
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

    # 如果注册表里没有 InstallLocation，使用默认路径
    if (-not $instDir) {
        $instDir = "C:\Program Files\Lynx"
    }
    if (Test-Path $instDir) {
        Write-Host "    Cleaning residual directory: $instDir"
        Remove-Item -Recurse -Force $instDir -ErrorAction SilentlyContinue
    }

    # 清理注册表残留
    if (Test-Path $uninstReg) {
        Remove-Item -Path $uninstReg -Recurse -Force -ErrorAction SilentlyContinue
    }
    $appPathReg = "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
    if (Test-Path $appPathReg) {
        Remove-Item -Path $appPathReg -Recurse -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 500
}

# ---------- 生成安装资源 ----------
Write-Host "==> Generating installer assets..."
python $assetScript
if ($LASTEXITCODE -ne 0) { throw "Asset generation failed" }

# ---------- 清理并构建 native UI ----------
Write-Host "==> Cleaning old web assets..."
$outDir = Join-Path $root "out"
if (Test-Path $outDir) {
    Remove-Item -Recurse -Force $outDir -ErrorAction Stop
}

Write-Host "==> Building native UI..."
npm run frontend:build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# 确认 out/app 存在
$appDir = Join-Path $outDir "app"
$appIndex = Join-Path $appDir "index.html"
if (-not (Test-Path $appIndex)) {
    throw "Native UI build output not found at $appIndex"
}
Write-Host "==> Native UI ready: $appIndex"

# ---------- 复制前端资源到 src-tauri/out/app（供 build.rs 校验 frontendDist） ----------
Write-Host "==> Staging frontend assets for Rust build..."
$tauriOutDir = Join-Path $root "src-tauri\out\app"
if (Test-Path $tauriOutDir) {
    Remove-Item -Recurse -Force $tauriOutDir -ErrorAction Stop
}
New-Item -ItemType Directory -Path $tauriOutDir -Force | Out-Null
Copy-Item -Path "$appDir\*" -Destination $tauriOutDir -Recurse -Force
Write-Host "==> Frontend assets staged at: $tauriOutDir"

# ---------- 编译 Rust binary ----------
Write-Host "==> Building Rust binary..."
Push-Location (Join-Path $root "src-tauri")
try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { throw "Rust build failed" }
} finally {
    Pop-Location
}

# 将二进制复制到固定位置，供 NSIS 打包
$here = (Get-Location).Path
$binDir = Join-Path $here "bin"
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$builtExe = "D:\cargo-target-native\release\lynnhub-desktop-native.exe"
$binExe = Join-Path $binDir "lynnhub-desktop-native.exe"
if (-not (Test-Path $builtExe)) { throw "Built binary not found at $builtExe" }
Copy-Item -Path $builtExe -Destination $binExe -Force
Write-Host "==> Binary staged: $binExe"

# ---------- 编译 NSIS 安装包 ----------
Write-Host "==> Compiling NSIS installer..."
$distDir = Join-Path $root "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
& $nsis /INPUTCHARSET UTF8 installer.nsi
if ($LASTEXITCODE -ne 0) { throw "NSIS compile failed" }

$exe = Join-Path $root "dist\lynx_1.0.0.exe"
if (Test-Path $exe) {
    $size = (Get-Item $exe).Length
    Write-Host "==> Installer ready: $exe ($size bytes)"
} else {
    throw "Installer output not found"
}
