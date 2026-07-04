# 彻底清理 Gitee 仓库历史大文件
# 策略：创建 orphan 分支（无历史），用当前工作区作为唯一提交，强制覆盖远程
# 这是最可靠的瘦身方案：远程只剩当前快照，Gitee GC 才能真正回收旧对象
#
# 使用：powershell -ExecutionPolicy Bypass -File scripts\deploy\purge-git-history.ps1
# 前置：所有本地改动已提交，工作区干净

$ErrorActionPreference = "Stop"
Set-Location "D:\Lynn工作空间\LynnHub"

Write-Host "========== Gitee 仓库彻底瘦身 ==========" -ForegroundColor Cyan

# 1. 检查工作区状态
$status = git status --porcelain
if ($status) {
    Write-Host "[ERROR] 工作区不干净，请先提交或 stash：" -ForegroundColor Red
    Write-Host $status
    exit 1
}

# 2. 备份当前分支名
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "[1/8] 当前分支: $currentBranch" -ForegroundColor Yellow

# 3. 记录清理前大小
$beforeSize = (git count-objects -vH | Select-String "size-pack").ToString()
Write-Host "[2/8] 清理前本地仓库: $beforeSize" -ForegroundColor Yellow

# 4. 删除所有本地标签（标签会引用旧历史）
$tags = git tag -l
if ($tags) {
    Write-Host "[3/8] 删除本地标签: $($tags -join ', ')" -ForegroundColor Yellow
    foreach ($t in $tags) { git tag -d $t | Out-Null }
} else {
    Write-Host "[3/8] 无本地标签" -ForegroundColor Yellow
}

# 5. 删除远程所有标签
Write-Host "[4/8] 删除远程所有标签..." -ForegroundColor Yellow
$remoteTags = git ls-remote --tags origin 2>$null
if ($remoteTags) {
    $tagNames = $remoteTags | ForEach-Object { ($_ -split '\s+')[1] -replace 'refs/tags/', '' -replace '\^{}', '' } | Sort-Object -Unique
    foreach ($t in $tagNames) {
        git push origin --delete "refs/tags/$t" 2>$null | Out-Null
        Write-Host "  删除远程标签: $t"
    }
} else {
    Write-Host "  远程无标签"
}

# 6. 创建 orphan 分支（无父提交的全新历史）
Write-Host "[5/8] 创建 orphan 分支 fresh-start..." -ForegroundColor Yellow
git checkout --orphan fresh-start
git rm -rf . 2>$null | Out-Null

# 重新添加所有文件（按 .gitignore 过滤）
git add -A
$commitMsg = "chore: 仓库瘦身重置 - 清除历史大文件（demo-video.mp4/Temp DLL/icns 等）`n`n迭代113: 当前工作区快照`nDate: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMsg

# 7. 删除旧 master，将 fresh-start 重命名为 master
Write-Host "[6/8] 替换 master 分支..." -ForegroundColor Yellow
git branch -D master 2>$null | Out-Null
git branch -m master

# 8. 强制推送到远程（覆盖整个远程历史）
Write-Host "[7/8] 强制推送到 Gitee（覆盖远程全部历史）..." -ForegroundColor Yellow
git push --force origin master

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 推送失败，请检查网络或权限" -ForegroundColor Red
    Write-Host "本地已重置为 master，可通过 git reflog 恢复旧历史" -ForegroundColor Yellow
    exit 1
}

# 9. 本地 GC
Write-Host "[8/8] 本地 GC..." -ForegroundColor Yellow
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git gc --prune=now

$afterSize = (git count-objects -vH | Select-String "size-pack").ToString()
Write-Host ""
Write-Host "========== 清理完成 ==========" -ForegroundColor Green
Write-Host "清理前: $beforeSize"
Write-Host "清理后: $afterSize"
Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "  1. 登录 Gitee → 仓库 → 管理 → 仓库 GC（再次执行）" -ForegroundColor White
Write-Host "  2. 如 GC 后仍 > 200MB，建议删除仓库重建：" -ForegroundColor White
Write-Host "     a. Gitee 新建空仓库 lynn-hub" -ForegroundColor White
Write-Host "     b. git remote set-url origin <新仓库URL>" -ForegroundColor White
Write-Host "     c. git push -u origin master" -ForegroundColor White
Write-Host "  3. GitHub 镜像同步：git push --force github master" -ForegroundColor White
