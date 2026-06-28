$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$nsis = Join-Path (Split-Path -Parent $root) "Temp\NSIS\makensis.exe"
$assetScript = Join-Path $root "..\scripts\generate-desktop-native-assets.py"

Write-Host "==> Generating installer assets..."
python $assetScript
if ($LASTEXITCODE -ne 0) { throw "Asset generation failed" }

Write-Host "==> Building native UI..."
npm run frontend:build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

Write-Host "==> Building Rust binary..."
# 必须在 src-tauri 目录下执行 cargo，才能正确读取 .cargo/config.toml 中的 target-dir
Push-Location (Join-Path $root "src-tauri")
try {
    cargo build --release
    if ($LASTEXITCODE -ne 0) { throw "Rust build failed" }
} finally {
    Pop-Location
}

# 将二进制复制到固定位置，供 NSIS 打包（避免依赖 target-dir 配置）
# 使用当前目录（即脚本所在目录）作为根目录，避免 $root 在后台任务中偶发为空
$here = (Get-Location).Path
$binDir = Join-Path $here "bin"
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$builtExe = "D:\cargo-target-native\release\lynnhub-desktop-native.exe"
$binExe = Join-Path $binDir "lynnhub-desktop-native.exe"
if (-not (Test-Path $builtExe)) { throw "Built binary not found at $builtExe" }
Copy-Item -Path $builtExe -Destination $binExe -Force
Write-Host "==> Binary staged: $binExe"

Write-Host "==> Compiling NSIS installer..."
& $nsis installer.nsi
if ($LASTEXITCODE -ne 0) { throw "NSIS compile failed" }

$exe = Join-Path $root "dist\lynx_1.0.0.exe"
if (Test-Path $exe) {
    $size = (Get-Item $exe).Length
    Write-Host "==> Installer ready: $exe ($size bytes)"
} else {
    throw "Installer output not found"
}
