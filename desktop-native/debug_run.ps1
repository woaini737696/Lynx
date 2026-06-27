Add-Type @"
using System;
using System.Runtime.InteropServices;

public class ProcessDebugger {
    [StructLayout(LayoutKind.Sequential)]
    public struct STARTUPINFO {
        public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
        public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public ushort wShowWindow, cbReserved2; public IntPtr lpReserved2;
        public IntPtr hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess, hThread; public uint dwProcessId, dwThreadId;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct EXCEPTION_RECORD {
        public uint ExceptionCode; public uint ExceptionFlags;
        public IntPtr ExceptionRecord; public IntPtr ExceptionAddress;
        public uint NumberParameters;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)] public IntPtr[] ExceptionInformation;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct DEBUG_EVENT {
        public uint dwDebugEventCode; public uint dwProcessId; public uint dwThreadId;
        public EXCEPTION_RECORD Exception;
        public uint padding1; public uint padding2; public uint padding3;
        public uint padding4; public uint padding5; public uint padding6;
        public uint padding7; public uint padding8; public uint padding9;
    }
    [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool CreateProcess(string lpApplicationName, string lpCommandLine,
        IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles,
        uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool WaitForDebugEvent(ref DEBUG_EVENT lpDebugEvent, uint dwMilliseconds);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool ContinueDebugEvent(uint dwThreadId, uint dwProcessId, uint dwContinueStatus);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool CloseHandle(IntPtr hObject);
    public const uint DEBUG_ONLY_THIS_PROCESS = 0x00000002;
    public const uint DBG_CONTINUE = 0x00010002;
    public const uint DBG_EXCEPTION_NOT_HANDLED = 0x80010001;
}
"@

$si = New-Object ProcessDebugger+STARTUPINFO
$si.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($si)
$pi = New-Object ProcessDebugger+PROCESS_INFORMATION

$exePath = "D:\lynnhub_link\release\LynnHub.exe"
$success = [ProcessDebugger]::CreateProcess($exePath, $null, [IntPtr]::Zero, [IntPtr]::Zero, $false,
    [ProcessDebugger]::DEBUG_ONLY_THIS_PROCESS, [IntPtr]::Zero, "D:\lynnhub_link\release", [ref]$si, [ref]$pi)

if (-not $success) {
    Write-Host "CreateProcess failed: $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    exit
}

Write-Host "Process created, PID: $($pi.dwProcessId)"
Write-Host "Waiting for debug events..."

$dllCount = 0
$eventCount = 0
$maxEvents = 300

while ($eventCount -lt $maxEvents) {
    $de = New-Object ProcessDebugger+DEBUG_EVENT
    $ok = [ProcessDebugger]::WaitForDebugEvent([ref]$de, 3000)
    if (-not $ok) {
        Write-Host "No more debug events (timeout)"
        break
    }
    $eventCount++

    switch ($de.dwDebugEventCode) {
        1 {
            $code = $de.Exception.ExceptionCode
            $hex = "0x{0:X8}" -f $code
            Write-Host "EXCEPTION: $hex at 0x$('{0:X}' -f $de.Exception.ExceptionAddress.ToInt64())"
            if ($code -eq 0xC0000139) { Write-Host "  >>> STATUS_ENTRYPOINT_NOT_FOUND <<<" }
            if ($code -eq 0xC0000135) { Write-Host "  >>> STATUS_DLL_NOT_FOUND <<<" }
            if ($code -eq 0xE06D7363) { Write-Host "  >>> C++ Exception <<<" }
            if ($code -eq 0xC0000005) { Write-Host "  >>> ACCESS_VIOLATION <<<" }
            [ProcessDebugger]::ContinueDebugEvent($de.dwThreadId, $de.dwProcessId, [ProcessDebugger]::DBG_EXCEPTION_NOT_HANDLED) | Out-Null
        }
        3 { [ProcessDebugger]::ContinueDebugEvent($de.dwThreadId, $de.dwProcessId, [ProcessDebugger]::DBG_CONTINUE) | Out-Null }
        5 {
            $exitCode = $de.Exception.ExceptionAddress.ToInt64()
            Write-Host "EXIT_PROCESS: code=$exitCode (0x$('{0:X}' -f $exitCode))"
            [ProcessDebugger]::ContinueDebugEvent($de.dwThreadId, $de.dwProcessId, [ProcessDebugger]::DBG_CONTINUE) | Out-Null
            break
        }
        6 { $dllCount++; [ProcessDebugger]::ContinueDebugEvent($de.dwThreadId, $de.dwProcessId, [ProcessDebugger]::DBG_CONTINUE) | Out-Null }
        default { [ProcessDebugger]::ContinueDebugEvent($de.dwThreadId, $de.dwProcessId, [ProcessDebugger]::DBG_CONTINUE) | Out-Null }
    }
}

Write-Host "`nTotal events: $eventCount, DLLs loaded: $dllCount"
$exitCode = 0
[ProcessDebugger]::GetExitCodeProcess($pi.hProcess, [ref]$exitCode) | Out-Null
Write-Host "Final exit code: $exitCode (0x$('{0:X}' -f $exitCode))"
[ProcessDebugger]::TerminateProcess($pi.hProcess, 1) | Out-Null
[ProcessDebugger]::CloseHandle($pi.hThread) | Out-Null
[ProcessDebugger]::CloseHandle($pi.hProcess) | Out-Null
