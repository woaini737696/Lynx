#!/bin/bash
# 在服务器上安装 Android 构建工具链：JDK 17 + Android SDK
# 幂等：已安装则跳过
set -e

echo "===== [1/4] 安装 OpenJDK 17 (headless) ====="
if command -v java &>/dev/null && java -version 2>&1 | grep -q "17"; then
  echo "JDK 17 已安装，跳过"
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq openjdk-17-jdk-headless unzip 2>&1 | tail -3
  # 设置 JAVA_HOME 并切换默认 java
  update-alternatives --set java /usr/lib/jvm/java-17-openjdk-amd64/bin/java 2>/dev/null || true
  echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> /root/.bashrc
  echo 'export ANDROID_HOME=/opt/android-sdk' >> /root/.bashrc
  echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> /root/.bashrc
fi
java -version 2>&1 | head -1

echo "===== [2/4] 下载 Android cmdline-tools ====="
SDK_DIR=/opt/android-sdk
mkdir -p "$SDK_DIR/cmdline-tools"
if [ -f "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "cmdline-tools 已安装，跳过"
else
  cd /tmp
  CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  echo "下载 cmdline-tools..."
  wget -q --timeout=60 -O cmdline-tools.zip "$CMDLINE_URL"
  unzip -q -o cmdline-tools.zip -d "$SDK_DIR/cmdline-tools-tmp"
  mv "$SDK_DIR/cmdline-tools-tmp/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
  rm -rf "$SDK_DIR/cmdline-tools-tmp" cmdline-tools.zip
fi
echo "cmdline-tools 就绪"

echo "===== [3/4] 安装 SDK Platform 34 + Build Tools 34.0.0 ====="
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$SDK_DIR
export PATH=$PATH:$SDK_DIR/cmdline-tools/latest/bin
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools" 2>&1 | tail -5

echo "===== [4/4] 验证安装 ====="
echo "JAVA_HOME=$JAVA_HOME"
java -version 2>&1 | head -1
ls "$SDK_DIR/platforms/android-34/" 2>/dev/null && echo "Platform 34 OK" || echo "Platform 34 MISSING"
ls "$SDK_DIR/build-tools/34.0.0/" 2>/dev/null | head -1 && echo "Build Tools 34 OK" || echo "Build Tools 34 MISSING"
echo "===== Android SDK 安装完成 ====="
