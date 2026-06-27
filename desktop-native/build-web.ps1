# LynnHub 桌面端（native）本地前端构建脚本
# 说明：Next.js static export 不支持 API routes，因此临时移出 src/app/api，构建完成后再恢复。
# 该脚本只应在 desktop-native 构建时执行，不影响原 desktop/ 版本。

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "src\app\api"
$config = Join-Path $root "next.config.mjs"
$nativeConfig = Join-Path $root "next.desktop-native.config.mjs"
$backupDir = Join-Path $env:TEMP "lynnhub-desktop-native-api-backup-$(Get-Date -Format yyyyMMddHHmmss)"
$hasApiBackup = $false
$hasConfigBackup = $false

try {
    # 1. 备份并移除 API routes（static export 不支持 API routes）
    if (Test-Path $apiDir) {
        Write-Host "[desktop-native] 备份 src/app/api -> $backupDir"
        Move-Item -Path $apiDir -Destination $backupDir -Force
        $hasApiBackup = $true
    }

    # 2. 临时替换 next.config.mjs 为桌面端专用配置
    if (Test-Path $nativeConfig) {
        Write-Host "[desktop-native] 临时启用 next.desktop-native.config.mjs"
        Rename-Item -Path $config -NewName "next.config.mjs.desktop-native.bak" -Force
        Copy-Item -Path $nativeConfig -Destination $config -Force
        $hasConfigBackup = $true
    }

    # 3. 执行 static export
    Write-Host "[desktop-native] 执行 Next.js static export..."
    Push-Location $root
    npx next build --no-lint
    if ($LASTEXITCODE -ne 0) {
        throw "Next.js static export 失败，exit code: $LASTEXITCODE"
    }
    Pop-Location

    Write-Host "[desktop-native] 前端构建完成 -> desktop-native/dist-web" -ForegroundColor Green
} finally {
    # 4. 恢复 API routes（无论构建成败）
    if ($hasApiBackup -and (Test-Path $backupDir)) {
        Write-Host "[desktop-native] 恢复 src/app/api"
        if (Test-Path $apiDir) {
            Remove-Item -Path $apiDir -Recurse -Force
        }
        Move-Item -Path $backupDir -Destination $apiDir -Force
    }

    # 5. 恢复 next.config.mjs
    if ($hasConfigBackup) {
        Write-Host "[desktop-native] 恢复 next.config.mjs"
        Remove-Item -Path $config -Force -ErrorAction SilentlyContinue
        Rename-Item -Path "$config.desktop-native.bak" -NewName "next.config.mjs" -Force
    }
}
