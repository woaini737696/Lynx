"""检查服务器 WS 网关端口和进程状态"""
import paramiko
import sys
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config

_ssh = get_ssh_config()
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(_ssh["host"], 22, _ssh["user"], _ssh["password"], timeout=10)

# 1. 检查端口监听
_, o, _ = c.exec_command('ss -tlnp | grep -E "3001|5176"')
print("=== 端口监听 ===")
print(o.read().decode())

# 2. 检查 ws-gateway 进程日志
_, o, _ = c.exec_command('pm2 logs lynx-ws-gateway --lines 15 --nostream 2>&1 | tail -20')
print("=== ws-gateway 日志 ===")
print(o.read().decode())

# 3. 测试 WS upgrade 请求
_, o, _ = c.exec_command(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Connection: Upgrade" -H "Upgrade: websocket" '
    '-H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" '
    'https://ai.lynxdo.com/api/ws/agent'
)
print("=== WS upgrade 测试 ===")
print(f"HTTP状态: {o.read().decode()}")

# 4. 检查 lynx-app 是否在 5176 端口处理 WS
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5176/api/ws/agent')
print(f"\n=== 5176 端口 WS 测试 ===")
print(f"HTTP状态: {o.read().decode()}")

c.close()
