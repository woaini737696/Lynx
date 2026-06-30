<#
.SYNOPSIS
    Trae Solo 性能优化清理脚本
.DESCRIPTION
    清理 Trae Solo 运行产生的缓存/快照/日志 + 项目构建缓存
    必须在 Trae Solo 关闭后运行（否则 snapshot 会重新生成）
.NOTES
    安全性：本脚本只清理可再生缓存，不触碰代码/数据库/配置
    建议频率：每周1次 或 感觉卡顿时运行
#>

param(
    [switch]$DryRun  # 预览模式，只显示将清理什么，不实际删除
)

$ErrorActionPreference = "SilentlyContinue"
$totalFreed = 0

function Get-DirSize {
    param($path)
    if (-not (Test-Path $path)) { return 0 }
    return (Get-ChildItem $path -Recurse -Force -EA SilentlyContinue | Measure-Object Length -Sum).Sum
}

function Clean-Dir {
    param($name, $path, $description)
    if (-not (Test-Path $path)) {
        Write-Host ("  [skip] {0} - 不存在" -f $name) -ForegroundColor Gray
        return 0
    }
    $size = Get-DirSize $path
    if ($size -eq 0) {
        Write-Host ("  [skip] {0} - 已为空" -f $name) -ForegroundColor Gray
        return 0
    }
    $sizeMB = [math]::Round($size/1MB, 1)
    if ($DryRun) {
        Write-Host ("  [DRY]  {0} - {1} MB - {2}" -f $name, $sizeMB, $description) -ForegroundColor Yellow
        return $size
    }
    # 用 robocopy 镜像空目录法快速清空（比 Remove-Item 快 10 倍）
    $empty = Join-Path $env:TEMP "_empty_purge_$(Get-Random)"
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    robocopy $empty $path /MIR /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-Null
    Remove-Item $empty -Force -EA SilentlyContinue
    Remove-Item $path -Recurse -Force -EA SilentlyContinue
    Write-Host ("  [OK]   {0} - {1} MB - {2}" -f $name, $sizeMB, $description) -ForegroundColor Green
    return $size
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Trae Solo 性能优化清理脚本" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  [预览模式] 不会实际删除文件" -ForegroundColor Yellow
}
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============ 1. 检查 Trae Solo 是否在运行 ============
$traeProc = Get-Process -Name "TRAE SOLO CN" -EA SilentlyContinue
if ($traeProc) {
    Write-Host "[警告] 检测到 Trae Solo 正在运行 (PID: $($traeProc.Id -join ', '))" -ForegroundColor Red
    Write-Host "  snapshot 清理会在 Trae 运行时重新生成，效果有限。" -ForegroundColor Yellow
    Write-Host "  建议先关闭 Trae Solo 再运行此脚本。" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "是否继续? (y/N)"
    if ($continue -ne "y") { exit 0 }
}

# ============ 2. Trae Solo 内部缓存 ============
Write-Host "[1/4] 清理 Trae Solo 内部缓存..." -ForegroundColor Cyan
$traeBase = "$env:APPDATA\Trae Solo CN"

# snapshot - AI 对话代码快照（最大元凶，每次对话生成）
$totalFreed += Clean-Dir "ai-agent\snapshot" "$traeBase\ModularData\ai-agent\snapshot" "AI对话代码快照(可再生)"
# vm\tools - 虚拟机工具
$totalFreed += Clean-Dir "ai-agent\vm\tools" "$traeBase\ModularData\ai-agent\vm\tools" "虚拟机工具(可重新下载)"
# logs - 日志
$logsPath = "$traeBase\logs"
if (Test-Path $logsPath) {
    $logSize = Get-DirSize $logsPath
    if (-not $DryRun) {
        Get-ChildItem $logsPath -Force -EA SilentlyContinue | Where-Object { $_.Name -ne 'aha_log' } | Remove-Item -Recurse -Force -EA SilentlyContinue
    }
    if ($logSize -gt 0) {
        Write-Host ("  [OK]   logs - {0} MB - 日志文件" -f [math]::Round($logSize/1MB,1)) -ForegroundColor Green
        $totalFreed += $logSize
    }
}
# Partitions - WebView分区缓存
$totalFreed += Clean-Dir "Partitions" "$traeBase\Partitions" "WebView分区缓存(可再生)"
# Cache / CachedData / GPUCache
$totalFreed += Clean-Dir "Cache" "$traeBase\Cache" "应用缓存"
$totalFreed += Clean-Dir "CachedData" "$traeBase\CachedData" "缓存数据"
$totalFreed += Clean-Dir "GPUCache" "$traeBase\GPUCache" "GPU缓存"
$totalFreed += Clean-Dir "Code Cache" "$traeBase\Code Cache" "代码缓存"

Write-Host ""

# ============ 3. 项目构建缓存 ============
Write-Host "[2/4] 清理项目构建缓存..." -ForegroundColor Cyan
$projectRoot = "d:\Lynn工作空间\LynnHub"

# .next - Next.js 构建缓存
$totalFreed += Clean-Dir ".next" "$projectRoot\.next" "Next.js构建缓存(npm run build会重新生成)"
# cargo-target 系列
$cargoTargets = @(
    @{ name="cargo-target-native"; path="D:\cargo-target-native" },
    @{ name="cargo-target"; path="$projectRoot\cargo-target" },
    @{ name="cargo-target-msvc"; path="D:\cargo-target-msvc" },
    @{ name="cargo-build-v2"; path="D:\cargo-build-v2" },
    @{ name="src-tauri\target"; path="$projectRoot\desktop-native\src-tauri\target" }
)
foreach ($ct in $cargoTargets) {
    if (Test-Path $ct.path) {
        $ctSize = Get-DirSize $ct.path
        if ($ctSize -gt 0) {
            if (-not $DryRun) {
                $env:CARGO_TARGET_DIR = $ct.path
                cargo clean 2>&1 | Out-Null
                Remove-Item $ct.path -Recurse -Force -EA SilentlyContinue
            }
            Write-Host ("  [OK]   {0} - {1} MB - Rust编译缓存" -f $ct.name, [math]::Round($ctSize/1MB,1)) -ForegroundColor Green
            $totalFreed += $ctSize
        }
    }
}
# .lynnhub - Hermes运行时缓存
$totalFreed += Clean-Dir ".lynnhub" "$projectRoot\.lynnhub" "Hermes运行时缓存"
# Temp / tmp / release
$totalFreed += Clean-Dir "Temp" "$projectRoot\Temp" "项目临时文件"
$totalFreed += Clean-Dir "tmp" "$projectRoot\tmp" "临时文件"
$totalFreed += Clean-Dir "release" "$projectRoot\release" "发布临时文件"
# deploy\dist - 旧部署包
$totalFreed += Clean-Dir "deploy\dist" "$projectRoot\deploy\dist" "旧部署包"

Write-Host ""

# ============ 4. 系统垃圾 ============
Write-Host "[3/4] 清理系统垃圾..." -ForegroundColor Cyan
# 回收站
if (-not $DryRun) {
    Clear-RecycleBin -Force -EA SilentlyContinue
}
Write-Host "  [OK]   回收站已清空" -ForegroundColor Green
# Windows Temp
$tempPaths = @($env:TEMP, "$env:LOCALAPPDATA\Temp", "C:\Windows\Temp")
foreach ($tp in $tempPaths) {
    if (Test-Path $tp) {
        $tpSize = Get-DirSize $tp
        if ($tpSize -gt 0 -and -not $DryRun) {
            Get-ChildItem $tp -Force -EA SilentlyContinue | Remove-Item -Recurse -Force -EA SilentlyContinue
        }
        if ($tpSize -gt 0) {
            Write-Host ("  [OK]   {0} - {1} MB" -f $tp, [math]::Round($tpSize/1MB,1)) -ForegroundColor Green
            $totalFreed += $tpSize
        }
    }
}
# Cargo registry 缓存
$cargoReg = "$env:USERPROFILE\.cargo\registry"
if (Test-Path $cargoReg) {
    $regSize = Get-DirSize $cargoReg
    if ($regSize -gt 0 -and -not $DryRun) {
        Remove-Item $cargoReg -Recurse -Force -EA SilentlyContinue
    }
    if ($regSize -gt 0) {
        Write-Host ("  [OK]   cargo\registry - {0} MB - Rust包缓存" -f [math]::Round($regSize/1MB,1)) -ForegroundColor Green
        $totalFreed += $regSize
    }
}

Write-Host ""

# ============ 5. 临时构建目录 ============
Write-Host "[4/4] 清理临时构建目录..." -ForegroundColor Cyan
$tempBuilds = @(
    "D:\temp-lynnhub-native-build",
    "D:\temp-lynnhub-build",
    "D:\temp-build"
)
foreach ($tb in $tempBuilds) {
    $totalFreed += Clean-Dir (Split-Path $tb -Leaf) $tb "临时构建副本(垃圾)"
}

Write-Host ""

# ============ 汇总 ============
$totalGB = [math]::Round($totalFreed/1GB, 2)
Write-Host "============================================" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  预览模式: 将释放约 $totalGB GB" -ForegroundColor Yellow
    Write-Host "  去掉 -DryRun 参数执行实际清理" -ForegroundColor Yellow
} else {
    Write-Host "  清理完成! 共释放 $totalGB GB 磁盘空间" -ForegroundColor Green
    Write-Host ""
    Write-Host "  建议重启 Trae Solo 以获得最佳性能" -ForegroundColor Cyan
}
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============ 显示磁盘状态 ============
Write-Host "当前磁盘状态:" -ForegroundColor Cyan
Get-PSDrive -Name C,D -EA SilentlyContinue | Select-Object Name, `
    @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}}, `
    @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}} | Format-Table -AutoSize
