-- C 端用户管理模块 schema 变更（迭代86）
-- 通过 mysql CLI 直接执行，避免在服务器安装 prisma CLI
-- 幂等设计：通过 information_schema 检查后再 ALTER/CREATE
-- 兼容 MySQL 8.0.46（不支持 ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS）

-- ========== 1. User 表新增 source / lastLoginAt / registerIp ==========

-- 1.1 source 字段
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'source');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `User` ADD COLUMN `source` VARCHAR(32) NOT NULL DEFAULT 'admin_create' COMMENT 'self_register | admin_create：用户来源'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 lastLoginAt 字段
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'lastLoginAt');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `User` ADD COLUMN `lastLoginAt` DATETIME(3) NULL COMMENT '最后登录时间'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 registerIp 字段
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME = 'registerIp');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE `User` ADD COLUMN `registerIp` VARCHAR(64) NULL COMMENT '注册时 IP'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 2. LoginLog 表 ==========
SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LoginLog');
SET @sql = IF(@tbl_exists = 0,
  "CREATE TABLE `LoginLog` (
    `id` VARCHAR(128) NOT NULL,
    `userId` VARCHAR(128) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `loginAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.1 索引：按用户+时间查询
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LoginLog' AND INDEX_NAME = 'LoginLog_userId_loginAt_idx');
SET @sql = IF(@idx_exists = 0,
  "CREATE INDEX `LoginLog_userId_loginAt_idx` ON `LoginLog`(`userId`, `loginAt`)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.2 索引：按时间查询
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LoginLog' AND INDEX_NAME = 'LoginLog_loginAt_idx');
SET @sql = IF(@idx_exists = 0,
  "CREATE INDEX `LoginLog_loginAt_idx` ON `LoginLog`(`loginAt`)",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.3 外键：LoginLog.userId -> User.id（ON DELETE CASCADE）
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'LoginLog' AND CONSTRAINT_NAME = 'LoginLog_userId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists = 0,
  "ALTER TABLE `LoginLog` ADD CONSTRAINT `LoginLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
