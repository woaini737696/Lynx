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

; ===== 覆盖安装：安装前关闭正在运行的旧版进程 =====
; 避免文件占用导致覆盖安装失败
Section "-KillRunningApp"
  nsExec::ExecToLog 'taskkill /F /IM "奇思.exe" /T'
  Pop $0
  Sleep 1000
SectionEnd
