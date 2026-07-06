# 对已有的桌面端安装包做 PFX 代码签名
# 输入：D:\cargo-target-native\release\bundle\nsis\奇思_1.0.35_x64-setup.exe
# 输出：D:\Lynn安装包\奇思_1.0.35.exe（已签名）

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $ProjectRoot

# 读取证书密码
$EnvDeploy = "$ProjectRoot\.env.deploy"
if (-not (Test-Path -LiteralPath $EnvDeploy)) {
    Write-Host "[sign] .env.deploy not found at: $EnvDeploy" -ForegroundColor Red
    exit 1
}
$match = Get-Content -LiteralPath $EnvDeploy | Select-String -Pattern "^DESKTOP_SIGN_PASSWORD=(.+)$"
if (-not $match) {
    Write-Host "[sign] DESKTOP_SIGN_PASSWORD not found in .env.deploy" -ForegroundColor Red
    exit 1
}
$PfxPassword = $match.Matches[0].Groups[1].Value.Trim()

$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
$PfxPath = "$ProjectRoot\desktop-electron\build\lynn-code-sign.pfx"
$SetupExe = "D:\cargo-target-native\release\bundle\nsis\奇思_1.0.35_x64-setup.exe"

if (-not (Test-Path -LiteralPath $SignTool)) { Write-Host "[sign] signtool missing: $SignTool" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $PfxPath)) { Write-Host "[sign] PFX missing: $PfxPath" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $SetupExe)) { Write-Host "[sign] SetupExe missing: $SetupExe" -ForegroundColor Red; exit 1 }

Write-Host "[sign] Signing: $SetupExe" -ForegroundColor Cyan
Write-Host "[sign] PFX: $PfxPath" -ForegroundColor DarkGray
Write-Host "[sign] Publisher: Lynn" -ForegroundColor DarkGray

# 签名
& $SignTool sign /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td sha256 /fd sha256 $SetupExe
if ($LASTEXITCODE -ne 0) {
    Write-Host "[sign] Sign failed (exit=$LASTEXITCODE)" -ForegroundColor Red
    exit 1
}
Write-Host "[sign] Sign OK" -ForegroundColor Green

# 验证签名
Write-Host ""
Write-Host "[sign] Verifying signature..." -ForegroundColor Cyan
& $SignTool verify /pa /v $SetupExe 2>&1 | Select-Object -First 20

# 复制到固定目录
$InstallerFixedDir = "D:\Lynn安装包"
$FinalInstallerName = "奇思_1.0.35.exe"
New-Item -ItemType Directory -Path $InstallerFixedDir -Force | Out-Null
$FinalPath = Join-Path $InstallerFixedDir $FinalInstallerName
Copy-Item $SetupExe $FinalPath -Force
$sizeMB = [math]::Round((Get-Item $FinalPath).Length / 1MB, 2)
Write-Host ""
Write-Host "[sign] Done! Installer ready: $FinalPath ($sizeMB MB)" -ForegroundColor Green
