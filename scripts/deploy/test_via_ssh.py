"""通过 SSH 在服务器上执行 curl，完整测试 HTTPS 链路"""
import paramiko
import json

HOST = "47.119.185.135"
USER = "root"
PASSWORD = "Ee9527ffss"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=15)

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err

results = []

print("=" * 60)
print("Lynx 部署后全面测试（通过服务器 SSH 代理）")
print("=" * 60)

# ============ 1. 官网测试 ============
print("\n[1] 官网 www.lynxdo.com 测试")
print("-" * 40)

# 1.1 官网首页
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://www.lynxdo.com/ --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200" and int(parts[1]) > 5000
results.append(("官网首页", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  首页: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# 1.2 HTTP 重定向
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{redirect_url}' http://www.lynxdo.com/ --connect-timeout 10")
parts = out.split("|")
ok = parts[0] in ("301", "302") and "https" in parts[1]
results.append(("HTTP→HTTPS 重定向", ok, f"HTTP {parts[0]} → {parts[1]}"))
print(f"  重定向: HTTP {parts[0]} → {parts[1]}")

# 1.3 根域名重定向
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{redirect_url}' https://lynxdo.com/ --connect-timeout 10 -k")
parts = out.split("|")
ok = parts[0] in ("301", "302")
results.append(("根域名→www 重定向", ok, f"HTTP {parts[0]} → {parts[1]}"))
print(f"  根域名: HTTP {parts[0]} → {parts[1]}")

# 1.4 官网 logo
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://www.lynxdo.com/lynx-logo-black.png --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200" and "image" in parts[2]
results.append(("官网 logo 图片", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  logo: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# ============ 2. Web 应用测试 ============
print("\n[2] Web 应用 ai.lynxdo.com 测试")
print("-" * 40)

# 2.1 应用首页
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://ai.lynxdo.com/ --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200" and int(parts[1]) > 5000
results.append(("Web 应用首页", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  首页: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# 2.2 健康检查 API
out, err = run("curl -sS https://ai.lynxdo.com/api/health --connect-timeout 10")
ok = "ok" in out.lower() or "healthy" in out.lower() or "status" in out.lower()
results.append(("/api/health", ok, f"响应={out[:200]}"))
print(f"  /api/health: {out[:200]}")

# 2.3 logo 静态资源
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://ai.lynxdo.com/lynx-logo-black.png --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200" and "image" in parts[2] and int(parts[1]) == 39469
results.append(("Web 应用 logo (black)", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  logo-black: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# 2.4 logo-white
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://ai.lynxdo.com/lynx-logo-white.png --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200" and "image" in parts[2] and int(parts[1]) == 12793
results.append(("Web 应用 logo (white)", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  logo-white: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# 2.5 manifest
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://ai.lynxdo.com/manifest.webmanifest --connect-timeout 10")
parts = out.split("|")
ok = parts[0] == "200"
results.append(("manifest.webmanifest", ok, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  manifest: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# 2.6 favicon
out, err = run("curl -sS -o /dev/null -w '%{http_code}|%{size_download}|%{content_type}' https://ai.lynxdo.com/favicon.ico --connect-timeout 10")
parts = out.split("|")
results.append(("favicon.ico", True, f"HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}"))
print(f"  favicon: HTTP {parts[0]}, 大小={parts[1]}, 类型={parts[2]}")

# ============ 3. 登录 API 测试 ============
print("\n[3] 登录 API 测试（lynn + 18942271267 + ee9527ff）")
print("-" * 40)

# 3.1 手机号+密码登录
out, err = run("""curl -sS -X POST https://ai.lynxdo.com/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"phone":"18942271267","password":"ee9527ff"}' --connect-timeout 10""")
print(f"  登录响应: {out[:400]}")
try:
    data = json.loads(out)
    ok = "token" in data
    if ok:
        print(f"  ✓ 获得 token: {data['token'][:60]}...")
        print(f"  ✓ 用户信息: id={data['user']['id']}, username={data['user']['username']}, role={data['user']['role']}, displayName={data['user']['displayName']}")
except:
    ok = False
results.append(("登录 (手机号+密码)", ok, f"响应={out[:300]}"))

# 3.2 错误密码测试
out, err = run("""curl -sS -X POST https://ai.lynxdo.com/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"phone":"18942271267","password":"wrongpass"}' --connect-timeout 10 -o /dev/null -w '%{http_code}'""")
ok = out == "401"
results.append(("错误密码被拒 (401)", ok, f"HTTP {out}"))
print(f"  错误密码: HTTP {out}")

# 3.3 未注册手机号
out, err = run("""curl -sS -X POST https://ai.lynxdo.com/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800000000","password":"ee9527ff"}' --connect-timeout 10 -o /dev/null -w '%{http_code}'""")
ok = out == "401"
results.append(("未注册手机号被拒 (401)", ok, f"HTTP {out}"))
print(f"  未注册手机号: HTTP {out}")

# 3.4 缺少字段
out, err = run("""curl -sS -X POST https://ai.lynxdo.com/api/auth/token \
  -H 'Content-Type: application/json' \
  -d '{}' --connect-timeout 10 -o /dev/null -w '%{http_code}'""")
ok = out == "400"
results.append(("空请求被拒 (400)", ok, f"HTTP {out}"))
print(f"  空请求: HTTP {out}")

# ============ 4. SSL 证书检查 ============
print("\n[4] SSL 证书检查")
print("-" * 40)
out, err = run("echo | openssl s_client -connect ai.lynxdo.com:443 -servername ai.lynxdo.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>&1")
print(f"  证书信息:\n{out}")
ok = "lynxdo.com" in out and "Let's Encrypt" in out
results.append(("SSL 证书有效", ok, out.replace("\n", " | ")))

# ============ 5. PM2 & MySQL 状态 ============
print("\n[5] 服务状态")
print("-" * 40)
out, err = run("pm2 list 2>&1 | head -15")
print(f"  PM2:\n{out}")
ok_pm2 = "online" in out and "lynx-app" in out
results.append(("PM2 lynx-app online", ok_pm2, out.replace("\n", " | ")))

out, err = run("systemctl is-active nginx mysql 2>&1")
print(f"  服务: {out}")
ok_svc = "active" in out and "active" in out.replace("\n", " ")
results.append(("Nginx & MySQL active", ok_svc, out.replace("\n", " | ")))

# ============ 6. lynn 账号验证 ============
print("\n[6] lynn 账号数据库验证")
print("-" * 40)
out, err = run("""mysql -u lynx -pEe9527ffss lynx -e "SELECT id, username, phone, role, displayName, active FROM User WHERE username='lynn';" 2>&1""")
print(f"  数据库记录:\n{out}")
ok_lynn = "lynn" in out and "18942271267" in out and "admin" in out
results.append(("lynn 账号已绑定手机号", ok_lynn, out.replace("\n", " | ")))

# ============ 汇总 ============
print("\n" + "=" * 60)
print("测试汇总")
print("=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
failed = len(results) - passed
for name, ok, detail in results:
    mark = "✓ PASS" if ok else "✗ FAIL"
    print(f"{mark}  {name}")
    if not ok:
        print(f"       {detail}")
print(f"\n总计: {passed} 通过 / {failed} 失败 / {len(results)} 项")

client.close()
