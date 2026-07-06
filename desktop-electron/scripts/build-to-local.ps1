# 奇思桌面端 - 打包到本地测试目录
# 构建 .exe + 证书 + 信任工具 → D:\LynnHub\packages\<version>\
# 用户下载测试，确认无误后再上传 Gitee Release
#
# 使用：powershell -ExecutionPolicy Bypass -File desktop-electron\scripts\build-to-local.ps1

$ErrorActionPreference = "Stop"
$projectRoot = "D:\Lynn工作空间\LynnHub"
$desktopDir = Join-Path $projectRoot "desktop-electron"
$packagesDir = "D:\LynnHub\packages"

Set-Location $desktopDir

# 1. 读取版本号
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version
Write-Host "========== 奇思桌面端 v$version 打包到本地 ==========" -ForegroundColor Cyan
Write-Host "[1/5] 版本号: $version" -ForegroundColor Yellow

# 2. 准备输出目录
$outDir = Join-Path $packagesDir $version
if (Test-Path $outDir) {
    Remove-Item $outDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Write-Host "[2/5] 输出目录: $outDir" -ForegroundColor Yellow

# 3. 构建
Write-Host "[3/5] 开始构建（npm run build:win）..." -ForegroundColor Yellow
npm run build:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 构建失败" -ForegroundColor Red
    exit 1
}

# 4. 查找生成的 .exe
$releaseDir = Join-Path $desktopDir "release-final"
$exeName = "QisiSetup-$version.exe"
$exePath = Join-Path $releaseDir $exeName
if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] 未找到安装包: $exePath" -ForegroundColor Red
    Get-ChildItem $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue | Format-Table Name, Length
    exit 1
}

# 5. 复制文件到 packages/<version>/
Write-Host "[4/5] 复制文件到 $outDir ..." -ForegroundColor Yellow

# 安装包
Copy-Item $exePath $outDir -Force
$exeSize = (Get-Item $exePath).Length
Write-Host "  - $exeName ($([math]::Round($exeSize/1MB, 2)) MB)"

# 证书公钥
$cerPath = Join-Path $desktopDir "build\lynn-code-sign.cer"
if (Test-Path $cerPath) {
    Copy-Item $cerPath $outDir -Force
    Write-Host "  - lynn-code-sign.cer"
}

# 信任证书脚本
$batPath = Join-Path $desktopDir "build\信任奇思证书.bat"
if (Test-Path $batPath) {
    Copy-Item $batPath $outDir -Force
    Write-Host "  - 信任奇思证书.bat"
}

# 6. 生成 README
Write-Host "[5/5] 生成测试说明..." -ForegroundColor Yellow
$buildTime = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$exeSizeMB = [math]::Round($exeSize/1MB, 2)
$readmeLines = @(
    "# 奇思桌面端 v$version 测试包",
    "",
    "## 文件清单",
    "- QisiSetup-$version.exe - 安装包（$exeSizeMB MB）",
    "- lynn-code-sign.cer - 代码签名证书（公钥）",
    "- 信任奇思证书.bat - 一键信任证书脚本（无需管理员权限）",
    "",
    "## 安装步骤",
    "",
    "### 方式一：先信任证书（推荐，安装时不显示未知发布者）",
    "1. 双击运行「信任奇思证书.bat」",
    "2. 输入 Y 确认导入证书",
    "3. 双击 QisiSetup-$version.exe 安装",
    "",
    "### 方式二：直接安装（会显示未知发布者警告）",
    "1. 双击 QisiSetup-$version.exe",
    "2. 如出现 SmartScreen 警告，点击「更多信息」然后「仍要运行」",
    "3. 如出现未知发布者，点击「仍要运行」",
    "",
    "## 测试要点",
    "- [ ] TC1: 安装包可正常下载",
    "- [ ] TC2: 信任证书后安装无未知发布者警告",
    "- [ ] TC3: 安装界面正常（图标、侧边栏、License）",
    "- [ ] TC4: 安装完成后任务栏图标正常",
    "- [ ] TC5: 窗口可拖动",
    "- [ ] TC6: 系统托盘图标正常",
    "- [ ] TC7: HermesAgent 检查更新（配置模块）",
    "- [ ] TC8: HermesAgent 一键安装（内置 whl）",
    "- [ ] TC9: WS 连接正常（设备上线）",
    "- [ ] TC10: 飞书任务同步 Web 端",
    "- [ ] TC11: 奇思超级助理同步 Web 端",
    "",
    "## 构建信息",
    "- 构建时间: $buildTime",
    "- 版本号: $version",
    "- 内置 HermesAgent: v0.18.0（离线可用）",
    "- 证书: CN=LynnHub（有效期至 2029-06-30）",
    "",
    "确认无误后，将上传到 Gitee Release 作为线上下载地址。"
)
$readmeContent = $readmeLines -join "`r`n"
$readmePath = Join-Path $outDir "README.md"
Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8
Write-Host "  - README.md"

# 完成
Write-Host ""
Write-Host "========== 打包完成 ==========" -ForegroundColor Green
Write-Host "输出目录: $outDir" -ForegroundColor Cyan
Write-Host ""
Get-ChildItem $outDir | Format-Table Name, @{N='Size(KB)';E={[math]::Round($_.Length/1KB,1)}}
Write-Host ""
Write-Host "测试流程：" -ForegroundColor Cyan
Write-Host "  1. 从 $outDir 下载所有文件" -ForegroundColor White
Write-Host "  2. 先运行「信任奇思证书.bat」" -ForegroundColor White
Write-Host "  3. 再安装 QisiSetup-$version.exe" -ForegroundColor White
Write-Host "  4. 确认无误后通知上传 Gitee Release" -ForegroundColor White
