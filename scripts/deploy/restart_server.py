"""服务器端部署：解压、替换、PM2 彻底重启、健康检查"""
import sys
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ssh_exec import exec_cmd

steps = [
    # 1. 解压
    ("1. 解压部署包", "tar -xzf /tmp/lynx-deploy-fast.tar.gz -C /tmp/ && ls /tmp/lynx-deploy-fast/"),

    # 2. 备份旧 app + 替换（用 cp -a 复制整个 standalone 目录，包含 .env/.next/.prisma 等隐藏文件）
    ("2. 备份并替换 app", """
set -e
rm -rf /opt/lynx/app_old
mv /opt/lynx/app /opt/lynx/app_old
cp -a /tmp/lynx-deploy-fast/standalone /opt/lynx/app
cp /tmp/lynx-deploy-fast/pm2/ecosystem.config.cjs /opt/lynx/
ls -la /opt/lynx/app/server.js
echo "--- .env ---"
ls -la /opt/lynx/app/.env
echo "--- .next ---"
ls -la /opt/lynx/app/.next/BUILD_ID
echo "--- .prisma ---"
ls -la /opt/lynx/app/.prisma/client/
echo "--- DEV_LOG ---"
ls -la /opt/lynx/app/DEV_LOG.md
"""),

    # 3. PM2 彻底重启（先 delete all 清缓存）
    ("3. PM2 delete all + start", """
pm2 delete all 2>&1 || true
pm2 flush 2>&1 || true
pm2 start /opt/lynx/ecosystem.config.cjs
sleep 3
pm2 list
"""),

    # 4. 健康检查
    ("4. 健康检查", """
sleep 2
echo "--- 内部 health ---"
curl -s -o - -w "\\nHTTP: %{http_code}\\n" http://localhost:5176/api/health
echo "--- 外部 health ---"
curl -s -o - -w "\\nHTTP: %{http_code}\\n" -k https://ai.lynxdo.com/api/health
"""),

    # 5. 验证 lynn 数据
    ("5. 验证 lynn 用户数据", """mysql -u lynx -p$DEPLOY_MYSQL_PASSWORD lynx -e "SELECT COUNT(*) as inbox_count FROM Idea WHERE userId='clynn_user_id_0001' AND status='inbox';" 2>&1 | grep -v Warning"""),

    # 6. 验证 PM2 日志最新状态
    ("6. PM2 最新日志", "pm2 logs lynx-app --nostream --lines 10 --out 2>&1 | tail -15"),
]

for name, cmd in steps:
    print(f"\n{'='*60}\n{name}\n{'='*60}")
    code, out, err = exec_cmd(cmd, timeout=120)
    if code != 0:
        print(f"⚠️ 命令退出码: {code}")
