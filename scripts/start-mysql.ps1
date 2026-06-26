# MySQL 启动脚本（D 盘数据目录）
# 用途：启动 MySQL 8.4，数据目录指向 D:\LynnHub\mysql_data，避免占用 C 盘
# 使用：powershell -ExecutionPolicy Bypass -File scripts/start-mysql.ps1

$mysqlExe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$dataDir = "D:\LynnHub\mysql_data"

if (-not (Test-Path $mysqlExe)) {
    Write-Host "[ERROR] mysqld.exe not found: $mysqlExe" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $dataDir)) {
    Write-Host "[ERROR] data dir not exists: $dataDir" -ForegroundColor Red
    Write-Host "[HINT] please run data dir init or migration first" -ForegroundColor Yellow
    exit 1
}

# check existing mysqld process
$existing = Get-Process -Name "mysqld" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[OK] MySQL already running (PID: $($existing.Id -join ', '))" -ForegroundColor Yellow
    exit 0
}

Write-Host "[INFO] starting MySQL..." -ForegroundColor Cyan
Write-Host "  data dir: $dataDir" -ForegroundColor Gray
Write-Host "  port: 3306" -ForegroundColor Gray

Start-Process -FilePath $mysqlExe `
    -ArgumentList "--datadir=$($dataDir -replace '\\','/')", "--port=3306", "--console" `
    -WindowStyle Hidden

Start-Sleep -Seconds 4

$proc = Get-Process -Name "mysqld" -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "[OK] MySQL started (PID: $($proc.Id -join ', '))" -ForegroundColor Green
} else {
    Write-Host "[ERROR] MySQL start failed, please check data dir" -ForegroundColor Red
    exit 1
}
