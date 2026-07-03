#!/usr/bin/env python3
"""部署官网 dist 到服务器"""
import paramiko
import os
import stat

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=15)

# 1. 找官网部署目录
_, o, _ = c.exec_command('grep -B2 -A5 "www.lynxdo.com" /etc/nginx/sites-enabled/lynxdo | grep root')
root_line = o.read().decode().strip()
print('官网 root 配置:', root_line)

# 提取路径
import re
m = re.search(r'root\s+(\S+);', root_line)
if not m:
    # 尝试另一种方式
    _, o, _ = c.exec_command('grep -A20 "server_name www.lynxdo.com" /etc/nginx/sites-enabled/lynxdo | grep root | head -1')
    root_line = o.read().decode().strip()
    print('官网 root (v2):', root_line)
    m = re.search(r'root\s+(\S+);', root_line)

if m:
    web_root = m.group(1)
    print(f'官网部署目录: {web_root}')
else:
    print('未找到官网 root 目录，尝试 /var/www/lynxdo')
    web_root = '/var/www/lynxdo'

# 2. 上传 dist 目录
local_dist = r'd:\Lynn工作空间\LynnHub\web_Lynx\dist'
if not os.path.exists(local_dist):
    print(f'本地 dist 不存在: {local_dist}')
    c.close()
    exit(1)

sftp = c.open_sftp()

# 确保远程目录存在
try:
    sftp.stat(web_root)
except FileNotFoundError:
    c.exec_command(f'mkdir -p {web_root}')

# 清空旧文件
c.exec_command(f'rm -rf {web_root}/*')

def upload_dir(local, remote):
    count = 0
    for item in os.listdir(local):
        local_path = os.path.join(local, item)
        remote_path = remote + '/' + item
        if os.path.isfile(local_path):
            sftp.put(local_path, remote_path)
            count += 1
        elif os.path.isdir(local_path):
            try:
                sftp.mkdir(remote_path)
            except:
                pass
            count += upload_dir(local_path, remote_path)
    return count

file_count = upload_dir(local_dist, web_root)
print(f'上传 {file_count} 个文件到 {web_root}')

sftp.close()

# 3. 验证
_, o, _ = c.exec_command(f'ls -la {web_root}/')
print('部署结果:', o.read().decode()[:300])

c.close()
print('官网部署完成')
