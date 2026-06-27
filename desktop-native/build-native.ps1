# Lynx 原生桌面端完整构建脚本
# 产物：dist\Lynx-Setup-1.2.0.exe
# 注意：需要预先安装 Rust MSVC 工具链、Node.js、NSIS

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$exeSource = "D:\cargo-target-native\release\lynnhub-desktop-native.exe"
$installerScript = Join-Path $root "installer.nsi"
$distDir = Join-Path $root "dist"

function Write-Info($msg) { Write-Host "[build-native] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[build-native] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[build-native] $msg" -ForegroundColor Red }

# 1. 检查工具链
try {
    $toolchain = rustup show active-toolchain 2>$null
    Write-Info "当前 Rust 工具链: $toolchain"
    if ($toolchain -notmatch "msvc") {
        throw "必须使用 MSVC 工具链，当前为: $toolchain"
    }
} catch {
    Write-Err "Rust 工具链检查失败: $_"
    Write-Info "请执行: rustup default stable-x86_64-pc-windows-msvc"
    exit 1
}

# 2. 检查 NSIS
$nsisPaths = @(
    "C:\Program Files (x86)\NSIS\makensis.exe",
    "C:\Program Files\NSIS\makensis.exe",
    (Join-Path $env:LOCALAPPDATA "tauri\NSIS\makensis.exe")
)
$makensis = $nsisPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $makensis) {
    Write-Err "未找到 makensis.exe，请安装 NSIS 3.x"
    Write-Info "下载地址: https://sourceforge.net/projects/nsis/files/"
    exit 1
}
Write-Info "使用 NSIS: $makensis"

# 3. 构建独立前端（Next.js static export -> desktop-native/dist-web）
Write-Info "构建独立前端到 dist-web..."
$webScript = Join-Path $root "build-web.ps1"
if (!(Test-Path $webScript)) {
    throw "缺少前端构建脚本: $webScript"
}
& $webScript
if ($LASTEXITCODE -ne 0) {
    throw "独立前端构建失败"
}
$distWeb = Join-Path $root "dist-web"
if (!(Test-Path (Join-Path $distWeb "index.html"))) {
    throw "dist-web/index.html 不存在，前端构建异常"
}
Write-Ok "独立前端构建完成: $distWeb"

# 4. 将完整前端合并到启动页资源目录（out/app），实现离线原生桌面体验
$outApp = Join-Path $root "out\app"
if (Test-Path $outApp) {
    Write-Info "清理旧 out/app..."
    Remove-Item -Path $outApp -Recurse -Force
}
Write-Info "复制 dist-web -> out/app..."
Copy-Item -Path $distWeb -Destination $outApp -Recurse -Force
Write-Ok "前端资源已合并到 out/app"

# 5. 构建 Tauri Release（生成 MSVC 二进制，frontendDist: ../out）
Write-Info "开始构建 Tauri Release..."
Push-Location $root
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"  # tauri build 会输出 Info 到 stderr，避免被误判为错误
npm run build 2>&1 | ForEach-Object { Write-Host $_ }
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $oldEAP
if ($exitCode -ne 0) {
    throw "Tauri build 失败 (exit code: $exitCode)"
}
Pop-Location

# 6. 确保产物存在
if (!(Test-Path $exeSource)) {
    throw "未找到构建产物: $exeSource"
}
Write-Ok "Tauri 构建产物: $exeSource"

# 7. 创建安装包输出目录
if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# 8. 编译 NSIS 安装脚本（UTF-8 编码）
Write-Info "编译 NSIS 安装脚本..."
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $makensis /INPUTCHARSET UTF8 $installerScript
$nsisExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAP
if ($nsisExit -ne 0) {
    throw "NSIS 编译失败 (exit code: $nsisExit)"
}

$installer = Join-Path $distDir "Lynx-Setup-1.2.0.exe"
if (Test-Path $installer) {
    Write-Ok "安装包已生成: $installer"
    $size = (Get-Item $installer).Length / 1MB
    Write-Info "文件大小: $([math]::Round($size, 2)) MB"
} else {
    throw "安装包未生成"
}
