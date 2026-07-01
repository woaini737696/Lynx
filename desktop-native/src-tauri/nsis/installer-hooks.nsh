; NSIS installer hooks for Lynx desktop
; 1. PREINSTALL：终止运行中的 Lynx 进程，避免文件占用导致卸载失败（"Error launching installer"）
; 2. POSTINSTALL：自动导入自签名代码签名证书到 Windows 受信任的根证书颁发机构
;    解决"未知开发者"安全提示（自签名证书需要导入根存储才能被 Windows 信任）

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "正在终止运行中的 Lynx 进程..."
  ; 强制终止 Lynx.exe（避免文件占用导致旧版本无法卸载）
  nsExec::ExecToLog 'taskkill /IM "Lynx.exe" /F'
  Pop $0
  ; 无论是否成功都继续（任务可能本来就没运行）
  DetailPrint "Lynx 进程终止完成（退出码: $0）"
  ; 等待 1 秒让文件句柄释放
  Sleep 1000
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "正在导入开发者证书到受信任的根证书颁发机构..."
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "try { Import-Certificate -FilePath \"$INSTDIR\lynx-code-sign.cer\" -CertStoreLocation Cert:\LocalMachine\Root | Out-Null; Write-Host CERT_IMPORT_OK } catch { Write-Host CERT_IMPORT_FAIL; exit 1 }"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "开发者证书导入成功，后续更新不再提示未知开发者"
  ${Else}
    DetailPrint "证书导入跳过（错误码: $0），不影响安装"
  ${EndIf}
!macroend
