$ErrorActionPreference = "Continue"
$base = "http://localhost:3001"

Write-Host "===== 1. Pages HTTP Test ====="
$pages = @('/', '/board', '/inbox', '/cognition', '/memory', '/graveyard', '/converge', '/assets', '/settings', '/skills', '/skills/market', '/ai/workspace', '/ai/flows', '/ai/assistant', '/ai/lark-tasks')
$pageOk = 0
foreach ($u in $pages) {
  try {
    $r = Invoke-WebRequest -Uri "$base$u" -UseBasicParsing -TimeoutSec 60
    Write-Host "[$($r.StatusCode)] $u"
    if ($r.StatusCode -eq 200) { $pageOk++ }
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[ERR $code] $u"
  }
}
Write-Host "Pages: $pageOk / $($pages.Count) passed"

Write-Host "`n===== 2. API Test ====="
$apis = @('/api/ideas', '/api/tasks', '/api/cognitions', '/api/memory', '/api/graveyard', '/api/focus', '/api/settings', '/api/conversations', '/api/lark-tasks?view=my', '/api/skills', '/api/lark-tasks/sync', '/api/lark-webhook', '/api/lark-webhook/events', '/api/ideas/revive-check')
$apiOk = 0
foreach ($u in $apis) {
  try {
    $r = Invoke-WebRequest -Uri "$base$u" -UseBasicParsing -TimeoutSec 30
    Write-Host "[$($r.StatusCode)] $u"
    if ($r.StatusCode -eq 200) { $apiOk++ }
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[ERR $code] $u"
  }
}
Write-Host "APIs: $apiOk / $($apis.Count) passed"

Write-Host "`n===== 3. CRUD Loop Test ====="

Write-Host "--- 3.1 Skill CREATE ---"
$ts = Get-Date -Format "HHmmss"
$skillBody = "{`"name`":`"[TEST-$ts] Skill`",`"description`":`"test skill for version`",`"category`":`"general`",`"content`":`"# Test Skill v1`",`"parameters`":`"[]`",`"promptTemplate`":`"test prompt v1`"}"
$skillRes = Invoke-WebRequest -Uri "$base/api/skills" -Method POST -Body $skillBody -ContentType "application/json" -UseBasicParsing
$skill = ($skillRes.Content | ConvertFrom-Json).skill
$skillId = $skill.id
Write-Host "Created skill: $skillId"

Write-Host "--- 3.2 Skill UPDATE (creates version snapshot) ---"
$updateBody = "{`"name`":`"[TEST-$ts] Skill v2`",`"description`":`"updated content`",`"content`":`"# Test Skill v2`",`"promptTemplate`":`"test prompt v2`"}"
try {
  $updateRes = Invoke-WebRequest -Uri "$base/api/skills/$skillId" -Method PATCH -Body $updateBody -ContentType "application/json" -UseBasicParsing
  Write-Host "Skill update: $($updateRes.StatusCode)"
} catch { Write-Host "Skill update FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.3 Skill Versions LIST ---"
try {
  $versionsRes = Invoke-WebRequest -Uri "$base/api/skills/$skillId/versions" -UseBasicParsing
  $versions = ($versionsRes.Content | ConvertFrom-Json).versions
  Write-Host "Versions count: $($versions.Count)"
  if ($versions.Count -gt 0) { Write-Host "First version: v$($versions[0].version) - $($versions[0].name)" }
} catch { Write-Host "Versions list FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.4 Skill Rollback ---"
if ($versions.Count -gt 0) {
  $rollbackBody = "{`"version`":$($versions[0].version)}"
  try {
    $rollbackRes = Invoke-WebRequest -Uri "$base/api/skills/$skillId/versions" -Method POST -Body $rollbackBody -ContentType "application/json" -UseBasicParsing
    $rollback = $rollbackRes.Content | ConvertFrom-Json
    Write-Host "Rollback: rolledBackTo=$($rollback.rolledBackTo), backupVersion=$($rollback.backupVersion)"
  } catch { Write-Host "Rollback FAIL: $($_.Exception.Message)" }
}

Write-Host "--- 3.5 Skill Export (batch) ---"
$exportBody = "{`"skillIds`":[`"$skillId`"]}"
try {
  $exportRes = Invoke-WebRequest -Uri "$base/api/skills/export" -Method POST -Body $exportBody -ContentType "application/json" -UseBasicParsing
  Write-Host "Export: $($exportRes.StatusCode), len=$($exportRes.Content.Length)"
} catch { Write-Host "Export FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.6 Skill Share Code ---"
try {
  $shareBody = "{`"skillId`":`"$skillId`"}"
  $shareRes = Invoke-WebRequest -Uri "$base/api/skills/share-code" -Method POST -Body $shareBody -ContentType "application/json" -UseBasicParsing
  $share = $shareRes.Content | ConvertFrom-Json
  Write-Host "Share code: $($share.code)"
} catch { Write-Host "Share code FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.7 Skill DELETE ---"
try {
  $delRes = Invoke-WebRequest -Uri "$base/api/skills/$skillId" -Method DELETE -UseBasicParsing
  Write-Host "Skill delete: $($delRes.StatusCode)"
} catch { Write-Host "Skill delete FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.8 Lark Webhook URL Verification ---"
$webhookBody = '{"type":"url_verification","challenge":"test123","token":"test"}'
try {
  $webhookRes = Invoke-WebRequest -Uri "$base/api/lark-webhook" -Method POST -Body $webhookBody -ContentType "application/json" -UseBasicParsing
  $webhook = $webhookRes.Content | ConvertFrom-Json
  Write-Host "Webhook challenge: $($webhook.challenge)"
} catch { Write-Host "Webhook FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.9 Lark Webhook Events ---"
try {
  $eventsRes = Invoke-WebRequest -Uri "$base/api/lark-webhook/events" -UseBasicParsing
  Write-Host "Events: $($eventsRes.StatusCode)"
} catch { Write-Host "Events FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.10 Revive Check ---"
try {
  $reviveRes = Invoke-WebRequest -Uri "$base/api/ideas/revive-check" -UseBasicParsing -TimeoutSec 15
  $revive = $reviveRes.Content | ConvertFrom-Json
  Write-Host "Revive: mode=$($revive.mode), suggestions=$($revive.total)"
} catch { Write-Host "Revive FAIL: $($_.Exception.Message)" }

Write-Host "--- 3.11 Memory READ ---"
$memList = (Invoke-WebRequest -Uri "$base/api/memory" -UseBasicParsing).Content | ConvertFrom-Json
Write-Host "Memory: $($memList.nodes.Count) nodes, $($memList.edges.Count) edges"

Write-Host "`n===== CRUD Loop Done ====="
