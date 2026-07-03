#!/usr/bin/env python3
"""验证官网部署后的内容是否正确"""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('47.119.185.135', 22, 'root', 'Ee9527ffss', timeout=15)

# 1. 检查 HTML 标题
_, o, _ = c.exec_command('grep "<title>" /opt/lynx/website/index.html')
title = o.read().decode().strip()
print(f'[TC1] HTML标题: {title}')
tc1_pass = '奇思' in title and 'AI工作台' in title
print(f'      结果: {"PASS" if tc1_pass else "FAIL"}')

# 2. 检查 JS 中是否有 "Lynx Agent" 残留
_, o, _ = c.exec_command('grep -c "Lynx Agent" /opt/lynx/website/assets/index-x-UVAxJ_.js')
lynx_agent_count = o.read().decode().strip()
print(f'[TC2] JS中"Lynx Agent"出现次数: {lynx_agent_count}')
tc2_pass = lynx_agent_count == '0'
print(f'      结果: {"PASS" if tc2_pass else "FAIL"}')

# 3. 检查 JS 中 "奇思" 出现次数
_, o, _ = c.exec_command('grep -o "奇思" /opt/lynx/website/assets/index-x-UVAxJ_.js | wc -l')
qisi_count = o.read().decode().strip()
print(f'[TC3] JS中"奇思"出现次数: {qisi_count}')
tc3_pass = int(qisi_count) > 5
print(f'      结果: {"PASS" if tc3_pass else "FAIL"}')

# 4. 检查 JS 中 "Lynx" 出现（排除URL中的 Lynx-windows-setup.exe 和 Lynx-android.apk 和 Admin/Lynx.git）
_, o, _ = c.exec_command('grep -oP "Lynx(?!-windows-setup|\\.exe|\\.git|-android)" /opt/lynx/website/assets/index-x-UVAxJ_.js | head -10')
lynx_residual = o.read().decode().strip()
print(f'[TC4] JS中非URL的Lynx残留: {lynx_residual if lynx_residual else "无"}')
tc4_pass = not lynx_residual
print(f'      结果: {"PASS" if tc4_pass else "FAIL"}')

# 5. 检查下载移动端按钮是否存在
_, o, _ = c.exec_command('grep -c "Lynx-android.apk" /opt/lynx/website/assets/index-x-UVAxJ_.js')
apk_link_count = o.read().decode().strip()
print(f'[TC5] APK下载链接出现次数: {apk_link_count}')
tc5_pass = int(apk_link_count) >= 2  # Navbar + Features 各一处
print(f'      结果: {"PASS" if tc5_pass else "FAIL"}')

# 6. 检查 VideoModal 文案
_, o, _ = c.exec_command('grep -c "奇思AI工作台产品演示" /opt/lynx/website/assets/index-x-UVAxJ_.js')
video_modal_count = o.read().decode().strip()
print(f'[TC6] "奇思AI工作台产品演示"出现次数: {video_modal_count}')
tc6_pass = int(video_modal_count) >= 1
print(f'      结果: {"PASS" if tc6_pass else "FAIL"}')

# 7. 检查 Slogan 是否在同一行
_, o, _ = c.exec_command('grep -c "不用学AI，什么都能干" /opt/lynx/website/assets/index-x-UVAxJ_.js')
slogan_count = o.read().decode().strip()
print(f'[TC7] Slogan "不用学AI，什么都能干"出现次数: {slogan_count}')
tc7_pass = int(slogan_count) >= 1
print(f'      结果: {"PASS" if tc7_pass else "FAIL"}')

# 8. 检查 app-version API
_, o, _ = c.exec_command('curl -s -k https://ai.lynxdo.com/api/hermes/app-version')
app_version = o.read().decode().strip()
print(f'[TC8] app-version API: {app_version[:200]}')
tc8_pass = 'version' in app_version
print(f'      结果: {"PASS" if tc8_pass else "FAIL"}')

# 9. 检查 APK 文件是否可下载
_, o, _ = c.exec_command('curl -sI -k https://www.lynxdo.com/download/Lynx-android.apk | head -5')
apk_headers = o.read().decode().strip()
print(f'[TC9] APK下载HEAD: {apk_headers}')
tc9_pass = '200' in apk_headers
print(f'      结果: {"PASS" if tc9_pass else "FAIL"}')

# 10. 检查 Footer 文案
_, o, _ = c.exec_command('grep -c "奇思AI工作台" /opt/lynx/website/assets/index-x-UVAxJ_.js')
footer_count = o.read().decode().strip()
print(f'[TC10] "奇思AI工作台"出现次数: {footer_count}')
tc10_pass = int(footer_count) >= 1
print(f'      结果: {"PASS" if tc10_pass else "FAIL"}')

c.close()

# 汇总
results = [tc1_pass, tc2_pass, tc3_pass, tc4_pass, tc5_pass, tc6_pass, tc7_pass, tc8_pass, tc9_pass, tc10_pass]
passed = sum(results)
total = len(results)
print(f'\n===== 自测汇总: {passed}/{total} PASS =====')
if passed < total:
    print('失败项:')
    names = ['TC1-HTML标题', 'TC2-Lynx Agent残留', 'TC3-奇思出现次数', 'TC4-非URL Lynx残留', 'TC5-APK下载链接', 'TC6-VideoModal文案', 'TC7-Slogan', 'TC8-app-version API', 'TC9-APK下载', 'TC10-Footer文案']
    for i, (r, n) in enumerate(zip(results, names)):
        if not r:
            print(f'  - {n}: FAIL')
