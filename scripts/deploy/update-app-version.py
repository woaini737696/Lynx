#!/usr/bin/env python3
"""更新 nginx app-version 配置为 v1.0.8 + 上传新安装包"""
import paramiko
import os

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=15)

# 1. 查看当前 ai.lynxdo.com 块中的 app-version 配置
_, o, _ = c.exec_command('sed -n "108,125p" /etc/nginx/sites-enabled/lynxdo')
print('当前 app-version 配置:')
print(o.read().decode())

# 2. 替换版本号 1.0.7 → 1.0.8，同时更新 releaseNotes
old_json = '"version":"1.0.7"'
new_json = '"version":"1.0.8"'
old_notes = 'Lynx奇思 v1.0.7: 全局改名+CORS修复+WS连接修复+窗口拖动+托盘Logo+NSIS安装界面'
new_notes = '奇思 v1.0.8: 全局去Lynx改名+下载移动端按钮+Slogan同行展示'

cmd = f"sed -i 's/{old_json}/{new_json}/g; s/{old_notes}/{new_notes}/g' /etc/nginx/sites-enabled/lynxdo"
_, o, _ = c.exec_command(cmd)
o.read()

# 3. 验证修改
_, o, _ = c.exec_command('sed -n "108,125p" /etc/nginx/sites-enabled/lynxdo')
print('更新后 app-version 配置:')
print(o.read().decode())

# 4. 重载 nginx
_, o, _ = c.exec_command('nginx -t && nginx -s reload')
print('nginx reload:', o.read().decode().strip())
err = o.read().decode().strip()
if err:
    print('nginx error:', err)

# 5. 验证 API
_, o, _ = c.exec_command('curl -s -k https://ai.lynxdo.com/api/hermes/app-version')
print('app-version API 返回:', o.read().decode().strip())

# 6. 上传新安装包
local_exe = r'd:\Lynn工作空间\LynnHub\desktop-electron\release\奇思 Setup 1.0.8.exe'
remote_exe = '/opt/lynx/download/Lynx-windows-setup.exe'
print(f'\n上传安装包: {os.path.getsize(local_exe)} bytes')
sftp = c.open_sftp()
sftp.put(local_exe, remote_exe)
print('上传完成')

# 7. 验证文件
_, o, _ = c.exec_command(f'ls -la {remote_exe}')
print('服务器文件:', o.read().decode().strip())

sftp.close()
c.close()
print('\n更新完成!')
