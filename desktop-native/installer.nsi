; ============================================================
; Lynx 原生桌面端 NSIS 安装脚本
; 品牌风格：橙黑主题、无边框现代感、类豆包/Kimi 安装流程
; 产物：Lynx-Setup-1.2.0.exe
; ============================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"

; ---------- 版本与产品信息 ----------
!define PRODUCT_NAME      "Lynx"
!define PRODUCT_VERSION   "1.2.0"
!define PRODUCT_PUBLISHER "Lynx"
!define PRODUCT_WEB_SITE  "https://app.lynnhub.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; ---------- 输出与压缩 ----------
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "dist\Lynx-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
SetCompressorDictSize 64

; ---------- 版本资源 ----------
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName"     "${PRODUCT_NAME}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} 原生桌面端安装程序"
VIAddVersionKey "LegalCopyright"  "© 2026 ${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileVersion"     "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion"  "${PRODUCT_VERSION}"

; ---------- Lynx 品牌色 ----------
!define BRAND_ORANGE  "F97316"
!define BRAND_DARK    "111827"
!define BRAND_BLACK   "0A0A0A"
!define BRAND_GRAY    "27272A"
!define BRAND_TEXT    "1F2937"

; ---------- MUI 设置 ----------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要取消 ${PRODUCT_NAME} 安装吗？"

; 欢迎页：大标题 + 卖点文案（豆包风格）
!define MUI_WELCOMEPAGE_TITLE       "安装 ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT        "${PRODUCT_NAME} 是你的全平台 AI 工作台。$\n$\n- 本地前端 + 云端 API，安装即用$\n- 全局快捷键 Ctrl+Shift+L 快速唤起$\n- 自动更新，持续获得新能力$\n$\n点击下一步开始安装。"

; 目录页
!define MUI_DIRECTORYPAGE_TEXT_TOP  "请选择 ${PRODUCT_NAME} 的安装位置。"

; 完成页
!define MUI_FINISHPAGE_TITLE        "${PRODUCT_NAME} 安装完成"
!define MUI_FINISHPAGE_TEXT         "${PRODUCT_NAME} 已成功安装到你的电脑。$\n$\n点击完成立即启动 ${PRODUCT_NAME}。"
!define MUI_FINISHPAGE_RUN          "$INSTDIR\lynnhub-desktop-native.exe"
!define MUI_FINISHPAGE_RUN_TEXT     "立即启动 ${PRODUCT_NAME}"

; 界面颜色：现代白主区 + 深色文字
!define MUI_BGCOLOR                 "FFFFFF"
!define MUI_TEXTCOLOR               "${BRAND_TEXT}"

; ---------- 安装页面流程 ----------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ---------- 卸载页面流程 ----------
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ---------- 语言 ----------
!insertmacro MUI_LANGUAGE "SimpChinese"

; ---------- 初始化：检测旧版本并提示卸载 ----------
Function .onInit
  ; 64 位系统强制 64 位安装目录
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ; 检测已安装版本
  ReadRegStr $R0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
  ${If} $R0 != ""
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "检测到已安装旧版本 ${PRODUCT_NAME}。$\n点击确定先卸载旧版本，再继续安装。" \
      IDOK uninst
    Abort
    uninst:
      ClearErrors
      ExecWait '$R0 /S _?=$INSTDIR'
      IfErrors no_remove_uninstaller
        Delete "$R0"
        RMDir /r "$INSTDIR"
      no_remove_uninstaller:
  ${EndIf}
FunctionEnd

; ---------- 安装部分 ----------
Section "Lynx 主程序" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  ; 主程序（由 Tauri/MSVC 构建）
  File "D:\cargo-target-native\release\lynnhub-desktop-native.exe"

  ; 启动页资源（Tauri frontendDist: ../out）
  SetOutPath "$INSTDIR\out"
  File /r "out\*.*"

  ; 写入卸载程序
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; 注册表：应用路径
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\lynnhub-desktop-native.exe"

  ; 注册表：控制面板卸载信息
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName"     "${PRODUCT_NAME}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon"     "$INSTDIR\lynnhub-desktop-native.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher"       "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion"  "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout"    "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "HelpLink"        "${PRODUCT_WEB_SITE}"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" 48000

  ; 开始菜单快捷方式
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
SectionEnd

Section /o "创建桌面快捷方式" SecDesktop
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
SectionEnd

; ---------- 卸载部分 ----------
Section "Uninstall"
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ; 删除文件
  Delete "$INSTDIR\lynnhub-desktop-native.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR\out"

  ; 删除快捷方式
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  ; 删除注册表
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

  ; 删除安装目录（若为空）
  RMDir "$INSTDIR"

  SetAutoClose true
SectionEnd

