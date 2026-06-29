"""端到端验证：1.直接查询数据库验证数据存在 2.模拟登录获取session 3.带cookie调用API"""
import sys
sys.path.insert(0, r"d:\Lynn工作空间\LynnHub\scripts\deploy")
from ssh_exec import exec_cmd

# Step 1: 直接用 MySQL 客户端查询数据是否存在
step1 = r"""
echo "=== Step 1: 直接查询数据库验证数据 ==="
# 尝试用 mysql 客户端
which mysql 2>&1 && echo "mysql client found" || echo "no mysql client"
# 尝试用 node + prisma
cd /opt/lynx/app
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const ideas = await p.idea.count();
    const tasks = await p.task.count();
    const users = await p.user.count();
    const devLogs = await p.devLog.count();
    const configs = await p.systemConfig.count();
    console.log('DB OK: ideas=' + ideas + ' tasks=' + tasks + ' users=' + users + ' devLogs=' + devLogs + ' configs=' + configs);
    // 查看最近的5条idea
    const recentIdeas = await p.idea.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, createdAt: true } });
    console.log('Recent ideas:', JSON.stringify(recentIdeas, null, 2));
    // 查看 lynn 用户
    const lynn = await p.user.findFirst({ where: { username: 'lynn' }, select: { id: true, username: true, role: true, active: true, phone: true } });
    console.log('Lynn user:', JSON.stringify(lynn));
    // 查看万能验证码配置
    const mc = await p.systemConfig.findUnique({ where: { key: 'master_code' } });
    const mce = await p.systemConfig.findUnique({ where: { key: 'master_code_enabled' } });
    console.log('master_code:', mc ? mc.value : 'NOT SET');
    console.log('master_code_enabled:', mce ? mce.value : 'NOT SET');
  } catch(e) {
    console.error('DB ERROR:', e.message);
  } finally {
    await p.\$disconnect();
  }
})();
" 2>&1
"""

# Step 2: 模拟登录获取 session cookie
step2 = r"""
echo ""
echo "=== Step 2: 模拟登录获取 session cookie ==="
cd /tmp
rm -f cookies.txt
# 获取 CSRF token
CSRF_RESP=$(curl -s -c cookies.txt -b cookies.txt http://localhost:5176/api/auth/csrf)
echo "CSRF response: $CSRF_RESP"
CSRF_TOKEN=$(echo "$CSRF_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).csrfToken)}catch(e){console.log('')}})")
echo "CSRF token: $CSRF_TOKEN"

# 用万能验证码登录（如果启用了）
if [ -n "$CSRF_TOKEN" ]; then
  LOGIN_RESP=$(curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:5176/api/auth/callback/credentials \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "phone=18942271267&code=888888&csrfToken=$CSRF_TOKEN&callbackUrl=http://localhost:5176/api/auth/session" \
    -o /dev/null -w "HTTP:%{http_code} redirect:%{redirect_url}")
  echo "Login response: $LOGIN_RESP"

  # 检查 session
  SESSION_RESP=$(curl -s -b cookies.txt http://localhost:5176/api/auth/session)
  echo "Session: $SESSION_RESP"
fi
"""

# Step 3: 带 cookie 调用关键 API
step3 = r"""
echo ""
echo "=== Step 3: 带 cookie 调用关键 API ==="
if [ -f /tmp/cookies.txt ]; then
  echo "--- /api/ideas ---"
  curl -s -b /tmp/cookies.txt http://localhost:5176/api/ideas | head -c 500
  echo ""
  echo "--- /api/tasks ---"
  curl -s -b /tmp/cookies.txt http://localhost:5176/api/tasks | head -c 500
  echo ""
  echo "--- /api/dev-log ---"
  curl -s -b /tmp/cookies.txt http://localhost:5176/api/dev-log | head -c 500
  echo ""
  echo "--- /api/hermes/status ---"
  curl -s -b /tmp/cookies.txt http://localhost:5176/api/hermes/status | head -c 500
  echo ""
else
  echo "No cookies file, login may have failed"
fi
rm -f /tmp/cookies.txt
"""

for name, cmd in [("Step1-DB", step1), ("Step2-Login", step2), ("Step3-API", step3)]:
    print(f"\n{'='*60}\n{name}\n{'='*60}")
    code, out, err = exec_cmd(cmd, timeout=60)
    print(out)
    if err:
        print("STDERR:", err)
    if code != 0:
        print(f"⚠️ 退出码: {code}")
