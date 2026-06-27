; ============================================================
; Lynx 原生桌面端 NSIS 安装脚本
; 品牌风格：豆包/Kimi 级单页居中安装流程
; 产物：dist\Lynx-Setup-1.2.0.exe
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

; ---------- MUI 设置（禁用默认欢迎/目录/完成页，只保留安装进度页） ----------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要取消 ${PRODUCT_NAME} 安装吗？"
!define MUI_ICON "src-tauri\icons\icon.ico"
!define MUI_UNICON "src-tauri\icons\icon.ico"

; 进度页文案
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "${PRODUCT_NAME} 安装完成"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "正在启动 ${PRODUCT_NAME}..."
!define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "安装已取消"
!define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "${PRODUCT_NAME} 安装未完成。"

; 进度条样式：平滑 + 品牌色（橙）
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
!define MUI_INSTALLCOLORS "${BRAND_ORANGE} FFFFFF"

; ---------- 安装页面流程 ----------
; 自定义单页安装（logo + 路径 + 立即安装）
Page custom CustomInstallPage CustomInstallPageLeave
; 标准进度页（显示时统一品牌风格）
!define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesShow
!insertmacro MUI_PAGE_INSTFILES

; ---------- 卸载页面流程 ----------
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ---------- 语言 ----------
!insertmacro MUI_LANGUAGE "SimpChinese"

; ---------- 自定义页面变量 ----------
Var Dialog
Var LogoImg
Var PathEdit
Var DesktopCheckbox
Var InstallBtn

; ---------- 初始化：检测旧版本并提示卸载 ----------
Function .onInit
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

; ---------- 自定义安装页面：豆包风格 ----------
Function CustomInstallPage
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; 隐藏 MUI 默认的 上一步/下一步/取消 按钮
  GetDlgItem $R0 $HWNDPARENT 1
  ShowWindow $R0 ${SW_HIDE}
  GetDlgItem $R0 $HWNDPARENT 2
  ShowWindow $R0 ${SW_HIDE}
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}

  ; 设置对话框背景为白色
  SetCtlColors $Dialog FFFFFF FFFFFF

  ; Logo 图片（居中，128x128）
  File "assets\installer-logo.bmp"
  ${NSD_CreateBitmap} 196 48 128 128 ""
  Pop $LogoImg
  ${NSD_SetImage} $LogoImg "$PLUGINSDIR\installer-logo.bmp" $R0

  ; 产品名
  ${NSD_CreateLabel} 0 190 520 30 "${PRODUCT_NAME}"
  Pop $0
  SetCtlColors $0 ${BRAND_TEXT} FFFFFF
  CreateFont $R1 "Microsoft YaHei" "18" "700"
  SendMessage $0 ${WM_SETFONT} $R1 0

  ; 安装路径标签
  ${NSD_CreateLabel} 80 245 360 18 "安装路径"
  Pop $0
  SetCtlColors $0 ${BRAND_TEXT} FFFFFF
  CreateFont $R2 "Microsoft YaHei" "10" "400"
  SendMessage $0 ${WM_SETFONT} $R2 0

  ; 安装路径输入框
  ${NSD_CreateText} 80 265 270 28 "$INSTDIR"
  Pop $PathEdit
  SetCtlColors $PathEdit ${BRAND_TEXT} FFFFFF
  SendMessage $PathEdit ${WM_SETFONT} $R2 0

  ; 浏览按钮
  ${NSD_CreateButton} 360 265 80 28 "浏览..."
  Pop $0
  SetCtlColors $0 ${BRAND_TEXT} FFFFFF
  SendMessage $0 ${WM_SETFONT} $R2 0
  ${NSD_OnClick} $0 OnBrowseClick

  ; 创建桌面快捷方式复选框
  ${NSD_CreateCheckbox} 80 305 300 18 "创建桌面快捷方式"
  Pop $DesktopCheckbox
  SetCtlColors $DesktopCheckbox ${BRAND_TEXT} FFFFFF
  SendMessage $DesktopCheckbox ${WM_SETFONT} $R2 0
  ${NSD_Check} $DesktopCheckbox

  ; 立即安装按钮（橙底白字）
  ${NSD_CreateButton} 80 350 360 42 "立即安装"
  Pop $InstallBtn
  SetCtlColors $InstallBtn FFFFFF ${BRAND_ORANGE}
  CreateFont $R3 "Microsoft YaHei" "12" "700"
  SendMessage $InstallBtn ${WM_SETFONT} $R3 0
  ${NSD_OnClick} $InstallBtn OnInstallClick

  ; 底部提示
  ${NSD_CreateLabel} 0 420 520 18 "点击“立即安装”即表示同意软件许可协议"
  Pop $0
  SetCtlColors $0 888888 FFFFFF
  CreateFont $R4 "Microsoft YaHei" "9" "400"
  SendMessage $0 ${WM_SETFONT} $R4 0

  nsDialogs::Show
FunctionEnd

Function OnBrowseClick
  nsDialogs::SelectFolderDialog "请选择 ${PRODUCT_NAME} 的安装位置" "$INSTDIR"
  Pop $R0
  ${If} $R0 != error
    ${NSD_SetText} $PathEdit "$R0\${PRODUCT_NAME}"
  ${EndIf}
FunctionEnd

Function OnInstallClick
  ; 触发离开页面，进入安装进度（模拟点击 MUI 下一步，控件 ID 为 1）
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function CustomInstallPageLeave
  ${NSD_GetText} $PathEdit $INSTDIR
  ${If} $INSTDIR == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择安装路径。"
    Abort
  ${EndIf}
FunctionEnd

; ---------- 进度页显示时：统一白色背景，隐藏取消按钮 ----------
Function InstFilesShow
  ; 设置进度页背景为白色
  SetCtlColors $HWNDPARENT FFFFFF FFFFFF
  ; 隐藏取消按钮（控件 ID 3），避免用户误触
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}
FunctionEnd

; ---------- 安装部分 ----------
Section "Lynx 主程序" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  DetailPrint "正在准备安装 ${PRODUCT_NAME}..."
  ; 主程序（由 Tauri/MSVC 构建）
  File "D:\cargo-target-native\release\lynnhub-desktop-native.exe"

  DetailPrint "正在释放前端资源..."
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

  ; 桌面快捷方式（默认创建；静默安装时直接创建）
  ${If} ${Silent}
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
  ${Else}
    ${NSD_GetState} $DesktopCheckbox $R0
    ${If} $R0 == "1"
      CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
    ${EndIf}
  ${EndIf}

  ; 安装完成自动启动
  Exec "$INSTDIR\lynnhub-desktop-native.exe"
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
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  ; 删除注册表
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

  ; 删除安装目录（若为空）
  RMDir "$INSTDIR"

  SetAutoClose true
SectionEnd
