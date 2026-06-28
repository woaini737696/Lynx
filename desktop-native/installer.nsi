; ============================================================
; Lynx native desktop NSIS installer - Step 2
; Added: fonts, logo, deep sea blue theme, proper navigation
; ============================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinMessages.nsh"

; ---------- Product info ----------
!define PRODUCT_NAME      "Lynx"
!define PRODUCT_VERSION   "1.0.0"
!define PRODUCT_PUBLISHER "Lynx"
!define PRODUCT_WEB_SITE  "https://www.lynxdo.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_EXE       "lynnhub-desktop-native.exe"

; ---------- Output ----------
Name "${PRODUCT_NAME}"
OutFile "dist\lynx_${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
BrandingText " "

; ---------- Version resource ----------
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName"     "${PRODUCT_NAME}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} 安装程序"
VIAddVersionKey "LegalCopyright"  "2026 ${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileVersion"     "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion"  "${PRODUCT_VERSION}"

; ---------- Vars ----------
Var DLG
Var PATH_EDIT
Var SHORTCUT_CHK
Var INSTALL_BTN
Var BROWSE_BTN
Var RUNNING
Var CREATE_SC
Var FONT_TITLE
Var FONT_SUBTITLE
Var FONT_BODY
Var FONT_SMALL
Var FONT_BTN
Var LOGO_HWND
Var LOGO_BMP
Var CAN_INSTALL

; ---------- Kill process ----------
Function KillProc
  StrCpy $R9 0
  kill_loop:
    ExecWait 'taskkill /F /IM ${PRODUCT_EXE} /T' $R8
    Sleep 500
    IntOp $R9 $R9 + 1
    ${If} $R9 < 3
      Goto kill_loop
    ${EndIf}
FunctionEnd

; ---------- Init ----------
Function .onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  StrCpy $CREATE_SC 1
  StrCpy $CAN_INSTALL 0

  ReadRegStr $R0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
  ReadRegStr $R1 HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"
  ${If} $R0 != ""
    ${If} $R1 == ""
      StrCpy $R1 "$PROGRAMFILES64\${PRODUCT_NAME}"
    ${EndIf}
    ${If} ${Silent}
      Call KillProc
      ExecWait '"$R0" /S _?=$R1' $R2
      ${If} ${FileExists} "$R1\${PRODUCT_EXE}"
        RMDir /r "$R1"
      ${EndIf}
      DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
      DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    ${Else}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到已安装 ${PRODUCT_NAME}，将卸载旧版本后继续。$\n点击“确定”继续，点击“取消”退出。" IDOK do_uninst
      Abort
      do_uninst:
        Call KillProc
        ExecWait '"$R0" /S _?=$R1' $R2
        ${If} ${FileExists} "$R1\${PRODUCT_EXE}"
          RMDir /r "$R1"
        ${EndIf}
        DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
        DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    ${EndIf}
  ${EndIf}

  ; Extract assets
  InitPluginsDir
  File "/oname=$PLUGINSDIR\installer-logo.bmp" "assets\installer-logo.bmp"

  ; Load bitmap
  System::Call 'gdi32::LoadImage(i 0, t "$PLUGINSDIR\installer-logo.bmp", i ${IMAGE_BITMAP}, i 0, i 0, i ${LR_LOADFROMFILE}|${LR_CREATEDIBSECTION}) i .s'
  Pop $LOGO_BMP

  ; Create fonts
  ; hFont = CreateFont(cHeight, cWidth, cEscapement, cOrientation, cWeight, bItalic, bUnderline, bStrikeOut,
  ;   iCharSet, iOutPrecision, iClipPrecision, iQuality, iPitchAndFamily, tFaceName)
  System::Call 'gdi32::CreateFont(i -32, i 0, i 0, i 0, i 700, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, t "Microsoft YaHei UI") i .s'
  Pop $FONT_TITLE
  System::Call 'gdi32::CreateFont(i -15, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, t "Microsoft YaHei UI") i .s'
  Pop $FONT_SUBTITLE
  System::Call 'gdi32::CreateFont(i -14, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, t "Microsoft YaHei UI") i .s'
  Pop $FONT_BODY
  System::Call 'gdi32::CreateFont(i -12, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, t "Microsoft YaHei UI") i .s'
  Pop $FONT_SMALL
  System::Call 'gdi32::CreateFont(i -15, i 0, i 0, i 0, i 700, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, t "Microsoft YaHei UI") i .s'
  Pop $FONT_BTN
FunctionEnd

; ---------- GUI Init: size window ----------
Function .onGUIInit
  ; Calculate window size for 520x420 client area
  System::Call 'user32::GetWindowRect(i $HWNDPARENT, i 0r1)'
  System::Call 'user32::GetClientRect(i $HWNDPARENT, i 0r2)'
  ; r1 = &RECT (left,top,right,bottom) of window; r2 = &RECT (0,0,cw,ch) of client
  System::Call '*$R2(i,i,i.r3,i.r4)'   ; r3=cw, r4=ch
  System::Call '*$R1(i.r5,i.r6,i.r7,i.r8)' ; r5=l, r6=t, r7=r, r8=b
  IntOp $R7 $R7 - $R5  ; window w
  IntOp $R8 $R8 - $R6  ; window h
  IntOp $R9 $R7 - $R3  ; border w
  IntOp $R0 $R8 - $R4  ; border h
  IntOp $1 520 + $R9   ; new window w
  IntOp $2 420 + $R0   ; new window h
  ; Center
  System::Call 'user32::GetSystemMetrics(i 0) i .r3' ; SM_CXSCREEN
  System::Call 'user32::GetSystemMetrics(i 1) i .r4' ; SM_CYSCREEN
  IntOp $5 $R3 - $1
  IntOp $5 $5 / 2
  IntOp $6 $R4 - $2
  IntOp $6 $6 / 2
  System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i $5, i $6, i $1, i $2, i 0x0004|0x0010|0x0020)'
FunctionEnd

; ---------- Browse ----------
Function OnBrowse
  nsDialogs::SelectFolderDialog "选择安装目录" "$INSTDIR"
  Pop $R0
  ${If} $R0 != "error"
  ${AndIf} $R0 != ""
    StrCpy $INSTDIR $R0
    SendMessage $PATH_EDIT ${WM_SETTEXT} 0 "STR:$R0"
  ${EndIf}
FunctionEnd

; ---------- Install click ----------
Function OnInstall
  ${If} $RUNNING == 1
    Return
  ${EndIf}
  StrCpy $RUNNING 1
  StrCpy $CAN_INSTALL 1
  ; Read path from edit
  System::Call 'user32::GetWindowText(i $PATH_EDIT, t .r0, i 512)'
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}
  ${NSD_GetState} $SHORTCUT_CHK $CREATE_SC
  ; Advance to next page (instfiles)
  SendMessage $HWNDPARENT ${WM_COMMAND} ${IDOK} 0
FunctionEnd

; ---------- Custom page ----------
Function ShowPage
  nsDialogs::Create 1018
  Pop $DLG
  ${If} $DLG == error
    Abort
  ${EndIf}

  ; Dialog background: deep sea blue
  SetCtlColors $DLG "F2F4F7" "0C1A2D"

  ; --- Logo (64x64 bitmap) ---
  ; Use nsDialogs::CreateControl with same pattern as NSD macros: class, style, exstyle, x, y, w, h, text
  nsDialogs::CreateControl /NOUNLOAD "STATIC" "${WS_VISIBLE}|${WS_CHILD}|${SS_BITMAP}|${SS_CENTERIMAGE}|${WS_CLIPSIBLINGS}" "0" 228 30 64 64 ""
  Pop $LOGO_HWND
  ${If} $LOGO_HWND != error
    SendMessage $LOGO_HWND ${STM_SETIMAGE} ${IMAGE_BITMAP} $LOGO_BMP
  ${Else}
    ; Fallback: label
    ${NSD_CreateLabel} 228 30 64 64 "[Lynx]"
    Pop $LOGO_HWND
    SendMessage $LOGO_HWND ${WM_SETFONT} $FONT_TITLE 1
    SetCtlColors $LOGO_HWND "FFFFFF" "transparent"
  ${EndIf}

  ; --- Title: Lynx ---
  ${NSD_CreateLabel} 0 105 100% 38 "Lynx"
  Pop $R0
  SendMessage $R0 ${WM_SETFONT} $FONT_TITLE 1
  SetCtlColors $R0 "FFFFFF" "transparent"

  ; --- Subtitle ---
  ${NSD_CreateLabel} 0 145 100% 22 "AI 原生桌面端"
  Pop $R0
  SendMessage $R0 ${WM_SETFONT} $FONT_SUBTITLE 1
  SetCtlColors $R0 "A0AAB9" "transparent"

  ; --- Path label ---
  ${NSD_CreateLabel} 80 200 100% 18 "安装路径"
  Pop $R0
  SendMessage $R0 ${WM_SETFONT} $FONT_SMALL 1
  SetCtlColors $R0 "8B95A5" "transparent"

  ; --- Path input ---
  ${NSD_CreateText} 80 222 290 34 "$INSTDIR"
  Pop $PATH_EDIT
  SendMessage $PATH_EDIT ${WM_SETFONT} $FONT_BODY 1
  SetCtlColors $PATH_EDIT "F2F4F7" "162237"

  ; --- Browse button ---
  ${NSD_CreateButton} 380 222 60 34 "浏览"
  Pop $BROWSE_BTN
  SendMessage $BROWSE_BTN ${WM_SETFONT} $FONT_BODY 1
  ${NSD_OnClick} $BROWSE_BTN OnBrowse

  ; --- Shortcut checkbox ---
  ${NSD_CreateCheckbox} 80 272 240 20 "创建桌面快捷方式"
  Pop $SHORTCUT_CHK
  SendMessage $SHORTCUT_CHK ${WM_SETFONT} $FONT_SMALL 1
  SetCtlColors $SHORTCUT_CHK "D1D5DB" "transparent"
  ${NSD_Check} $SHORTCUT_CHK

  ; --- Install button ---
  ${NSD_CreateButton} 80 310 360 44 "立即安装"
  Pop $INSTALL_BTN
  SendMessage $INSTALL_BTN ${WM_SETFONT} $FONT_BTN 1
  ${NSD_OnClick} $INSTALL_BTN OnInstall

  ; --- Agreement text ---
  ${NSD_CreateLabel} 0 375 100% 16 "点击“立即安装”即表示同意软件许可协议"
  Pop $R0
  SendMessage $R0 ${WM_SETFONT} $FONT_SMALL 1
  SetCtlColors $R0 "6B7280" "transparent"

  StrCpy $RUNNING 0
  nsDialogs::Show
FunctionEnd

Function LeavePage
  ; Only advance if user clicked Install button (not Cancel/Back)
  ${If} $CAN_INSTALL != 1
    Abort
  ${EndIf}
  System::Call 'user32::GetWindowText(i $PATH_EDIT, t .r0, i 512)'
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}
  ${NSD_GetState} $SHORTCUT_CHK $CREATE_SC
FunctionEnd

; ---------- Pages ----------
Page custom ShowPage LeavePage
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

; ---------- Section ----------
Section "Lynx"
  Call KillProc
  SetShellVarContext all
  SetOutPath "$INSTDIR"
  SetOverwrite on

  DetailPrint "正在安装 ${PRODUCT_NAME}..."
  File "bin\${PRODUCT_EXE}"

  DetailPrint "正在释放前端资源..."
  SetOutPath "$INSTDIR\out\app"
  File /r "out\app\*.*"

  DetailPrint "正在写入配置..."
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "HelpLink" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1

  ${If} $CREATE_SC == 1
    DetailPrint "正在创建桌面快捷方式..."
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  ${EndIf}

  ; Launch app after install
  Exec '"$INSTDIR\${PRODUCT_EXE}"'
  DetailPrint "安装完成！"
SectionEnd

; ---------- Uninstall ----------
Function un.onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  ReadRegStr $INSTDIR HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"
  ${If} $INSTDIR == ""
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_NAME}"
  ${EndIf}
  Call un.KillProc
FunctionEnd

Function un.KillProc
  StrCpy $R9 0
  un_kill_loop:
    ExecWait 'taskkill /F /IM ${PRODUCT_EXE} /T' $R8
    Sleep 500
    IntOp $R9 $R9 + 1
    ${If} $R9 < 3
      Goto un_kill_loop
    ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext all
  Delete /REBOOTOK "$INSTDIR\${PRODUCT_EXE}"
  RMDir /r "$INSTDIR\out"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete /REBOOTOK "$INSTDIR\uninstall.exe"
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  RMDir /r "$INSTDIR"
  SetAutoClose true
SectionEnd
