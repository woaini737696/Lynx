"""检查服务器端 /api/ai/chat 日志和测试端点"""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=10)

# 1. 检查 /api/ai/chat 最近的日志
_, o, _ = c.exec_command('pm2 logs lynx-app --lines 50 --nostream 2>&1 | grep -i "ai/chat\\|assistantMode\\|error" | tail -20')
print("=== /api/ai/chat 相关日志 ===")
print(o.read().decode() or "(无相关日志)")

# 2. 测试 /api/ai/chat 端点（无 token，应返回 401）
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" -X POST https://ai.lynxdo.com/api/ai/chat -H "Content-Type: application/json" -d \'{"messages":[{"role":"user","content":"test"}],"stream":true,"assistantMode":true}\'')
print(f"\n=== /api/ai/chat 无 token 测试 ===")
print(f"HTTP状态: {o.read().decode()}")

# 3. 检查 CORS 配置（模拟 Electron origin）
_, o, _ = c.exec_command('curl -s -i -X OPTIONS -H "Origin: file://" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type,Authorization" https://ai.lynxdo.com/api/ai/chat 2>&1 | head -15')
print(f"\n=== CORS 测试 (file:// origin) ===")
print(o.read().decode())

# 4. 检查 middleware 中的 CORS 配置
_, o, _ = c.exec_command('grep -n "ALLOWED_ORIGINS\\|tauri.localhost\\|file://" /opt/lynx/app/.next/server/middleware.js 2>/dev/null | head -5 || echo "middleware not found or no match"')
print(f"\n=== middleware CORS 检查 ===")
print(o.read().decode())

c.close()
