-- 自测专用临时用户，可在测试后删除
-- 手机号: 13800000001  密码: Test1234!
INSERT INTO User (id, username, phone, passwordHash, displayName, role, active, profession, source, permissionVersion, createdAt, updatedAt)
VALUES ('selftest_tmp', 'selftest', '13800000001', '$2b$10$RhL.yNeg5GmVKHDMnfUndOEcZ.9JKznMt0Q/RsAPQiowFaJdOy3Ya', '自测用户', 'admin', 1, NULL, 'admin_create', 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE phone='13800000001', passwordHash='$2b$10$RhL.yNeg5GmVKHDMnfUndOEcZ.9JKznMt0Q/RsAPQiowFaJdOy3Ya', active=1;
