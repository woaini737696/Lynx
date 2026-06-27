# 端到端验证脚本：登录获取 token + 验证各 API
$ErrorActionPreference = "Continue"

Write-Host "=== 1. 登录获取 token ===" -ForegroundColor Cyan
$body = @{username="admin"; password="admin123"} | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "http://localhost:5176/api/auth/token" -Method Post -ContentType "application/json" -Body $body
$token = $loginRes.token
Write-Host "Token (前 40 字符): $($token.Substring(0, [Math]::Min(40, $token.Length)))..."
Write-Host "User: $($loginRes.user.username) / Role: $($loginRes.user.role)"

$headers = @{Authorization = "Bearer $token"}

Write-Host "`n=== 2. 验证 /api/ai/settings (admin 应看到 larkWebhookToken) ===" -ForegroundColor Cyan
$settings = Invoke-RestMethod -Uri "http://localhost:5176/api/ai/settings" -Method Get -Headers $headers
$hasSensitive = $settings.settings.PSObject.Properties.Name -contains "larkWebhookToken"
Write-Host "admin 可见 larkWebhookToken 字段: $hasSensitive"

Write-Host "`n=== 3. 验证 /api/admin/profession-workspaces (admin 可访问) ===" -ForegroundColor Cyan
$ws = Invoke-RestMethod -Uri "http://localhost:5176/api/admin/profession-workspaces" -Method Get -Headers $headers
Write-Host "工作空间数量: $($ws.workspaces.Count)"
$firstWs = $ws.workspaces[0]
$hasAllowedProviders = $firstWs.PSObject.Properties.Name -contains "allowedProviders"
Write-Host "首个工作空间包含 allowedProviders 字段: $hasAllowedProviders"

Write-Host "`n=== 4. 验证 /api/admin/token-stats (含 users 列表和 byUser 排行) ===" -ForegroundColor Cyan
$stats = Invoke-RestMethod -Uri "http://localhost:5176/api/admin/token-stats" -Method Get -Headers $headers
Write-Host "users 列表数量: $($stats.users.Count)"
Write-Host "byUser 排行数量: $($stats.byUser.Count)"
Write-Host "今日词元: $($stats.summary.today.tokens)"

Write-Host "`n=== 5. 验证 /api/tasks (应有 take 100 上限) ===" -ForegroundColor Cyan
$tasks = Invoke-RestMethod -Uri "http://localhost:5176/api/tasks" -Method Get -Headers $headers
Write-Host "任务数量: $($tasks.tasks.Count) (应 <= 100)"

Write-Host "`n=== 6. 验证 /api/user/ai-keys (用户级 Key 配置) ===" -ForegroundColor Cyan
$aiKeys = Invoke-RestMethod -Uri "http://localhost:5176/api/user/ai-keys" -Method Get -Headers $headers
Write-Host "deepseekKeyConfigured: $($aiKeys.deepseekKeyConfigured)"
Write-Host "mimoKeyConfigured: $($aiKeys.mimoKeyConfigured)"
Write-Host "allowedProviders: $($aiKeys.allowedProviders -join ',')"

Write-Host "`n=== 7. 验证无 token 访问 /api/ai/settings (应 401/307) ===" -ForegroundColor Cyan
try {
  $noAuth = Invoke-WebRequest -Uri "http://localhost:5176/api/ai/settings" -Method Get -UseBasicParsing -ErrorAction Stop
  Write-Host "无 token 状态码: $($noAuth.StatusCode)"
} catch {
  Write-Host "无 token 状态码: $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`n=== 8. 验证 admin 路由守卫 (未登录访问 /admin/users 应重定向) ===" -ForegroundColor Cyan
try {
  $adminRes = Invoke-WebRequest -Uri "http://localhost:5176/admin/users" -Method Get -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
  Write-Host "状态码: $($adminRes.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  $loc = $_.Exception.Response.Headers.Location
  Write-Host "状态码: $sc"
  Write-Host "重定向到: $loc"
}

Write-Host "`n=== 全部端到端验证完成 ===" -ForegroundColor Green
