; ============================================================
; Lynx native desktop NSIS installer
; Style: iOS liquid-glass deep-sea custom page
; Output: dist\lynx_1.0.0.exe
; ============================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinMessages.nsh"

; ---------- Product info ----------
!define PRODUCT_NAME      "Lynx"
!define PRODUCT_VERSION   "1.0.0"
!define PRODUCT_PUBLISHER "Lynx"
!define PRODUCT_WEB_SITE  "https://app.lynnhub.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define PRODUCT_EXE       "lynnhub-desktop-native.exe"

; ---------- Output ----------
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "dist\lynx_${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
SetCompressorDictSize 64

; ---------- Version resource ----------
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName"     "${PRODUCT_NAME}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} native desktop installer"
VIAddVersionKey "LegalCopyright"  "2026 ${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileVersion"     "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion"  "${PRODUCT_VERSION}"

; ---------- Window size ----------
!define WINDOW_W 540
!define WINDOW_H 458          ; includes title bar/borders for ~520x420 client
!define CLIENT_W 520
!define CLIENT_H 420

; ---------- Control handles ----------
Var BG_BITMAP
Var DLG_ITEM

Var TITLE_FONT
Var BODY_FONT
Var SMALL_FONT

Var HWND_BG
Var HWND_PATH_INPUT
Var HWND_SHORTCUT_CHK
Var HWND_INSTALL_BTN

Var HWND_PROGRESS
Var HWND_STATUS_LABEL

Var HWND_SUCCESS_ICON
Var HWND_SUCCESS_LABEL
Var HWND_LAUNCH_BTN

Var INSTALL_RUNNING
Var CREATE_SHORTCUT

; ---------- Helper: kill running process ----------
Function KillLynxProcess
  StrCpy $R2 0
  loop:
    ExecWait 'taskkill /F /IM ${PRODUCT_EXE} /T' $R0
    Sleep 600
    IntOp $R2 $R2 + 1
    ${If} $R2 < 3
      Goto loop
    ${EndIf}
FunctionEnd

; ---------- Init: detect existing install and extract UI assets ----------
Function .onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  StrCpy $CREATE_SHORTCUT 1

  ; Extract background bitmap to plugins dir for runtime UI
  InitPluginsDir
  File /oname=$PLUGINSDIR\installer-bg.bmp "assets\installer-bg.bmp"

  ; Detect previous installation
  ReadRegStr $R0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
  ReadRegStr $R1 HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"

  ${If} $R0 != ""
    ${If} $R1 == ""
      StrCpy $R1 "$PROGRAMFILES64\${PRODUCT_NAME}"
    ${EndIf}

    ${If} ${Silent}
      Call KillLynxProcess
      ClearErrors
      ExecWait '"$R0" /S _?=$R1' $R4
      ${If} ${FileExists} "$R1\${PRODUCT_EXE}"
        RMDir /r "$R1"
      ${EndIf}
      DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
      DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    ${Else}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到已安装 ${PRODUCT_NAME}。$\n点击“确定”将关闭现有进程并卸载旧版本，然后继续安装。$\n点击“取消”将退出安装程序。" IDOK do_uninst
      Abort
      do_uninst:
        Call KillLynxProcess
        ClearErrors
        ExecWait '"$R0" /S _?=$R1' $R4
        ${If} ${FileExists} "$R1\${PRODUCT_EXE}"
          RMDir /r "$R1"
        ${EndIf}
        DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
        DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    ${EndIf}
  ${EndIf}
FunctionEnd

; ---------- GUI init: resize and center window ----------
Function .onGUIInit
  System::Call 'gdi32::CreateFont(i -32, i 0, i 0, i 0, i 700, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, t "Microsoft YaHei") i .r0'
  StrCpy $TITLE_FONT $R0

  System::Call 'gdi32::CreateFont(i -15, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, t "Microsoft YaHei") i .r0'
  StrCpy $BODY_FONT $R0

  System::Call 'gdi32::CreateFont(i -11, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, t "Microsoft YaHei") i .r0'
  StrCpy $SMALL_FONT $R0

  ; Resize and center window (hardcoded full window size for ~520x420 client)
  System::Call 'user32::GetSystemMetrics(i 0) i .r6'
  System::Call 'user32::GetSystemMetrics(i 1) i .r7'

  IntOp $R8 $R6 - ${WINDOW_W}
  IntOp $R8 $R8 / 2
  IntOp $R9 $R7 - ${WINDOW_H}
  IntOp $R9 $R9 / 2

  System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i r8, i r9, i ${WINDOW_W}, i ${WINDOW_H}, i 0x16)'
FunctionEnd

; ---------- Styled button: transparent label over pre-rendered glass button ----------
Function CreateButtonStatic
  Pop $R5        ; parent HWND
  Pop $R4        ; x
  Pop $R3        ; y
  Pop $R2        ; w
  Pop $R1        ; h
  Pop $R0        ; text

  nsDialogs::CreateControl "STATIC" ${WS_VISIBLE}|${WS_CHILD}|${SS_CENTER}|${SS_NOTIFY} $R4 $R3 $R2 $R1 $R0
  Pop $R5

  SetCtlColors $R5 FFFFFF transparent
  SendMessage $R5 ${WM_SETFONT} $BODY_FONT 1

  Push $R5
FunctionEnd

; ---------- Load bitmap from file ----------
Function LoadBitmapFile
  Pop $R0        ; file path
  System::Call 'user32::LoadImage(i 0, t r0, i 0, i 0, i 0, i 0x0010) i .r1'
  Push $R1
FunctionEnd

; ---------- Main custom page ----------
Function ShowMainPage
  nsDialogs::Create 1018
  Pop $DLG_ITEM

  ${If} $DLG_ITEM == error
    Abort
  ${EndIf}

  SetCtlColors $DLG_ITEM "" 0F1B2E

  ; Load background image (includes glass panel, logo, title, button background, progress track)
  Push "$PLUGINSDIR\installer-bg.bmp"
  Call LoadBitmapFile
  Pop $BG_BITMAP

  nsDialogs::CreateControl "STATIC" ${WS_VISIBLE}|${WS_CHILD}|${SS_BITMAP}|${SS_REALSIZEIMAGE} 0 0 ${CLIENT_W} ${CLIENT_H} ""
  Pop $HWND_BG
  SendMessage $HWND_BG ${STM_SETIMAGE} ${IMAGE_BITMAP} $BG_BITMAP

  ; Path input (matches glass input area in background)
  nsDialogs::CreateControl "EDIT" ${WS_VISIBLE}|${WS_CHILD}|${ES_AUTOHSCROLL} 80 260 360 34 $INSTDIR
  Pop $HWND_PATH_INPUT
  SetCtlColors $HWND_PATH_INPUT F2F4F7 101B2E
  SendMessage $HWND_PATH_INPUT ${WM_SETFONT} $BODY_FONT 1

  ; Shortcut checkbox
  nsDialogs::CreateControl "BUTTON" ${WS_VISIBLE}|${WS_CHILD}|${BS_AUTOCHECKBOX} 80 302 200 18 "创建桌面快捷方式"
  Pop $HWND_SHORTCUT_CHK
  SetCtlColors $HWND_SHORTCUT_CHK E2E8F0 transparent
  SendMessage $HWND_SHORTCUT_CHK ${WM_SETFONT} $SMALL_FONT 1
  ${NSD_Check} $HWND_SHORTCUT_CHK

  ; Install button (transparent label over pre-rendered blue glass button)
  Push "立即安装"
  Push 44
  Push 360
  Push 330
  Push 80
  Push $DLG_ITEM
  Call CreateButtonStatic
  Pop $HWND_INSTALL_BTN
  ${NSD_OnClick} $HWND_INSTALL_BTN OnInstallClick

  ; Progress bar (hidden initially)
  nsDialogs::CreateControl "msctls_progress32" ${WS_VISIBLE}|${WS_CHILD}|0x0001 80 346 360 10 ""
  Pop $HWND_PROGRESS
  SendMessage $HWND_PROGRESS ${PBM_SETRANGE} 0 0x00010064
  ShowWindow $HWND_PROGRESS ${SW_HIDE}

  ; Status label (hidden)
  nsDialogs::CreateControl "STATIC" ${WS_VISIBLE}|${WS_CHILD}|${SS_CENTER} 0 360 ${CLIENT_W} 20 ""
  Pop $HWND_STATUS_LABEL
  SetCtlColors $HWND_STATUS_LABEL A0AAB9 transparent
  SendMessage $HWND_STATUS_LABEL ${WM_SETFONT} $SMALL_FONT 1
  ShowWindow $HWND_STATUS_LABEL ${SW_HIDE}

  ; Success icon (hidden)
  nsDialogs::CreateControl "STATIC" ${WS_VISIBLE}|${WS_CHILD}|${SS_CENTER} 0 260 ${CLIENT_W} 48 "✓"
  Pop $HWND_SUCCESS_ICON
  SetCtlColors $HWND_SUCCESS_ICON 3B82F6 transparent
  SendMessage $HWND_SUCCESS_ICON ${WM_SETFONT} $TITLE_FONT 1
  ShowWindow $HWND_SUCCESS_ICON ${SW_HIDE}

  ; Success label (hidden)
  nsDialogs::CreateControl "STATIC" ${WS_VISIBLE}|${WS_CHILD}|${SS_CENTER} 0 310 ${CLIENT_W} 24 "安装完成"
  Pop $HWND_SUCCESS_LABEL
  SetCtlColors $HWND_SUCCESS_LABEL FFFFFF transparent
  SendMessage $HWND_SUCCESS_LABEL ${WM_SETFONT} $BODY_FONT 1
  ShowWindow $HWND_SUCCESS_LABEL ${SW_HIDE}

  ; Launch button (hidden, same location as install button)
  Push "立即体验"
  Push 44
  Push 360
  Push 330
  Push 80
  Push $DLG_ITEM
  Call CreateButtonStatic
  Pop $HWND_LAUNCH_BTN
  ${NSD_OnClick} $HWND_LAUNCH_BTN OnLaunchClick
  ShowWindow $HWND_LAUNCH_BTN ${SW_HIDE}

  StrCpy $INSTALL_RUNNING 0

  nsDialogs::Show
FunctionEnd

Function OnInstallClick
  ${If} $INSTALL_RUNNING == 1
    Return
  ${EndIf}
  StrCpy $INSTALL_RUNNING 1

  ; Read path from input
  System::Call 'user32::GetWindowText(i $HWND_PATH_INPUT, t .r0, i 512)'
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}

  ; Validate
  ${If} $INSTDIR == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择安装目录"
    StrCpy $INSTALL_RUNNING 0
    Return
  ${EndIf}

  ; Check existing files in target dir
  ${If} ${FileExists} "$INSTDIR\${PRODUCT_EXE}"
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "目标目录已存在 ${PRODUCT_NAME}。$\n点击“确定”覆盖安装，点击“取消”返回。" IDOK ok_overwrite
    StrCpy $INSTALL_RUNNING 0
    Return
    ok_overwrite:
      Call KillLynxProcess
  ${EndIf}

  ; Get shortcut checkbox state
  ${NSD_GetState} $HWND_SHORTCUT_CHK $CREATE_SHORTCUT

  ; Switch to progress state
  ShowWindow $HWND_PATH_INPUT ${SW_HIDE}
  ShowWindow $HWND_SHORTCUT_CHK ${SW_HIDE}
  ShowWindow $HWND_INSTALL_BTN ${SW_HIDE}

  ShowWindow $HWND_PROGRESS ${SW_SHOW}
  ShowWindow $HWND_STATUS_LABEL ${SW_SHOW}

  Call DoInstall
FunctionEnd

Function UpdateStatus
  Pop $R0
  ${If} $HWND_STATUS_LABEL != 0
    SendMessage $HWND_STATUS_LABEL ${WM_SETTEXT} 0 "STR:$R0"
  ${EndIf}
FunctionEnd

Function SetProgress
  Pop $R0
  ${If} $HWND_PROGRESS != 0
    SendMessage $HWND_PROGRESS ${PBM_SETPOS} $R0 0
  ${EndIf}
FunctionEnd

Function DoInstall
  Call KillLynxProcess

  ${IfNot} ${Silent}
    Push "正在准备安装..."
    Call UpdateStatus
    Push 10
    Call SetProgress
  ${EndIf}

  SetShellVarContext all
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ${IfNot} ${Silent}
    Push "正在安装 ${PRODUCT_NAME} 主程序..."
    Call UpdateStatus
    Push 30
    Call SetProgress
  ${EndIf}
  File "bin\${PRODUCT_EXE}"

  ${IfNot} ${Silent}
    Push "正在释放前端资源..."
    Call UpdateStatus
    Push 60
    Call SetProgress
  ${EndIf}
  SetOutPath "$INSTDIR\out\app"
  File /r "out\app\*.*"

  ${IfNot} ${Silent}
    Push "正在写入注册表信息..."
    Call UpdateStatus
    Push 80
    Call SetProgress
  ${EndIf}
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName"     "${PRODUCT_NAME}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon"     "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher"       "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion"  "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout"    "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "HelpLink"        "${PRODUCT_WEB_SITE}"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" 48000

  ${If} $CREATE_SHORTCUT == 1
    ${IfNot} ${Silent}
      Push "正在创建桌面快捷方式..."
      Call UpdateStatus
    ${EndIf}
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  ${EndIf}

  ${IfNot} ${Silent}
    Push 100
    Call SetProgress
    Push "安装完成"
    Call UpdateStatus

    ShowWindow $HWND_PROGRESS ${SW_HIDE}
    ShowWindow $HWND_STATUS_LABEL ${SW_HIDE}
    ShowWindow $HWND_SUCCESS_ICON ${SW_SHOW}
    ShowWindow $HWND_SUCCESS_LABEL ${SW_SHOW}
    ShowWindow $HWND_LAUNCH_BTN ${SW_SHOW}
  ${EndIf}
FunctionEnd

Function OnLaunchClick
  Exec '"$INSTDIR\${PRODUCT_EXE}"'
  Quit
FunctionEnd

Function ShowMainPageLeave
  ; Prevent leaving page by normal navigation
FunctionEnd

; ---------- Page flow ----------
Page custom ShowMainPage ShowMainPageLeave
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section "Lynx"
  ${If} ${Silent}
    Call DoInstall
  ${EndIf}
SectionEnd

; ---------- Uninstall init ----------
Function un.onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ReadRegStr $INSTDIR HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"
  ${If} $INSTDIR == ""
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_NAME}"
  ${EndIf}

  Call un.KillLynxProcess
FunctionEnd

Function un.KillLynxProcess
  StrCpy $R2 0
  un_loop:
    ExecWait 'taskkill /F /IM ${PRODUCT_EXE} /T' $R0
    Sleep 600
    IntOp $R2 $R2 + 1
    ${If} $R2 < 3
      Goto un_loop
    ${EndIf}
FunctionEnd

; ---------- Uninstall section ----------
Section "Uninstall"
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  Delete /REBOOTOK "$INSTDIR\${PRODUCT_EXE}"
  RMDir /r "$INSTDIR\out"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete /REBOOTOK "$INSTDIR\uninstall.exe"
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  RMDir /r "$INSTDIR"
  SetAutoClose true
SectionEnd
