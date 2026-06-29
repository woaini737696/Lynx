# Lynx 服务器部署脚本 - 将本地构建产物同步到阿里云服务器
# 前提：已执行 build.ps1 完成本地构建
# 用法：.\scripts\deploy\deploy.ps1 -ServerIp "1.2.3.4" -SshUser "root" -SshKey "C:\path\to\id_rsa"

param(
  [Parameter(Mandatory=$true)]
  [string]$ServerIp,
  [Parameter(Mandatory=$true)]
  [string]$SshUser = "root",
  [Parameter(Mandatory=$true)]
  [string]$SshKey,
  [string]$DeployDir = "/opt/lynx",
  [string]$DbPassword = "",
  [switch]$InitServer
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
$DistDir = "$ProjectRoot\deploy\dist"

# SSH 连接参数
$SshTarget = "$SshUser@$ServerIp"
$SshOpts = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10")

function Invoke-SSH {
  param([string]$Command)
  Write-Host "  SSH> $Command" -ForegroundColor DarkGray
  ssh @SshOpts $SshTarget $Command
  if ($LASTEXITCODE -ne 0) { throw "SSH 命令失败: $Command" }
}

function Invoke-SCP {
  param([string]$Local, [string]$Remote)
  Write-Host "  SCP> $Local -> $Remote" -ForegroundColor DarkGray
  scp @SshOpts -r $Local "${SshTarget}:$Remote"
  if ($LASTEXITCODE -ne 0) { throw "SCP 失败: $Local -> $Remote" }
}

# 查找最新构建产物
$Pkg = Get-ChildItem "$DistDir\lynx-deploy-*" -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Pkg) {
  # 尝试查找压缩包
  $Archive = Get-ChildItem "$DistDir\lynx-deploy-*.{tar.gz,zip}" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $Archive) {
    throw "未找到构建产物，请先执行 .\scripts\deploy\build.ps1"
  }
  # 解压
  $PkgName = $Archive.BaseName -replace '\.tar$',''
  Expand-Archive $Archive.FullName -DestinationPath $DistDir -Force
  $Pkg = Get-Item "$DistDir\$PkgName"
}

$PkgPath = $Pkg.FullName
$PkgName = $Pkg.Name

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lynx 服务器部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "服务器: $SshTarget"
Write-Host "部署目录: $DeployDir"
Write-Host "构建产物: $PkgName"
Write-Host ""

# ============ 首次初始化 ============
if ($InitServer) {
  Write-Host "[0/5] 服务器首次初始化..." -ForegroundColor Yellow

  Write-Host "  安装基础软件..."
  Invoke-SSH "apt update && apt install -y nginx mysql-server certbot python3-certbot-nginx"

  Write-Host "  安装 Node.js 20..."
  Invoke-SSH "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs && npm install -g pm2"

  Write-Host "  创建部署目录..."
  Invoke-SSH "mkdir -p $DeployDir/{app,website,downloads,logs,backup}"

  if ($DbPassword) {
    Write-Host "  配置 MySQL..."
    Invoke-SSH "mysql -u root -e `"CREATE DATABASE IF NOT EXISTS lynx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'lynx'@'localhost' IDENTIFIED BY '$DbPassword'; GRANT ALL ON lynx.* TO 'lynx'@'localhost'; FLUSH PRIVILEGES;`""
  }

  Write-Host "  上传配置文件..."
  Invoke-SSH "mkdir -p /tmp/lynx-deploy"
  Invoke-SCP "$PkgPath\mysql\lynxdo.cnf" "/tmp/lynx-deploy/"
  Invoke-SCP "$PkgPath\nginx\lynxdo.conf" "/tmp/lynx-deploy/"
  Invoke-SCP "$PkgPath\pm2\ecosystem.config.cjs" "/tmp/lynx-deploy/"

  Invoke-SSH "cp /tmp/lynx-deploy/lynxdo.cnf /etc/mysql/conf.d/ && systemctl restart mysql"
  Invoke-SSH "cp /tmp/lynx-deploy/lynxdo.conf /etc/nginx/sites-available/lynxdo && ln -sf /etc/nginx/sites-available/lynxdo /etc/nginx/sites-enabled/lynxdo && rm -f /etc/nginx/sites-enabled/default"
  Invoke-SSH "cp /tmp/lynx-deploy/ecosystem.config.cjs $DeployDir/"

  Write-Host "  请手动申请 SSL 证书:" -ForegroundColor Yellow
  Write-Host "  certbot --nginx -d www.lynxdo.com -d app.lynxdo.com -m admin@lynxdo.com --agree-tos" -ForegroundColor Yellow
  Write-Host ""
}

# ============ 1. 上传构建产物 ============
Write-Host "[1/5] 上传构建产物..." -ForegroundColor Yellow
Invoke-SSH "mkdir -p /tmp/lynx-deploy"
$RemotePkgPath = "/tmp/lynx-deploy/$PkgName"
Invoke-SCP "$PkgPath\standalone" $RemotePkgPath
Invoke-SCP "$PkgPath\website" $RemotePkgPath
if (Test-Path "$PkgPath\downloads") {
  Invoke-SCP "$PkgPath\downloads" $RemotePkgPath
}

# ============ 2. 备份当前版本 ============
Write-Host "[2/5] 备份当前版本..." -ForegroundColor Yellow
$BackupTs = Get-Date -Format "yyyyMMdd-HHmmss"
Invoke-SSH "if [ -d $DeployDir/app ] && [ -f $DeployDir/app/server.js ]; then mv $DeployDir/app $DeployDir/backup/app-$BackupTs; fi"

# ============ 3. 部署新版本 ============
Write-Host "[3/5] 部署新版本..." -ForegroundColor Yellow
Invoke-SSH "mv $RemotePkgPath/standalone $DeployDir/app"
Invoke-SSH "rm -rf $DeployDir/website && mv $RemotePkgPath/website $DeployDir/website"
Invoke-SSH "if [ -d $RemotePkgPath/downloads ]; then cp -r $RemotePkgPath/downloads/* $DeployDir/downloads/ 2>/dev/null; fi"

# ============ 4. 数据库迁移 ============
Write-Host "[4/5] 数据库迁移..." -ForegroundColor Yellow
if ($DbPassword) {
  Invoke-SSH "cd $DeployDir/app && DATABASE_URL='mysql://lynx:$DbPassword@localhost:3306/lynx' npx prisma db push --accept-data-loss"
  Write-Host "  数据库迁移完成" -ForegroundColor Green
} else {
  Write-Host "  未提供 -DbPassword，跳过数据库迁移" -ForegroundColor Yellow
  Write-Host "  请手动执行: cd $DeployDir/app && npx prisma db push" -ForegroundColor Yellow
}

# ============ 5. 重启服务 ============
Write-Host "[5/5] 重启服务..." -ForegroundColor Yellow
Invoke-SSH "cd $DeployDir && pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs"
Invoke-SSH "pm2 save"
Invoke-SSH "nginx -t && systemctl reload nginx"

# 清理临时文件
Invoke-SSH "rm -rf /tmp/lynx-deploy"

# ============ 健康检查 ============
Write-Host ""
Write-Host "健康检查..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
  $response = Invoke-WebRequest "https://app.lynxdo.com/api/health" -TimeoutSec 10 -UseBasicParsing
  if ($response.StatusCode -eq 200) {
    Write-Host "  ✓ API 健康检查通过" -ForegroundColor Green
  }
} catch {
  Write-Host "  ✗ API 健康检查失败（服务可能还在启动中）" -ForegroundColor Yellow
  Write-Host "  请稍后手动检查: curl https://app.lynxdo.com/api/health" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  官网: https://www.lynxdo.com"
Write-Host "  应用: https://app.lynxdo.com"
Write-Host "  下载: https://app.lynxdo.com/download/"
Write-Host ""
Write-Host "服务器状态检查:" -ForegroundColor Cyan
Write-Host "  ssh $SshTarget 'pm2 status'"
Write-Host "  ssh $SshTarget 'free -m'"
Write-Host "  ssh $SshTarget 'pm2 logs lynx-app --lines 20'"
Write-Host ""
