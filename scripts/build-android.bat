@echo off
REM ============================================================
REM LynnHub Android 项目构建脚本
REM 使用 D 盘的 Android Studio JDK 和 Gradle 缓存
REM ============================================================
setlocal
set JAVA_HOME=D:\Studio\jbr
set ANDROID_HOME=D:\Android\Sdk
set ANDROID_SDK_ROOT=D:\Android\Sdk
set GRADLE_USER_HOME=D:\Gradle\.gradle
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

echo ============================================================
echo  LynnHub Android 构建
echo ============================================================
echo JAVA_HOME:        %JAVA_HOME%
echo ANDROID_HOME:     %ANDROID_HOME%
echo GRADLE_USER_HOME: %GRADLE_USER_HOME%
echo.

REM 切换到项目目录（通过 Junction 使用 ASCII 路径）
cd /d D:\LynnHub\android

REM 构建
call gradlew.bat assembleDebug --no-daemon --console=plain %*

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  BUILD SUCCESSFUL
    echo ============================================================
    echo APK: D:\LynnHub\android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo 安装到设备: adb install -r app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo ============================================================
    echo  BUILD FAILED (exit code %ERRORLEVEL%)
    echo ============================================================
)

endlocal
