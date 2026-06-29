; ============================================================
; Lynx Installer v12 - CreateWindowEx像素精确控件(不用WS_POPUP)
; 关键修复: nsDialogs的NSD_Create*用dialog units不是pixels,
; 导致按钮位置超出窗口可见范围。改用CreateWindowEx直接像素定位。
; ============================================================

Unicode True
Name "Lynx"
OutFile "dist\lynx_1.0.5.exe"
InstallDir "$PROGRAMFILES64\Lynx"
SetCompressor lzma
RequestExecutionLevel admin
ShowInstDetails hide
BrandingText " "

!define PRODUCT_EXE "lynnhub-desktop-native.exe"

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; --- Pages ---
Page custom pgInstall
Page custom pgProgress
Page custom pgFinish

; --- Dummy section ---
Section ""
  SetAutoClose true
SectionEnd

; --- Variables ---
Var DLG
Var INSTALL_DIR
Var BTN_INSTALL
Var BTN_BROWSE
Var BTN_FINISH
Var DIR_INPUT
Var PROGRESS_LABEL
Var BG_CTL
Var FONT_BTN
Var FONT_INPUT
Var FONT_LABEL

; ============================================================
; .onInit
; ============================================================
Function .onInit
  InitPluginsDir

  ; 创建字体
  CreateFont $FONT_BTN "Microsoft YaHei UI" 11 700
  CreateFont $FONT_INPUT "Microsoft YaHei UI" 9 400
  CreateFont $FONT_LABEL "Microsoft YaHei UI" 10 400

  SetRegView 64
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "UninstallString"
  SetRegView lastused

  ${If} $R0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "Lynx 已安装，是否覆盖安装？$\r$\n$\r$\n点击「是」将关闭当前运行的 Lynx 并覆盖安装。" IDYES doKill IDNO abortInstall
    doKill:
      nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_EXE}" /T 2>&1'
      Sleep 1000
      Delete "$DESKTOP\Lynx.lnk"
      Delete "$SMPROGRAMS\Lynx.lnk"
      DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx"
      Goto initContinue
    abortInstall:
      Quit
  ${EndIf}

  initContinue:
  StrCpy $INSTALL_DIR "$PROGRAMFILES64\Lynx"

  File "/oname=$PLUGINSDIR\bg-install.bmp" "assets\bg-install.bmp"
  File "/oname=$PLUGINSDIR\bg-progress.bmp" "assets\bg-progress.bmp"
  File "/oname=$PLUGINSDIR\bg-finish.bmp" "assets\bg-finish.bmp"
FunctionEnd

; ============================================================
; .onGUIInit - 调整窗口 + 隐藏导航 + 扩展内层页面
; ============================================================
Function .onGUIInit
  ; 计算外窗口大小（520x380 client + 标准边框）
  System::Call '*(i 0, i 0, i 520, i 380) p.r0'
  System::Call 'user32::AdjustWindowRectEx(p r0, i 0x00CF0000, i 0, i 0)'
  System::Call '*$0(i.r1,i.r2,i.r3,i.r4)'
  System::Free $0
  IntOp $5 $3 - $1
  IntOp $6 $4 - $2
  System::Call 'user32::GetSystemMetrics(i 0) i .r0'
  System::Call 'user32::GetSystemMetrics(i 1) i .r1'
  IntOp $2 $0 - $5
  IntOp $2 $2 / 2
  IntOp $3 $1 - $6
  IntOp $3 $3 / 2
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i $2, i $3, i $5, i $6, i 0x0020)'

  ; 隐藏向导导航按钮
  GetDlgItem $R0 $HWNDPARENT 1
  ShowWindow $R0 0
  GetDlgItem $R0 $HWNDPARENT 2
  ShowWindow $R0 0
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 0

  ; 扩展内层页面(1018)填充整个客户区
  System::Call '*(i 0, i 0, i 0, i 0) p.r0'
  System::Call 'user32::GetClientRect(p $HWNDPARENT, p r0)'
  System::Call '*$0(i.r1,i.r2,i.r7,i.r8)'
  System::Free $0
  GetDlgItem $R0 $HWNDPARENT 1018
  System::Call 'user32::SetWindowPos(p $R0, p 0, i 0, i 0, i $7, i $8, i 0x0004)'
FunctionEnd

; ============================================================
; Helper: 用CreateWindowEx创建BMP背景 (像素坐标)
; ============================================================
!macro CreateBgBmp HWND PARENT BMPFILE
  ; STATIC 控件 with SS_BITMAP
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i 0x5000000E, i 0, i 0, i 520, i 380, p ${PARENT}, i 0, p 0, p 0) p.r0'
  StrCpy ${HWND} $0
  ; 加载BMP
  System::Call 'gdi32::LoadImage(p 0, t "${BMPFILE}", i 0, i 0, i 0, i 0x0010) p.r1'
  ; 设置BMP到控件
  SendMessage ${HWND} 0x0172 0 $1
!macroend

; ============================================================
; Helper: 用CreateWindowEx创建按钮 (像素坐标)
; ============================================================
!macro CreatePxBtn HWND PARENT TEXT X Y W H FONT BGCOLOR
  ; BUTTON 控件
  System::Call 'user32::CreateWindowEx(i 0, t "BUTTON", t "${TEXT}", i 0x50010000, i ${X}, i ${Y}, i ${W}, i ${H}, p ${PARENT}, i 0, p 0, p 0) p.r0'
  StrCpy ${HWND} $0
  SendMessage ${HWND} 0x0030 ${FONT} 1
  SetCtlColors ${HWND} "FFFFFF" "${BGCOLOR}"
!macroend

; ============================================================
; Helper: 用CreateWindowEx创建输入框 (像素坐标)
; ============================================================
!macro CreatePxInput HWND PARENT TEXT X Y W H FONT
  ; EDIT 控件
  System::Call 'user32::CreateWindowEx(i 0, t "EDIT", t "${TEXT}", i 0x50010800, i ${X}, i ${Y}, i ${W}, i ${H}, p ${PARENT}, i 0, p 0, p 0) p.r0'
  StrCpy ${HWND} $0
  ; 移除边框
  System::Call 'user32::GetWindowLong(p ${HWND}, i -16) i .r1'
  IntOp $1 $1 & ~0x00800000
  System::Call 'user32::SetWindowLong(p ${HWND}, i -16, i $1)'
  System::Call 'user32::GetWindowLong(p ${HWND}, i -20) i .r1'
  IntOp $1 $1 & ~0x00000200
  System::Call 'user32::SetWindowLong(p ${HWND}, i -20, i $1)'
  SendMessage ${HWND} 0x0030 ${FONT} 1
  SetCtlColors ${HWND} "FFFFFF" "0E1F3C"
!macroend

; ============================================================
; Page 1: 安装目录选择
; ============================================================
Function pgInstall
  nsDialogs::Create 1018
  Pop $DLG

  ; 背景BMP (像素: 0,0,520,380)
  !insertmacro CreateBgBmp $BG_CTL $DLG "$PLUGINSDIR\bg-install.bmp"

  ; 目录输入框 (像素: 80,180,290,34)
  !insertmacro CreatePxInput $DIR_INPUT $DLG "$INSTALL_DIR" 80 180 290 34 $FONT_INPUT

  ; 浏览按钮 (像素: 380,180,60,34)
  !insertmacro CreatePxBtn $BTN_BROWSE $DLG "..." 380 180 60 34 $FONT_INPUT "1A3A5C"
  ${NSD_OnClick} $BTN_BROWSE onBrowse

  ; 立即安装按钮 (像素: 80,305,360,43)
  !insertmacro CreatePxBtn $BTN_INSTALL $DLG "立即安装" 80 305 360 43 $FONT_BTN "1A3A5C"
  ${NSD_OnClick} $BTN_INSTALL onInstall

  nsDialogs::Show
FunctionEnd

; ============================================================
; Page 2: 安装进度
; ============================================================
Function pgProgress
  nsDialogs::Create 1018
  Pop $DLG

  !insertmacro CreateBgBmp $BG_CTL $DLG "$PLUGINSDIR\bg-progress.bmp"

  ; 进度文字 (像素: 60,230,400,20)
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "正在安装...", i 0x50000000, i 60, i 230, i 400, i 20, p $DLG, i 0, p 0, p 0) p.r0'
  StrCpy $PROGRESS_LABEL $0
  SendMessage $PROGRESS_LABEL 0x0030 $FONT_LABEL 1
  SetCtlColors $PROGRESS_LABEL "A0B4D0" "0B1929"

  nsDialogs::Show
FunctionEnd

; ============================================================
; Page 3: 安装完成
; ============================================================
Function pgFinish
  nsDialogs::Create 1018
  Pop $DLG

  !insertmacro CreateBgBmp $BG_CTL $DLG "$PLUGINSDIR\bg-finish.bmp"

  ; 开始使用按钮 (像素: 80,290,360,43)
  !insertmacro CreatePxBtn $BTN_FINISH $DLG "开始使用" 80 290 360 43 $FONT_BTN "1A3A5C"
  ${NSD_OnClick} $BTN_FINISH onFinish

  nsDialogs::Show
FunctionEnd

; ============================================================
; Callbacks
; ============================================================
Function onBrowse
  nsDialogs::SelectFolderDialog "选择安装目录" "$PROGRAMFILES64"
  Pop $R0
  ${If} $R0 != "error"
  ${AndIf} $R0 != ""
    StrCpy $INSTALL_DIR $R0
    System::Call 'user32::SetWindowText(p $DIR_INPUT, t "$R0")'
  ${EndIf}
FunctionEnd

Function onInstall
  ; 读取目录
  System::Call 'user32::GetWindowText(p $DIR_INPUT, t .r0, i 260)'
  StrCpy $INSTALL_DIR $R0

  ; 执行安装
  CreateDirectory "$INSTALL_DIR"
  SetOutPath "$INSTALL_DIR"
  WriteUninstaller "$INSTALL_DIR\uninst.exe"
  File "bin\${PRODUCT_EXE}"
  File /nonfatal /r "bin\resources\*.*"
  File /nonfatal "bin\*.dll"

  ; 快捷方式
  CreateDirectory "$SMPROGRAMS"
  CreateShortCut "$DESKTOP\Lynx.lnk" "$INSTALL_DIR\${PRODUCT_EXE}"
  CreateShortCut "$SMPROGRAMS\Lynx.lnk" "$INSTALL_DIR\${PRODUCT_EXE}"

  ; 注册表
  SetRegView 64
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "DisplayName" "Lynx"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "DisplayVersion" "1.0.5"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "Publisher" "LynnHub"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "DisplayIcon" '"$INSTALL_DIR\${PRODUCT_EXE}"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "HelpLink" "https://app.lynnhub.com/help"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "URLInfoAbout" "https://app.lynnhub.com"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "InstallLocation" "$INSTALL_DIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "UninstallString" '"$INSTALL_DIR\uninst.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx" "NoRepair" 1
  SetRegView lastused

  ; 跳转到下一页
  GetDlgItem $R0 $HWNDPARENT 2
  EnableWindow $R0 1
  SendMessage $R0 0x00F5 0 0
FunctionEnd

Function onFinish
  Exec '"$INSTALL_DIR\${PRODUCT_EXE}"'
  Quit
FunctionEnd

; ============================================================
; Uninstaller
; ============================================================
Section "Uninstall"
  nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_EXE}" /T 2>&1'
  Sleep 1000
  Delete "$DESKTOP\Lynx.lnk"
  Delete "$SMPROGRAMS\Lynx.lnk"
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\${PRODUCT_EXE}"
  Delete "$INSTDIR\*.dll"
  RMDir /r "$INSTDIR\resources"
  RMDir "$INSTDIR"
  SetRegView 64
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Lynx"
  SetRegView lastused
SectionEnd
