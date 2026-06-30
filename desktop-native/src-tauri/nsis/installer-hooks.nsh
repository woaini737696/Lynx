; NSIS installer hooks for Lynx desktop
; 在安装完成后自动导入自签名代码签名证书到 Windows 受信任的根证书颁发机构
; 解决"未知开发者"安全提示（自签名证书需要导入根存储才能被 Windows 信任）

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "正在导入开发者证书到受信任的根证书颁发机构..."
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -NoProfile -Command "try { Import-Certificate -FilePath \"$INSTDIR\lynnhub-code-sign.cer\" -CertStoreLocation Cert:\LocalMachine\Root | Out-Null; Write-Host CERT_IMPORT_OK } catch { Write-Host CERT_IMPORT_FAIL; exit 1 }"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "开发者证书导入成功，后续更新不再提示未知开发者"
  ${Else}
    DetailPrint "证书导入跳过（错误码: $0），不影响安装"
  ${EndIf}
!macroend
