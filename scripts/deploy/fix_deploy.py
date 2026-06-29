"""紧急修复：用 cp -a 正确复制 standalone 目录（包含隐藏文件）+ 重启 + 验证"""
import sys
sys.path.insert(0, r"d:\Lynn工作空间\LynnHub\scripts\deploy")
from ssh_exec import exec_cmd

steps = [
    # 1. 用 cp -a 正确复制（包含 .env .next .prisma 等隐藏文件）
    ("1. 用 cp -a 正确复制 standalone", """
set -e
rm -rf /opt/lynx/app_old
mv /opt/lynx/app /opt/lynx/app_old
cp -a /tmp/lynx-deploy-fast/standalone /opt/lynx/app
ls -la /opt/lynx/app/.env /opt/lynx/app/.next /opt/lynx/app/.prisma 2>&1
echo "--- server.js ---"
ls -la /opt/lynx/app/server.js
echo "--- DEV_LOG.md ---"
ls -la /opt/lynx/app/DEV_LOG.md
"""),

    # 2. PM2 彻底重启
    ("2. PM2 彻底重启", """
pm2 delete all 2>&1 || true
pm2 flush 2>&1 || true
pm2 start /opt/lynx/ecosystem.config.cjs
sleep 5
pm2 list
"""),

    # 3. 健康检查
    ("3. 健康检查", """
sleep 3
echo "--- 内部 health ---"
curl -s -o - -w "\\nHTTP: %{http_code}\\n" http://localhost:5176/api/health
echo "--- 外部 health ---"
curl -s -o /dev/null -w "HTTP: %{http_code}\\n" -k https://ai.lynxdo.com/api/health
"""),

    # 4. 验证 PM2 错误日志
    ("4. PM2 错误日志（应无错误）", "pm2 logs lynx-app --nostream --lines 15 --err 2>&1 | tail -20"),

    # 5. 验证 .env 中 AUTH_URL
    ("5. 验证 .env 中 AUTH_URL", "grep AUTH_URL /opt/lynx/app/.env"),

    # 6. 验证部署的前端代码
    ("6. 验证部署的前端代码", """
echo "--- inbox page.js 存在 ---"
ls -la /opt/lynx/app/.next/server/app/inbox/page.js
echo "--- chunks 中 HermesAgent 提示 ---"
grep -l 'HermesAgent' /opt/lynx/app/.next/server/chunks/*.js 2>&1 | head -3
"""),

    # 7. 测试 API（无认证应返回 401，不是 500）
    ("7. 测试 API 响应", """
echo "--- /api/ideas ---"
curl -s -o /dev/null -w "HTTP: %{http_code}" http://localhost:5176/api/ideas
echo ""
echo "--- /api/dev-log ---"
curl -s -o /dev/null -w "HTTP: %{http_code}" http://localhost:5176/api/dev-log
echo ""
echo "--- /api/hermes/install ---"
curl -s -o /dev/null -w "HTTP: %{http_code}" http://localhost:5176/api/hermes/install
echo ""
"""),
]

for name, cmd in steps:
    print(f"\n{'='*60}\n{name}\n{'='*60}")
    code, out, err = exec_cmd(cmd, timeout=120)
    if code != 0:
        print(f"⚠️ 退出码: {code}")
