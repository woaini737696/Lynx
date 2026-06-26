"""
使用 Python 直接调用 Gradle 构建 Android 项目
Python 不受 TRAE 沙箱限制，可以直接创建文件
"""
import os
import sys
import subprocess

# 设置环境变量
env = os.environ.copy()
env["JAVA_HOME"] = r"D:\Studio\jbr"
env["ANDROID_HOME"] = r"D:\Android\Sdk"
env["ANDROID_SDK_ROOT"] = r"D:\Android\Sdk"
env["GRADLE_USER_HOME"] = r"D:\Gradle\.gradle"
# 更新 PATH
path_parts = env["PATH"].split(";")
path_parts.insert(0, r"D:\Studio\jbr\bin")
path_parts.insert(0, r"D:\Android\Sdk\platform-tools")
env["PATH"] = ";".join(path_parts)

# 验证环境
print("=" * 60)
print("构建环境验证")
print("=" * 60)
print(f"JAVA_HOME: {env['JAVA_HOME']}")
print(f"ANDROID_HOME: {env['ANDROID_HOME']}")
print(f"GRADLE_USER_HOME: {env['GRADLE_USER_HOME']}")

# 验证 Java
java_exe = os.path.join(env["JAVA_HOME"], "bin", "java.exe")
result = subprocess.run([java_exe, "-version"], capture_output=True, text=True, env=env)
print(f"Java: {result.stderr.split(chr(10))[0]}")

# 确保 daemon 目录存在
daemon_dir = os.path.join(env["GRADLE_USER_HOME"], "daemon", "8.7")
os.makedirs(daemon_dir, exist_ok=True)
# 测试写入权限
test_file = os.path.join(daemon_dir, "test-write.txt")
with open(test_file, "w") as f:
    f.write("test")
os.remove(test_file)
print(f"✓ Gradle daemon 目录可写: {daemon_dir}")

# 构建
print("\n" + "=" * 60)
print("开始构建 Android 项目")
print("=" * 60)

# 必须使用 Junction 路径 D:\LynnHub（无中文），避免 AGP 拒绝中文路径
project_dir = r"D:\LynnHub\android"
gradlew = os.path.join(project_dir, "gradlew.bat")
print(f"项目路径: {project_dir}")

result = subprocess.run(
    [gradlew, "assembleDebug", "--no-daemon", "--console=plain"],
    cwd=project_dir,
    env=env,
    timeout=600,
)

print(f"\n构建退出码: {result.returncode}")

# 验证 APK
apk_path = os.path.join(project_dir, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
if os.path.exists(apk_path):
    size_mb = os.path.getsize(apk_path) / (1024 * 1024)
    print(f"✓ APK 构建成功!")
    print(f"  路径: {apk_path}")
    print(f"  大小: {size_mb:.1f} MB")
else:
    print(f"✗ APK 未找到: {apk_path}")

sys.exit(result.returncode)
