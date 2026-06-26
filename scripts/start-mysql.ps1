# MySQL 启动脚本（D 盘数据目录）
# 用途：启动 MySQL 8.4，数据目录指向 D:\LynnHub\mysql_data，避免占用 C 盘
# 使用：powershell -ExecutionPolicy Bypass -File scripts/start-mysql.ps1

$mysqlExe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$dataDir = "d:\LynnHub\mysql_data"

if (-not (Test-Path $mysqlExe)) {
  Write-Host "错误：找不到 mysqld.exe：$mysqlExe" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $dataDir)) {
  Write-Host "错误：数据目录不存在：$dataDir" -ForegroundColor Red
  Write-Host "请先运行数据目录初始化或迁移" -ForegroundColor Yellow
  exit 1
}

# 检查是否已有 mysqld 进程
$existing = Get-Process -Name "mysqld" -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "MySQL 已在运行（PID: $($existing.Id -join ', ')）" -ForegroundColor Yellow
  exit 0
}

Write-Host "启动 MySQL..." -ForegroundColor Cyan
Write-Host "  数据目录：$dataDir" -ForegroundColor Gray
Write-Host "  端口：3306" -ForegroundColor Gray

Start-Process -FilePath $mysqlExe `
  -ArgumentList "--datadir=$($dataDir -replace '\\','/')", "--port=3306", "--console" `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

$proc = Get-Process -Name "mysqld" -ErrorAction SilentlyContinue
if ($proc) {
  Write-Host "MySQL 启动成功（PID: $($proc.Id -join ', ')）" -ForegroundColor Green
} else {
  Write-Host "MySQL 启动失败，请检查数据目录" -ForegroundColor Red
  exit 1
}
