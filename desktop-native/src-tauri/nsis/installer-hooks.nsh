; NSIS installer hooks for 奇思 desktop
; 1. CUSTOMINIT：检测已有安装并提示覆盖（避免静默覆盖安装）
; 2. PREINSTALL：终止运行中的奇思进程，避免文件占用导致卸载失败（"Error launching installer"）
; 3. POSTINSTALL：自动导入自签名代码签名证书到 Windows 受信任的根证书颁发机构
;    解决"未知开发者"安全提示（自签名证书需要导入根存储才能被 Windows 信任）

!macro NSIS_HOOK_CUSTOMINIT
  ; 检测已有安装（Tauri NSIS 使用 productName 作为注册表键名）
  ; 依次检查 HKCU 和 HKLM 下的 Uninstall 注册表项
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\奇思" "UninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\奇思" "UninstallString"
  ${EndIf}
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "检测到系统已安装 奇思。$\r$\n$\r$\n是否卸载旧版本并继续安装？" \
      IDYES +3
    SetErrorLevel 1
    Quit
    DetailPrint "正在卸载旧版本 奇思..."
    ; 静默卸载旧版本，等待卸载完成
    nsExec::ExecToLog '$0 /S _?=$INSTDIR'
    Pop $1
    DetailPrint "旧版本卸载完成（退出码: $1）"
    ; 等待文件句柄释放
    Sleep 1500
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "正在终止运行中的奇思进程..."
  ; 强制终止 Lynx.exe（避免文件占用导致旧版本无法卸载）
  nsExec::ExecToLog 'taskkill /IM "Lynx.exe" /F'
  Pop $0
  ; 无论是否成功都继续（任务可能本来就没运行）
  DetailPrint "奇思进程终止完成（退出码: $0）"
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
