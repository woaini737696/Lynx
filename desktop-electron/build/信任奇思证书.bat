@echo off
title Trust Qisi Code Signing Certificate

echo ============================================
echo    Qisi - Trust Install Certificate
echo    (No administrator privileges required)
echo ============================================
echo.
echo This will import the Qisi code signing certificate into the current
echo user's Trusted Root and Trusted Publisher stores so that the Qisi
echo desktop installer will no longer show "Unknown Publisher" warning.
echo.
echo This operation only affects the current Windows user.
echo.

:: Check certificate file
set "CERT_PATH=%~dp0lynn-code-sign.cer"
if not exist "%CERT_PATH%" (
    echo [ERROR] Certificate file not found: %CERT_PATH%
    echo Please make sure lynn-code-sign.cer is in the same directory as this script.
    pause
    exit /b 1
)

echo Certificate to import: %CERT_PATH%
echo.
set /p confirm=Confirm import? (Y/N):
if /i not "%confirm%"=="Y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/2] Importing to Trusted Root Certification Authorities (CurrentUser)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('%CERT_PATH%'); $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser'); $store.Open('ReadWrite'); $store.Add($cert); $store.Close(); Write-Host '  [OK] Imported to CurrentUser\Root' -ForegroundColor Green"

echo [2/2] Importing to Trusted Publishers (CurrentUser)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('%CERT_PATH%'); $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('TrustedPublisher','CurrentUser'); $store.Open('ReadWrite'); $store.Add($cert); $store.Close(); Write-Host '  [OK] Imported to CurrentUser\TrustedPublisher' -ForegroundColor Green"

echo.
echo ============================================
echo  Certificate trust completed.
echo ============================================
echo.
echo You can now install the Qisi desktop app without "Unknown Publisher" warning.
echo.
echo Notes:
echo  - If SmartScreen still shows a warning, click "More info" then "Run anyway".
echo  - This certificate is only used for Qisi desktop code signing.
echo.
pause
