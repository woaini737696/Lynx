#!/usr/bin/env python3
"""
修复 nginx app-version location：从 www.lynxdo.com 块移到 ai.lynxdo.com 块
Electron 请求 https://ai.lynxdo.com/api/hermes/app-version
"""
import paramiko

APP_VERSION_JSON = '{"version":"1.0.7","downloadUrl":"https://www.lynxdo.com/download/Lynx-windows-setup.exe","releaseNotes":"Lynx奇思 v1.0.7: 全局改名+CORS修复+WS连接修复+窗口拖动+托盘Logo+NSIS安装界面"}'

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=15)

# 1. 读取当前 nginx 配置
_, o, _ = c.exec_command('cat /etc/nginx/sites-enabled/lynxdo')
config = o.read().decode()

# 2. 移除 www.lynxdo.com 块中的错误 app-version location
old_block = '''location = /api/hermes/app-version {
            default_type application/json;
            return 200 \'''' + APP_VERSION_JSON + '''\';
        }

        location /api/hermes/latest-json'''
new_block = 'location /api/hermes/latest-json'
config = config.replace(old_block, new_block)

# 3. 在 ai.lynxdo.com server 块中添加 app-version location
# 找到 ai.lynxdo.com 块的第一个 location，在其前添加
ai_marker = 'server_name ai.lynxdo.com 47.119.185.135;'
if ai_marker in config:
    app_version_location = '''
        # Electron 检查更新：公开接口，nginx 直接返回 JSON，不经过 Next.js middleware
        location = /api/hermes/app-version {
            default_type application/json;
            return 200 \'''' + APP_VERSION_JSON + '''\';
        }
'''
    # 在 ai.lynxdo.com server 块的 ssl 配置后添加
    ssl_end = "ssl_session_timeout 1d;"
    if ssl_end in config:
        config = config.replace(ssl_end, ssl_end + "\n" + app_version_location, 1)
    else:
        # 找到 ai.lynxdo.com 后的第一个 location，在其前添加
        idx = config.find(ai_marker)
        next_location = config.find('location', idx + len(ai_marker))
        if next_location > 0:
            config = config[:next_location] + app_version_location.lstrip() + "\n        " + config[next_location:]

# 4. 写入新配置
sftp = c.open_sftp()
with sftp.open('/tmp/lynxdo-fix', 'w') as f:
    f.write(config)
sftp.close()

# 5. 备份并替换
c.exec_command('mkdir -p /opt/lynx/backup/nginx')
c.exec_command('cp /etc/nginx/sites-enabled/lynxdo /opt/lynx/backup/nginx/lynxdo.bak-109-v2')
c.exec_command('cp /tmp/lynxdo-fix /etc/nginx/sites-enabled/lynxdo')

# 6. 测试 nginx 配置
_, o, e = c.exec_command('nginx -t 2>&1')
test_result = o.read().decode() + e.read().decode()
print('nginx -t:', test_result.strip())

if 'syntax is ok' in test_result and 'test is successful' in test_result:
    _, o, _ = c.exec_command('nginx -s reload 2>&1')
    print('nginx reload:', o.read().decode().strip() or 'OK')

    import time
    time.sleep(1)

    # 验证
    _, o, _ = c.exec_command('grep -n "app-version" /etc/nginx/sites-enabled/lynxdo')
    print('app-version 位置:', o.read().decode().strip())

    _, o, _ = c.exec_command('curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1/api/hermes/app-version -H "Host: ai.lynxdo.com"')
    print('HTTPS 状态:', o.read().decode().strip())

    _, o, _ = c.exec_command('curl -sk https://127.0.0.1/api/hermes/app-version -H "Host: ai.lynxdo.com"')
    print('响应:', o.read().decode().strip()[:200])
else:
    c.exec_command('cp /opt/lynx/backup/nginx/lynxdo.bak-109-v2 /etc/nginx/sites-enabled/lynxdo')
    print('配置测试失败，已回滚')

c.close()
