"""卸载服务器上的 hermes-agent（安全漏洞修复）"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_exec import exec_cmd

print("=" * 60)
print("步骤1: 停止服务器上的 hermes dashboard 进程")
print("=" * 60)
code, out, err = exec_cmd("pkill -f 'hermes dashboard' 2>&1; sleep 1; ps aux | grep hermes | grep -v grep | head -3; echo done")
print(out, err)

print("\n" + "=" * 60)
print("步骤2: 卸载服务器上的 hermes-agent 包")
print("=" * 60)
code, out, err = exec_cmd("pip uninstall -y hermes-agent 2>&1 | tail -5")
print(out, err)

print("\n" + "=" * 60)
print("步骤3: 删除服务器上的 hermes 二进制")
print("=" * 60)
code, out, err = exec_cmd("rm -f /usr/local/bin/hermes /usr/local/bin/hermes.exe 2>&1; ls -la /usr/local/bin/hermes* 2>&1; echo done")
print(out, err)

print("\n" + "=" * 60)
print("步骤4: 删除服务器上的 hermes 数据目录")
print("=" * 60)
code, out, err = exec_cmd("rm -rf /root/.local/share/hermes 2>&1; echo done")
print(out, err)

print("\n" + "=" * 60)
print("步骤5: 验证 hermes 已彻底卸载")
print("=" * 60)
code, out, err = exec_cmd("which hermes 2>&1; hermes --version 2>&1; pip show hermes-agent 2>&1 | head -3; echo '--- verification done ---'")
print(out, err)

print("\n" + "=" * 60)
print("步骤6: 删除服务器上的 hermes .whl 下载文件")
print("=" * 60)
code, out, err = exec_cmd("rm -f /opt/lynx/app/public/downloads/hermes_agent-*.whl 2>&1; ls /opt/lynx/app/public/downloads/hermes* 2>&1; echo done")
print(out, err)

print("\n服务器 hermes 卸载完成！")
