@echo off
chcp 65001 >nul
title 信任奇思安装证书

echo ============================================
echo    奇思 - 信任安装证书（无需管理员权限）
echo ============================================
echo.
echo 此操作将把奇思的代码签名证书导入到当前用户的受信任根和受信任发布者，
echo 安装奇思桌面端时不再显示"未知发布者"警告。
echo.
echo 此操作仅影响当前 Windows 用户，不影响系统其他用户。
echo.

:: 检查证书文件是否存在
set "CERT_PATH=%~dp0lynn-code-sign.cer"
if not exist "%CERT_PATH%" (
    echo [错误] 未找到证书文件: %CERT_PATH%
    echo 请确保 lynn-code-sign.cer 与本脚本在同一目录
    pause
    exit /b 1
)

echo 即将导入证书: %CERT_PATH%
echo.
set /p confirm=确认导入？(Y/N): 
if /i not "%confirm%"=="Y" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo [1/2] 导入到"受信任的根证书颁发机构"（当前用户）...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('%CERT_PATH%'); $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser'); $store.Open('ReadWrite'); $store.Add($cert); $store.Close(); Write-Host '  [OK] 已导入到 CurrentUser\Root' -ForegroundColor Green"

echo [2/2] 导入到"受信任的发布者"（当前用户）...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('%CERT_PATH%'); $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('TrustedPublisher','CurrentUser'); $store.Open('ReadWrite'); $store.Add($cert); $store.Close(); Write-Host '  [OK] 已导入到 CurrentUser\TrustedPublisher' -ForegroundColor Green"

echo.
echo ============================================
echo  证书信任完成！
echo ============================================
echo.
echo 现在可以正常安装奇思桌面端，不会再显示"未知发布者"。
echo.
echo 注意：
echo  - 如使用 SmartScreen 仍提示，点击"更多信息"→"仍要运行"即可
echo  - 此证书仅用于奇思桌面端代码签名，不会影响其他软件
echo.
pause
