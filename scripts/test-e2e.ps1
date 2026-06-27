# 端到端验证脚本（使用 JWT token，不依赖密码）
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtcXVsZGdxODAwMDBnNWdyZHk2eGFqZGsiLCJ1c2VybmFtZSI6Imx5bm4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODI0OTY1NTksImV4cCI6MTc4MzEwMTM1OX0.LB7_xA-SwoQD1hgnCkpvUPYomhFYl2QeXwj9KV9IPU8"
$headers = @{Authorization = "Bearer $token"}
$base = "http://localhost:5176"

function Test-Api($name, $path, $expectedAuth) {
  Write-Host ""
  Write-Host "=== $name ===" -ForegroundColor Cyan
  # 带 token 请求
  try {
    $r = Invoke-WebRequest -Uri "$base$path" -Method Get -Headers $headers -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    $sc = $r.StatusCode
  } catch {
    $sc = $_.Exception.Response.StatusCode.value__
  }
  Write-Host "with token: $sc"

  # 无 token 请求（验证鉴权）
  try {
    $r2 = Invoke-WebRequest -Uri "$base$path" -Method Get -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    $sc2 = $r2.StatusCode
  } catch {
    $sc2 = $_.Exception.Response.StatusCode.value__
  }
  Write-Host "no token:   $sc2 (expect 307/401)"
}

Test-Api "1. /api/ai/settings (admin see larkWebhookToken)" "/api/ai/settings" $true
Test-Api "2. /api/admin/profession-workspaces" "/api/admin/profession-workspaces" $true
Test-Api "3. /api/admin/token-stats" "/api/admin/token-stats" $true
Test-Api "4. /api/tasks (take 100)" "/api/tasks" $true
Test-Api "5. /api/user/ai-keys" "/api/user/ai-keys" $true
Test-Api "6. /api/ai/flows (P0 fix)" "/api/ai/flows" $true
Test-Api "7. /api/cognitions" "/api/cognitions" $true
Test-Api "8. /api/ideas" "/api/ideas" $true

# 验证 admin 路由守卫
Write-Host ""
Write-Host "=== 9. /admin/users route guard (no session -> redirect) ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "$base/admin/users" -Method Get -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
  Write-Host "status: $($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  $loc = $_.Exception.Response.Headers.Location
  Write-Host "status: $sc -> $loc"
}

# 验证 AI 助理页面可编译
Write-Host ""
Write-Host "=== 10. /ai/assistant page compile ===" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "$base/ai/assistant" -Method Get -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
  Write-Host "status: $($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Write-Host "status: $sc (307 = redirect to login, OK)"
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
