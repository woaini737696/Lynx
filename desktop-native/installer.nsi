; ============================================================
; Lynx native desktop NSIS installer
; Style: iOS liquid-glass deep-sea single-page installer
; Output: dist\lynx_1.0.0.exe
; ============================================================

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"

; ---------- Product info ----------
!define PRODUCT_NAME      "Lynx"
!define PRODUCT_VERSION   "1.0.0"
!define PRODUCT_PUBLISHER "Lynx"
!define PRODUCT_WEB_SITE  "https://app.lynnhub.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\lynnhub-desktop-native.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

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

; ---------- Deep-sea brand palette ----------
!define BRAND_BG      "060D18"
!define BRAND_PANEL   "0F1B2E"
!define BRAND_TEXT    "F9FAFB"
!define BRAND_SECOND  "9CA3AF"
!define BRAND_MUTED   "6B7280"
!define BRAND_BLUE    "2563EB"
!define BRAND_BLUE_LT "3B82F6"
!define BRAND_GLOW    "1D4ED8"

; ---------- MUI settings ----------
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Cancel ${PRODUCT_NAME} installation?"
!define MUI_ICON "src-tauri\icons\icon.ico"
!define MUI_UNICON "src-tauri\icons\icon.ico"

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "${PRODUCT_NAME} installed"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Starting ${PRODUCT_NAME}..."
!define MUI_INSTFILESPAGE_ABORTHEADER_TEXT "Installation cancelled"
!define MUI_INSTFILESPAGE_ABORTHEADER_SUBTEXT "${PRODUCT_NAME} installation was not completed."

!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"
!define MUI_INSTALLCOLORS "${BRAND_BLUE_LT} ${BRAND_BG}"

; ---------- Page flow ----------
Page custom CustomInstallPage CustomInstallPageLeave
!define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesShow
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "SimpChinese"

; ---------- Custom page variables ----------
Var Dialog
Var PathEdit
Var DesktopCheckbox
Var InstallBtn

; ---------- Init: uninstall existing version ----------
Function .onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  ReadRegStr $R0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
  ${If} $R0 != ""
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "An older version of ${PRODUCT_NAME} was detected.$\nClick OK to remove it first, then continue." \
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

; ---------- Custom install page: deep-sea liquid glass ----------
Function CustomInstallPage
  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; Hide default Next/Back/Cancel buttons
  GetDlgItem $R0 $HWNDPARENT 1
  ShowWindow $R0 ${SW_HIDE}
  GetDlgItem $R0 $HWNDPARENT 2
  ShowWindow $R0 ${SW_HIDE}
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}

  ; Dark dialog background (visible around edges)
  SetCtlColors $Dialog ${BRAND_TEXT} ${BRAND_BG}

  ; Full-page background bitmap
  File "assets\installer-bg.bmp"
  ${NSD_CreateBitmap} 0 0 520 420 ""
  Pop $R0
  ${NSD_SetImage} $R0 "$PLUGINSDIR\installer-bg.bmp" $R1

  ; Logo overlay (128x128, centered)
  File "assets\installer-logo.bmp"
  ${NSD_CreateBitmap} 196 70 128 128 ""
  Pop $R0
  ${NSD_SetImage} $R0 "$PLUGINSDIR\installer-logo.bmp" $R1

  ; Common font
  CreateFont $R2 "Microsoft YaHei" "10" "400"

  ; Install path input (dark glass look)
  ${NSD_CreateText} 80 260 270 28 "$INSTDIR"
  Pop $PathEdit
  SetCtlColors $PathEdit ${BRAND_TEXT} ${BRAND_PANEL}
  SendMessage $PathEdit ${WM_SETFONT} $R2 0

  ; Browse button
  ${NSD_CreateButton} 360 260 80 28 "Browse..."
  Pop $R0
  SetCtlColors $R0 ${BRAND_TEXT} ${BRAND_PANEL}
  SendMessage $R0 ${WM_SETFONT} $R2 0
  ${NSD_OnClick} $R0 OnBrowseClick

  ; Desktop shortcut checkbox
  ${NSD_CreateCheckbox} 80 302 300 18 "Create desktop shortcut"
  Pop $DesktopCheckbox
  SetCtlColors $DesktopCheckbox ${BRAND_TEXT} ${BRAND_PANEL}
  SendMessage $DesktopCheckbox ${WM_SETFONT} $R2 0
  ${NSD_Check} $DesktopCheckbox

  ; Install button (blue)
  ${NSD_CreateButton} 80 342 360 42 "Install Now"
  Pop $InstallBtn
  SetCtlColors $InstallBtn ${BRAND_TEXT} ${BRAND_BLUE}
  CreateFont $R3 "Microsoft YaHei" "12" "700"
  SendMessage $InstallBtn ${WM_SETFONT} $R3 0
  ${NSD_OnClick} $InstallBtn OnInstallClick

  nsDialogs::Show
FunctionEnd

Function OnBrowseClick
  nsDialogs::SelectFolderDialog "Select ${PRODUCT_NAME} install location" "$INSTDIR"
  Pop $R0
  ${If} $R0 != error
    ${NSD_SetText} $PathEdit "$R0\${PRODUCT_NAME}"
  ${EndIf}
FunctionEnd

Function OnInstallClick
  ; Simulate click on the hidden Next button to proceed to instfiles
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function CustomInstallPageLeave
  ${NSD_GetText} $PathEdit $INSTDIR
  ${If} $INSTDIR == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please select an install path."
    Abort
  ${EndIf}
FunctionEnd

; ---------- Instfiles page: dark theme, hide cancel ----------
Function InstFilesShow
  SetCtlColors $HWNDPARENT ${BRAND_TEXT} ${BRAND_BG}
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}
FunctionEnd

; ---------- Install section ----------
Section "Lynx Main" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer

  DetailPrint "Preparing ${PRODUCT_NAME} installation..."
  File "bin\lynnhub-desktop-native.exe"

  DetailPrint "Extracting frontend resources..."
  SetOutPath "$INSTDIR\out"
  File /r "out\*.*"

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; App path registry
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\lynnhub-desktop-native.exe"

  ; Uninstall info
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

  ; Desktop shortcut
  ${If} ${Silent}
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
  ${Else}
    ${NSD_GetState} $DesktopCheckbox $R0
    ${If} $R0 == "1"
      CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\lynnhub-desktop-native.exe" "" "$INSTDIR\lynnhub-desktop-native.exe" 0
    ${EndIf}
  ${EndIf}

  ; Launch after install
  Exec "$INSTDIR\lynnhub-desktop-native.exe"
SectionEnd

; ---------- Uninstall section ----------
Section "Uninstall"
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}

  Delete "$INSTDIR\lynnhub-desktop-native.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir /r "$INSTDIR\out"

  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

  RMDir "$INSTDIR"

  SetAutoClose true
SectionEnd
