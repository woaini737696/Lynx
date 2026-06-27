# 全面检查 exe 的每个导入函数是否存在
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public class ImportChecker {
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern IntPtr LoadLibraryEx(string lpFileName, IntPtr hFile, uint dwFlags);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr GetProcAddressOrdinal(IntPtr hModule, ushort uOrdinal);
    [DllImport("kernel32.dll")]
    public static extern bool FreeLibrary(IntPtr hModule);
    [DllImport("kernel32.dll")]
    public static extern uint GetLastError();
}
"@

# exe 的完整导入表 (从 Python 脚本获取)
$imports = @{
    "kernel32.dll" = @("AddVectoredExceptionHandler","CreateToolhelp32Snapshot","DeleteCriticalSection","EnterCriticalSection","FreeEnvironmentStringsW","GetCommandLineW","GetCurrentDirectoryW","GetEnvironmentStringsW","GetEnvironmentVariableW","InitializeCriticalSection","LeaveCriticalSection","Module32FirstW","Module32NextW","QueryPerformanceCounter","QueryPerformanceFrequency","RtlCaptureContext","RtlUnwindEx","RtlVirtualUnwind","SetEnvironmentVariableW","SetUnhandledExceptionFilter","GetModuleHandleA","GetProcAddress","Sleep","CompareStringOrdinal","DuplicateHandle","ExitProcess","GetCurrentProcess","GetCurrentProcessId","GetCurrentThread","GetCurrentThreadId","GetExitCodeProcess","GetModuleFileNameW","GetModuleHandleW","GetProcessId","GetSystemDirectoryW","GetSystemInfo","GetSystemTimePreciseAsFileTime","GetUserDefaultUILanguage","GetWindowsDirectoryW","HeapReAlloc","InitOnceBeginInitialize","InitOnceComplete","LCIDToLocaleName","LoadLibraryA","LoadLibraryW","MapViewOfFile","MultiByteToWideChar","RaiseException","RegisterWaitForSingleObject","RtlLookupFunctionEntry","SetHandleInformation","SetLastError","SetThreadStackGuarantee","SetWaitableTimer","SleepEx","SwitchToThread","TerminateProcess","TlsAlloc","TlsFree","TlsGetValue","TlsSetValue","UnmapViewOfFile","UnregisterWaitEx","VirtualProtect","VirtualQuery","WaitForMultipleObjects","WaitForSingleObject","lstrlenW","CloseHandle","GetProcessHeap","HeapAlloc","HeapFree","FormatMessageW","GetLastError","LoadLibraryExA","CancelIo","CancelIoEx","CopyFileExW","CreateDirectoryW","CreateEventW","CreateFileMappingA","CreateFileW","CreateIoCompletionPort","CreatePipe","CreateProcessW","CreateSymbolicLinkW","CreateThread","CreateWaitableTimerExW","DeleteFileW","DeviceIoControl","FindClose","FindFirstFileExW","FindNextFileW","GetConsoleMode","GetConsoleOutputCP","GetConsoleScreenBufferInfo","GetFileAttributesW","GetFileInformationByHandle","GetFileInformationByHandleEx","GetFileType","GetFinalPathNameByHandleW","GetFullPathNameW","GetOverlappedResult","GetQueuedCompletionStatusEx","GetStdHandle","GetTempPathW","MoveFileExW","PostQueuedCompletionStatus","ReadFile","ReadFileEx","RemoveDirectoryW","SetConsoleMode","SetConsoleTextAttribute","SetFileCompletionNotificationModes","SetFileInformationByHandle","SetFilePointerEx","SetFileTime","WriteConsoleW","WriteFile","WriteFileEx")
    "shell32.dll" = @("ILCreateFromPathW","ILFree","SHOpenFolderAndSelectItems","DragFinish","DragQueryFileW","SHAppBarMessage","SHCreateItemFromParsingName","SHGetKnownFolderPath","ShellExecuteExW","ShellExecuteW","Shell_NotifyIconGetRect","Shell_NotifyIconW")
    "KERNEL32.dll" = @("__C_specific_handler")
    "msvcrt.dll" = @("__getmainargs","__initenv","__iob_func","__set_app_type","__setusermatherr","_amsg_exit","_cexit","_commode","_errno","_exit","_fmode","_initterm","_onexit","abort","calloc","exit","fprintf","free","fwrite","malloc","memcmp","memcpy","memmove","memset","signal","strlen","strncmp","vfprintf","wcslen")
    "ntdll.dll" = @("NtCreateNamedPipeFile","RtlNtStatusToDosError","NtCancelIoFileEx","NtCreateFile","NtDeviceIoControlFile","NtOpenFile","NtReadFile","NtWriteFile","RtlGetVersion")
    "bcryptprimitives.dll" = @("ProcessPrng")
    "advapi32.dll" = @("RegGetValueW","RegCloseKey","RegOpenKeyExW","RegQueryValueExW","SystemFunction036")
    "api-ms-win-core-synch-l1-2-0.dll" = @("WaitOnAddress","WakeByAddressAll","WakeByAddressSingle")
    "comctl32.dll" = @("DefSubclassProc","RemoveWindowSubclass","SetWindowSubclass","TaskDialogIndirect")
    "dwmapi.dll" = @("DwmEnableBlurBehindWindow","DwmGetWindowAttribute","DwmSetWindowAttribute")
    "gdi32.dll" = @("BitBlt","CombineRgn","CreateCompatibleDC","CreateDIBSection","CreateRectRgn","CreateSolidBrush","DeleteDC","DeleteObject","GetDeviceCaps","SelectObject","SetBkMode","SetTextColor")
    "ole32.dll" = @("CoCreateFreeThreadedMarshaler","CoCreateInstance","CoInitialize","CoInitializeEx","CoTaskMemAlloc","CoTaskMemFree","CoUninitialize","OleInitialize","RegisterDragDrop","RevokeDragDrop")
    "shlwapi.dll" = @("SHCreateMemStream")
    "user32.dll" = @("AdjustWindowRect","AdjustWindowRectEx","AppendMenuW","ChangeDisplaySettingsExW","ChangeWindowMessageFilterEx","CheckMenuItem","ClientToScreen","ClipCursor","CloseTouchInputHandle","CreateAcceleratorTableW","CreateIcon","CreateMenu","CreatePopupMenu","CreateWindowExW","DefWindowProcW","DestroyAcceleratorTable","DestroyIcon","DestroyMenu","DestroyWindow","DispatchMessageA","DispatchMessageW","DrawIconEx","DrawMenuBar","DrawTextW","EnableMenuItem","EnableWindow","EnumChildWindows","EnumDisplayMonitors","FillRect","FindWindowExW","FlashWindowEx","GetActiveWindow","GetAsyncKeyState","GetClientRect","GetClipCursor","GetCursorPos","GetDC","GetForegroundWindow","GetKeyState","GetKeyboardLayout","GetKeyboardState","GetMenu","GetMenuBarInfo","GetMenuItemInfoW","GetMessageA","GetMessageW","GetMonitorInfoW","GetParent","GetRawInputData","GetSystemMenu","GetSystemMetrics","GetTouchInputInfo","GetUpdateRect","GetWindow","GetWindowDC","GetWindowLongPtrW","GetWindowLongW","GetWindowPlacement","GetWindowRect","GetWindowTextLengthW","GetWindowTextW","InsertMenuW","InvalidateRect","InvalidateRgn","IsIconic","IsProcessDPIAware","IsWindow","IsWindowEnabled","IsWindowVisible","KillTimer","LoadCursorW","MapVirtualKeyExW","MapVirtualKeyW","MapWindowPoints","MonitorFromPoint","MonitorFromRect","MonitorFromWindow","MsgWaitForMultipleObjectsEx","OffsetRect","PeekMessageW","PostMessageW","PostQuitMessage","PostThreadMessageW","RedrawWindow","RegisterClassExW","RegisterClassW","RegisterRawInputDevices","RegisterTouchWindow","RegisterWindowMessageA","ReleaseCapture","ReleaseDC","RemoveMenu","ScreenToClient","SendInput","SendMessageW","SetCapture","SetCursor","SetCursorPos","SetFocus","SetForegroundWindow","SetMenu","SetMenuItemInfoW","SetParent","SetPropW","SetTimer","SetWindowDisplayAffinity","SetWindowLongPtrW","SetWindowLongW","SetWindowPlacement","SetWindowPos","SetWindowRgn","SetWindowTextW","ShowCursor","ShowWindow","SystemParametersInfoA","SystemParametersInfoW","ToUnicodeEx","TrackMouseEvent","TrackPopupMenu","TranslateAcceleratorW","TranslateMessage","UpdateWindow","ValidateRect","VkKeyScanW")
    "oleaut32.dll" = @("GetErrorInfo","SetErrorInfo","SysFreeString","SysStringLen")
    "bcrypt.dll" = @("BCryptGenRandom")
    "crypt32.dll" = @("CertAddCertificateContextToStore","CertAddEncodedCertificateToStore","CertCloseStore","CertCreateCertificateChainEngine","CertDuplicateCertificateChain","CertDuplicateCertificateContext","CertDuplicateStore","CertEnumCertificatesInStore","CertFreeCertificateChain","CertFreeCertificateChainEngine","CertFreeCertificateContext","CertGetCertificateChain","CertOpenStore","CertSetCertificateContextProperty","CertVerifyCertificateChainPolicy")
    "secur32.dll" = @("AcceptSecurityContext","AcquireCredentialsHandleA","ApplyControlToken","DecryptMessage","DeleteSecurityContext","EncryptMessage","FreeContextBuffer","FreeCredentialsHandle","InitializeSecurityContextW","QueryContextAttributesW")
    "ws2_32.dll" = @("WSACleanup","WSAGetLastError","WSAIoctl","WSASend","WSASocketW","WSAStartup","bind","closesocket","connect","freeaddrinfo","getaddrinfo","getpeername","getsockname","getsockopt","ioctlsocket","recv","send","setsockopt","shutdown")
    "WebView2Loader.dll" = @("CreateCoreWebView2EnvironmentWithOptions","GetAvailableCoreWebView2BrowserVersionString")
}

$systemDir = "C:\Windows\System32"
$missing = @()
$allOk = $true

foreach ($dll in $imports.Keys | Sort-Object -Unique) {
    $dllPath = Join-Path $systemDir $dll
    if ($dll -eq "WebView2Loader.dll") {
        $dllPath = "D:\lynnhub_link\release\WebView2Loader.dll"
    }

    if (-not (Test-Path $dllPath)) {
        Write-Output "[MISSING DLL] $dll at $dllPath"
        $missing += "DLL $dll not found"
        $allOk = $false
        continue
    }

    $handle = [ImportChecker]::LoadLibraryEx($dllPath, [IntPtr]::Zero, 0)
    if ($handle -eq [IntPtr]::Zero) {
        $err = [ImportChecker]::GetLastError()
        Write-Output "[LOAD FAILED] $dll - Error: $err"
        $missing += "DLL $dll load failed (error $err)"
        $allOk = $false
        continue
    }

    foreach ($func in $imports[$dll]) {
        $proc = [ImportChecker]::GetProcAddress($handle, $func)
        if ($proc -eq [IntPtr]::Zero) {
            Write-Output "[MISSING FUNC] $dll ! $func"
            $missing += "$dll: $func"
            $allOk = $false
        }
    }

    [ImportChecker]::FreeLibrary($handle) | Out-Null
}

Write-Output ""
if ($allOk) {
    Write-Output "=== ALL IMPORTS OK ==="
} else {
    Write-Output "=== MISSING IMPORTS ==="
    foreach ($m in $missing) {
        Write-Output "  $m"
    }
}
