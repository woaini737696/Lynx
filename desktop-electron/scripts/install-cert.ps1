# 以管理员权限运行：powershell -ExecutionPolicy Bypass -File scripts/install-cert.ps1
$certPath = Join-Path $PSScriptRoot "..\build\lynn-code-sign.pfx"
if (-not (Test-Path $certPath)) {
    Write-Host "[install-cert] 证书文件不存在: $certPath" -ForegroundColor Red
    Write-Host "请先运行 npm run build:win 生成证书" -ForegroundColor Yellow
    exit 1
}

# 从环境变量读取证书密码，禁止硬编码
$certPassword = $env:DESKTOP_SIGN_PASSWORD
if (-not $certPassword) {
    Write-Host "[install-cert] 缺少环境变量 DESKTOP_SIGN_PASSWORD，请设置后重试" -ForegroundColor Red
    Write-Host "  PowerShell: `$env:DESKTOP_SIGN_PASSWORD = '你的密码'; powershell -File scripts/install-cert.ps1" -ForegroundColor Yellow
    exit 1
}

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath, $certPassword)

# 导入到受信任根
$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$rootStore.Open("ReadWrite")
$rootStore.Add($cert)
$rootStore.Close()
Write-Host "[install-cert] 已导入到 Cert:\LocalMachine\Root" -ForegroundColor Green

# 导入到受信任发布者
$pubStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
$pubStore.Open("ReadWrite")
$pubStore.Add($cert)
$pubStore.Close()
Write-Host "[install-cert] 已导入到 Cert:\LocalMachine\TrustedPublisher" -ForegroundColor Green

Write-Host "`n[install-cert] 完成！自签名证书已受信任，开发机不会再显示 SmartScreen 警告" -ForegroundColor Cyan
