; NSIS 自定义 include 文件
; 修复 electron-builder 24.13.3 的 NSIS 模板 BMP 不生效问题
; 注意：electron-builder 模板已定义 MUI_HEADERIMAGE，不能重定义（!define 会报错）
; 用 !ifndef 保护，仅补充缺失的 BITMAP 路径

; ===== 安装界面 BMP 图片 =====
; MUI_HEADERIMAGE 已由模板定义，只需补充 BITMAP 路径
!ifndef MUI_HEADERIMAGE_BITMAP
  !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-header.bmp"
!endif
!ifndef MUI_HEADERIMAGE_RIGHT
  !define MUI_HEADERIMAGE_RIGHT
!endif
!ifndef MUI_WELCOMEFINISHPAGE_BITMAP
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-sidebar.bmp"
!endif
!ifndef MUI_UNWELCOMEFINISHPAGE_BITMAP
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installer-sidebar.bmp"
!endif

; ===== 覆盖安装：检测旧版 + 提示 + 关闭进程 =====
; 在 .onInit 中执行（安装程序初始化时，在任何 Section 之前）
!macro customInit
  ; 读取注册表中的旧版安装信息
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "InstallLocation"
  ${If} $0 != ""
    ; 检测到旧版安装
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到已安装旧版奇思，是否覆盖安装？$\n$\n点击「是」将关闭旧版并覆盖安装，点击「否」退出安装。" IDYES +3
      Quit
    ; 关闭正在运行的旧版进程，避免文件占用
    nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T'
    Pop $1
    Sleep 1000
  ${EndIf}
!macroend
