"""修复 nginx WS 代理配置 + 清理崩溃的 PM2 进程"""
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

# 1. 修改 nginx 配置：proxy_pass 3001 → 5176
cmd = "sed -i 's|proxy_pass http://127.0.0.1:3001|proxy_pass http://127.0.0.1:5176|g' /etc/nginx/sites-available/lynxdo"
_, o, e = c.exec_command(cmd)
print("sed:", o.read().decode(), e.read().decode())

# 2. 测试 nginx 配置
_, o, _ = c.exec_command('nginx -t 2>&1')
print("nginx -t:", o.read().decode())

# 3. 重载 nginx
_, o, _ = c.exec_command('systemctl reload nginx 2>&1')
print("nginx reload:", o.read().decode() or "OK")

# 4. 删除崩溃的 lynx-ws-gateway PM2 进程
_, o, _ = c.exec_command('pm2 delete lynx-ws-gateway 2>&1 && pm2 save 2>&1')
print("pm2 delete:", o.read().decode())

# 5. 验证 WS upgrade 测试
_, o, _ = c.exec_command(
    'curl -s -o /dev/null -w "%{http_code}" '
    '-H "Connection: Upgrade" -H "Upgrade: websocket" '
    '-H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" '
    'https://ai.lynxdo.com/api/ws/agent'
)
print(f"\nWS upgrade 测试: HTTP {o.read().decode()}")

# 6. 验证官网
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://www.lynxdo.com/')
print(f"官网首页: HTTP {o.read().decode()}")

# 7. 验证 AI 应用
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://ai.lynxdo.com/api/health')
print(f"AI应用健康: HTTP {o.read().decode()}")

c.close()
