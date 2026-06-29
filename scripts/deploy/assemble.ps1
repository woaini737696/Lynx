# 组装部署包
$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $ProjectRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DistDir = "$ProjectRoot\deploy\dist"
$PkgName = "lynx-deploy-$Timestamp"
$PkgDir = "$DistDir\$PkgName"

# 清理旧产物
if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
New-Item -ItemType Directory -Path $PkgDir -Force | Out-Null

Write-Host "[1/5] 复制 standalone 产物..." -ForegroundColor Yellow
$StandaloneDir = "$PkgDir\standalone"
New-Item -ItemType Directory -Path $StandaloneDir -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\.next\standalone\*" $StandaloneDir
New-Item -ItemType Directory -Path "$StandaloneDir\.next\static" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\.next\static\*" "$StandaloneDir\.next\static"
if (Test-Path "$ProjectRoot\public") {
  # 合并到 standalone\public（避免嵌套 public\public）
  if (Test-Path "$StandaloneDir\public") {
    Copy-Item -Recurse "$ProjectRoot\public\*" "$StandaloneDir\public\"
  } else {
    Copy-Item -Recurse "$ProjectRoot\public" "$StandaloneDir\public"
  }
}
New-Item -ItemType Directory -Path "$StandaloneDir\prisma" -Force | Out-Null
Copy-Item "$ProjectRoot\prisma\schema.prisma" "$StandaloneDir\prisma\"
if (Test-Path "$ProjectRoot\prisma\seed.ts") {
  Copy-Item "$ProjectRoot\prisma\seed.ts" "$StandaloneDir\prisma\"
}
Copy-Item "$ProjectRoot\.env.production" "$StandaloneDir\.env"
Write-Host "  standalone + .env + prisma 已复制" -ForegroundColor Green

Write-Host "[2/5] 复制官网产物..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$PkgDir\website" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\web_Lynx\dist\*" "$PkgDir\website\"
Write-Host "  官网产物已复制" -ForegroundColor Green

Write-Host "[3/5] 复制配置文件..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$PkgDir\nginx" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\nginx\lynxdo.conf" "$PkgDir\nginx\"
New-Item -ItemType Directory -Path "$PkgDir\pm2" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\pm2\ecosystem.config.cjs" "$PkgDir\pm2\"
New-Item -ItemType Directory -Path "$PkgDir\mysql" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\mysql\lynxdo.cnf" "$PkgDir\mysql\"
Write-Host "  nginx + pm2 + mysql 配置已复制" -ForegroundColor Green

Write-Host "[4/5] 打包..." -ForegroundColor Yellow
$ArchivePath = "$DistDir\$PkgName.tar.gz"
tar -czf $ArchivePath -C $DistDir $PkgName
if ($LASTEXITCODE -ne 0) {
  Compress-Archive -Path "$PkgDir\*" -DestinationPath "$DistDir\$PkgName.zip" -Force
  $ArchivePath = "$DistDir\$PkgName.zip"
}

Write-Host "[5/5] 完成!" -ForegroundColor Green
$archiveItem = Get-Item $ArchivePath
$archiveSizeMB = [math]::Round($archiveItem.Length / 1MB, 2)
Write-Host "产物: $ArchivePath"
Write-Host "大小: $archiveSizeMB MB"
Write-Host "包名: $PkgName"
