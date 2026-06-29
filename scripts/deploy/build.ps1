# Lynx 本地构建脚本 - 构建产物供服务器部署使用
# 服务器不做任何编译，只接收此脚本产出的打包文件
# 用法：.\scripts\deploy\build.ps1 [-SkipDesktop]

param(
  [switch]$SkipDesktop
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $ProjectRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DistDir = "$ProjectRoot\deploy\dist"
$PkgName = "lynx-deploy-$Timestamp"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lynx 本地构建 (产物用于服务器部署)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "时间戳: $Timestamp"
Write-Host ""

# 1. 清理旧产物
if (Test-Path $DistDir) {
  Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
New-Item -ItemType Directory -Path "$DistDir\$PkgName" -Force | Out-Null

# 2. 安装依赖
Write-Host "[1/6] 检查依赖..." -ForegroundColor Yellow
npm ci --production=false 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci 失败，尝试 npm install" -ForegroundColor Yellow
  npm install
}

# 3. Prisma generate
Write-Host "[2/6] Prisma generate..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate 失败" }

# 4. Next.js 构建 (standalone)
Write-Host "[3/6] Next.js 构建 (standalone)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "next build 失败" }

# 5. 复制 standalone 产物
Write-Host "[4/6] 打包 standalone 产物..." -ForegroundColor Yellow
$StandaloneDir = "$DistDir\$PkgName\standalone"
New-Item -ItemType Directory -Path $StandaloneDir -Force | Out-Null

# 复制 standalone server.js + node_modules
Copy-Item -Recurse "$ProjectRoot\.next\standalone\*" $StandaloneDir

# 复制 .next/static（standalone 不含 static，需手动复制）
New-Item -ItemType Directory -Path "$StandaloneDir\.next\static" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\.next\static\*" "$StandaloneDir\.next\static"

# 复制 public
if (Test-Path "$ProjectRoot\public") {
  Copy-Item -Recurse "$ProjectRoot\public" "$StandaloneDir\public"
}

# 复制 prisma schema（服务器端执行 db push 需要）
New-Item -ItemType Directory -Path "$StandaloneDir\prisma" -Force | Out-Null
Copy-Item "$ProjectRoot\prisma\schema.prisma" "$StandaloneDir\prisma\"
if (Test-Path "$ProjectRoot\prisma\seed.ts") {
  Copy-Item "$ProjectRoot\prisma\seed.ts" "$StandaloneDir\prisma\"
}

# 6. 复制官网
Write-Host "[5/6] 打包官网..." -ForegroundColor Yellow
Copy-Item -Recurse "$ProjectRoot\deploy\website" "$DistDir\$PkgName\website"

# 复制服务器配置
New-Item -ItemType Directory -Path "$DistDir\$PkgName\nginx" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\nginx\lynxdo.conf" "$DistDir\$PkgName\nginx\"
New-Item -ItemType Directory -Path "$DistDir\$PkgName\pm2" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\pm2\ecosystem.config.cjs" "$DistDir\$PkgName\pm2\"
New-Item -ItemType Directory -Path "$DistDir\$PkgName\mysql" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\mysql\lynxdo.cnf" "$DistDir\$PkgName\mysql\"

# 7. 桌面端构建（可选）
if (-not $SkipDesktop) {
  Write-Host "[6/6] 桌面端构建 (Tauri)..." -ForegroundColor Yellow
  $TauriDir = "$ProjectRoot\desktop-native"
  if (Test-Path "$TauriDir\native-ui\package.json") {
    Push-Location "$TauriDir\native-ui"
    npm ci 2>$null; npm run build
    Pop-Location
    Push-Location "$TauriDir\src-tauri"
    # 使用 MSVC 工具链构建
    $env:CARGO_BUILD_TARGET = "x86_64-pc-windows-msvc"
    cargo tauri build 2>&1 | Write-Host
    Pop-Location

    # 查找安装包
    $BundleDir = "D:\cargo-target-native\release\bundle"
    $SetupExe = Get-ChildItem "$BundleDir\nsis\*setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($SetupExe) {
      New-Item -ItemType Directory -Path "$DistDir\$PkgName\downloads" -Force | Out-Null
      Copy-Item $SetupExe.FullName "$DistDir\$PkgName\downloads\"
      Write-Host "  安装包已复制: $($SetupExe.Name)" -ForegroundColor Green
    } else {
      Write-Host "  未找到安装包（跳过）" -ForegroundColor Yellow
    }
  } else {
    Write-Host "  desktop-native 未找到，跳过桌面端构建" -ForegroundColor Yellow
  }
} else {
  Write-Host "[6/6] 跳过桌面端构建 (-SkipDesktop)" -ForegroundColor Yellow
}

# 8. 打包
Write-Host ""
Write-Host "打包中..." -ForegroundColor Yellow
$ArchivePath = "$DistDir\$PkgName.tar.gz"
tar -czf $ArchivePath -C $DistDir $PkgName
if ($LASTEXITCODE -ne 0) {
  # Windows 可能没有 tar，使用 Compress-Archive
  Compress-Archive -Path "$DistDir\$PkgName\*" -DestinationPath "$DistDir\$PkgName.zip" -Force
  $ArchivePath = "$DistDir\$PkgName.zip"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "产物路径: $ArchivePath"
Write-Host "产物大小: $([math]::Round((Get-Item $ArchivePath).Length / 1MB, 2)) MB"
Write-Host ""
Write-Host "下一步: 运行部署脚本" -ForegroundColor Cyan
Write-Host "  .\scripts\deploy\deploy.ps1 -ServerIp 'YOUR_IP' -SshUser 'root' -SshKey 'C:\path\to\key'"
Write-Host ""
