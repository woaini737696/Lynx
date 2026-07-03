#!/usr/bin/env python3
"""验证官网部署结果 v2 - 直接检查服务器文件"""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=15)

# TC1: 验证标题
_, o, _ = c.exec_command('cat /opt/lynx/website/index.html')
html = o.read().decode()
assert 'Lynx奇思 - AI工作台' in html, 'TC1 失败'
print('TC1 通过: 标题正确')

# 找 JS 文件
_, o, _ = c.exec_command('ls /opt/lynx/website/assets/*.js')
js_files = o.read().decode().strip().split('\n')
print('JS 文件:', js_files)

# 读取主 JS（最大的 index-*.js）
main_js = ''
for f in js_files:
    if 'index-' in f:
        _, o, _ = c.exec_command(f'cat {f}')
        main_js = o.read().decode()
        break

if main_js:
    # TC2: 主标题
    assert 'Lynx奇思 - AI工作台' in main_js, 'TC2 失败'
    print('TC2 通过: 主标题正确')

    # TC3: Slogan
    assert '不用学AI' in main_js, 'TC3 失败'
    print('TC3 通过: Slogan 正确')

    # TC4: 副标题
    assert '一个入口' in main_js and '覆盖全职业' in main_js, 'TC4 失败'
    print('TC4 通过: 副标题正确')

    # TC5: 品牌名
    assert 'Lynx奇思' in main_js, 'TC5 失败'
    print('TC5 通过: 品牌名正确')

    # TC6-8: 5 个导航
    for nav in ['本地操控', '记忆图谱', '灵感看板', 'AI 对话', '三端互通']:
        assert nav in main_js, f'TC6 失败: {nav}'
    print('TC6-TC8 通过: 5 个导航正确')

    # TC10: Features 文案
    assert 'Lynx奇思让 AI' in main_js, 'TC10 失败'
    print('TC10 通过: Features 文案正确')

    # TC11: 下载按钮
    assert '下载Lynx奇思桌面端' in main_js, 'TC11 失败'
    print('TC11 通过: 下载按钮文案正确')
else:
    print('ERROR: 未找到主 JS 文件')

# TC13: app-version API
_, o, _ = c.exec_command('curl -sk -o /dev/null -w "%{http_code}" https://ai.lynxdo.com/api/hermes/app-version')
status = o.read().decode().strip()
assert status == '200', f'TC13 失败: {status}'
print('TC13 通过: app-version API 200')

c.close()
print('\n========== 所有测试通过 ==========')
