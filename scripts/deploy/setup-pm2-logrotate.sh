#!/bin/bash
# PM2 logrotate 配置脚本
# 在服务器上执行：bash scripts/deploy/setup-pm2-logrotate.sh
#
# 功能：
# 1. 安装 pm2-logrotate 模块
# 2. 配置日志轮转：max_size 50M / retain 14 / compress / 日期格式
# 3. 防止日志文件无限增长导致磁盘满

set -e

echo "========== PM2 Logrotate 配置 =========="

# 1. 安装 pm2-logrotate
echo "[1/4] 安装 pm2-logrotate..."
if pm2 list 2>/dev/null | grep -q "logrotate"; then
  echo "  pm2-logrotate 已安装，跳过"
else
  pm2 install pm2-logrotate
  echo "  pm2-logrotate 安装完成"
fi

# 2. 配置轮转参数
echo "[2/4] 配置日志轮转参数..."
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 300
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

echo "  max_size: 50M"
echo "  retain: 14 (保留14个轮转文件)"
echo "  compress: true (gzip压缩)"
echo "  dateFormat: YYYY-MM-DD_HH-mm-ss"
echo "  rotateInterval: 每日0点轮转"

# 3. 确保日志目录存在
echo "[3/4] 确保日志目录存在..."
mkdir -p /opt/lynx/logs
chown -R root:root /opt/lynx/logs
echo "  /opt/lynx/logs 已就位"

# 4. 验证配置
echo "[4/4] 验证配置..."
pm2 conf pm2-logrotate 2>/dev/null || true

echo ""
echo "========== 配置完成 =========="
echo "日志文件位置："
echo "  lynx-app:        /opt/lynx/logs/out.log + error.log"
echo "  lynx-ws-gateway: /opt/lynx/logs/ws-out.log + ws-error.log"
echo ""
echo "轮转后文件格式：out__YYYY-MM-DD_HH-mm-ss.log.gz"
echo ""
echo "手动触发轮转测试：pm2 call pm2-logrotate:rotate"
