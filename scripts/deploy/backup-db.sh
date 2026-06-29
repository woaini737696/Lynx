#!/bin/bash
# MySQL 每日备份 - 凌晨 3 点执行
# 保留最近 7 天的备份

BACKUP_DIR="/opt/lynx/backup"
DATE=$(date +%Y%m%d)
BACKUP_FILE="$BACKUP_DIR/db-$DATE.sql.gz"

mkdir -p $BACKUP_DIR
mysqldump -u lynx -pEe9527ffss lynx | gzip > $BACKUP_FILE
find $BACKUP_DIR -name "db-*.sql.gz" -mtime +7 -delete
