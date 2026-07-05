# Lynx 本地构建脚本 - 构建产物供服务器部署使用
# 服务器不做任何编译，只接收此脚本产出的打包文件
# 用法：.\scripts\deploy\build.ps1 [-SkipDesktop]

param(
  [switch]$SkipDesktop
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $ProjectRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DistDir = "$ProjectRoot\deploy\dist"
$PkgName = "lynx-deploy-$Timestamp"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lynx 本地构建 (产物用于服务器部署)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "时间戳: $Timestamp"
Write-Host ""

# 1. 清理旧产物
if (Test-Path $DistDir) {
  Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
New-Item -ItemType Directory -Path "$DistDir\$PkgName" -Force | Out-Null

# 2. 安装依赖
Write-Host "[1/6] 检查依赖..." -ForegroundColor Yellow
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npm ci --production=false 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci 失败，尝试 npm install" -ForegroundColor Yellow
  npm install 2>&1 | Write-Host
}
$ErrorActionPreference = $prevEAP

# 3. Prisma generate
Write-Host "[2/7] Prisma generate..." -ForegroundColor Yellow
npx prisma generate 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) { throw "prisma generate 失败" }

# 4. 本地预编译 WS 网关（esbuild 打包成纯 JS，服务器零依赖运行）
Write-Host "[3/7] 预编译 WS 网关 (esbuild -> 纯 JS)..." -ForegroundColor Yellow
# esbuild 的进度信息写到 stderr（正常行为），用 cmd /c 包装避免 PowerShell NativeCommandError 误判
cmd /c "node scripts/compile-ws-gateway.mjs 2>&1"
$compileExit = $LASTEXITCODE
if ($compileExit -ne 0) { throw "ws-gateway 预编译失败 (exit=$compileExit)" }
if (-not (Test-Path "scripts/ws-gateway.compiled.js")) { throw "ws-gateway.compiled.js 未生成" }
Write-Host "  ws-gateway.compiled.js 已生成" -ForegroundColor Green

# 5. Next.js 构建 (standalone)
Write-Host "[4/7] Next.js 构建 (standalone)..." -ForegroundColor Yellow
# Next.js 编译警告写到 stderr，用 cmd /c 包装避免 NativeCommandError 误判
cmd /c "npm run build 2>&1"
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0) { throw "next build 失败 (exit=$buildExit)" }

# 6. 复制 standalone 产物
Write-Host "[5/7] 打包 standalone 产物..." -ForegroundColor Yellow
$StandaloneDir = "$DistDir\$PkgName\standalone"
New-Item -ItemType Directory -Path $StandaloneDir -Force | Out-Null

# 复制 standalone server.js + node_modules
Copy-Item -Recurse "$ProjectRoot\.next\standalone\*" $StandaloneDir

# 手动复制 @prisma/client 和 .prisma/client（Next.js standalone trace 会漏掉，但 WS 网关独立进程需要从 node_modules 解析）
New-Item -ItemType Directory -Path "$StandaloneDir\node_modules\@prisma" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\node_modules\@prisma\client" "$StandaloneDir\node_modules\@prisma\client" -Force
New-Item -ItemType Directory -Path "$StandaloneDir\node_modules\.prisma" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\node_modules\.prisma\client" "$StandaloneDir\node_modules\.prisma\client" -Force
# 同时复制到 app 根目录 .prisma/client（Next.js standalone Prisma bundle 也搜索此路径）
New-Item -ItemType Directory -Path "$StandaloneDir\.prisma\client" -Force | Out-Null
Copy-Item "$ProjectRoot\node_modules\.prisma\client\libquery_engine-debian-openssl-3.0.x.so.node" "$StandaloneDir\.prisma\client\" -Force
Copy-Item "$ProjectRoot\node_modules\.prisma\client\schema.prisma" "$StandaloneDir\.prisma\client\" -Force
Write-Host "  Prisma Client + Linux Engine 已复制到 standalone（node_modules + .prisma/client）" -ForegroundColor Green

# 复制 .next/static（standalone 不含 static，需手动复制）
New-Item -ItemType Directory -Path "$StandaloneDir\.next\static" -Force | Out-Null
Copy-Item -Recurse "$ProjectRoot\.next\static\*" "$StandaloneDir\.next\static"

# 复制 public（合并到 standalone\public，避免嵌套）
if (Test-Path "$ProjectRoot\public") {
  if (Test-Path "$StandaloneDir\public") {
    Copy-Item -Recurse -Force "$ProjectRoot\public\*" "$StandaloneDir\public\"
  } else {
    Copy-Item -Recurse -Force "$ProjectRoot\public" "$StandaloneDir\public"
  }
}

# 复制 prisma schema（服务器端执行 db push 需要）
New-Item -ItemType Directory -Path "$StandaloneDir\prisma" -Force | Out-Null
Copy-Item "$ProjectRoot\prisma\schema.prisma" "$StandaloneDir\prisma\"
if (Test-Path "$ProjectRoot\prisma\seed.ts") {
  Copy-Item "$ProjectRoot\prisma\seed.ts" "$StandaloneDir\prisma\"
}

# 复制预编译的 WS 网关（服务器零依赖运行，不需要 tsx）
New-Item -ItemType Directory -Path "$StandaloneDir\scripts" -Force | Out-Null
Copy-Item "$ProjectRoot\scripts\ws-gateway.compiled.js" "$StandaloneDir\scripts\"
Copy-Item "$ProjectRoot\scripts\start-ws-gateway.js" "$StandaloneDir\scripts\"
Write-Host "  WS 网关预编译产物已复制到 standalone/scripts/" -ForegroundColor Green

# 复制生产环境 .env.production 到 standalone/.env
if (Test-Path "$ProjectRoot\.env.production") {
  Copy-Item "$ProjectRoot\.env.production" "$StandaloneDir\.env"
  Write-Host "  生产环境 .env 已复制到 standalone" -ForegroundColor Green
} else {
  Write-Host "  警告: .env.production 不存在" -ForegroundColor Red
  throw "请先创建 .env.production 文件"
}

# 7. 构建并打包官网 (web_Lynx - Vite + React 项目)
# 官网构建失败不阻塞主应用部署（官网可能已部署，无需每次重建）
Write-Host "[6/7] 构建官网 (web_Lynx)..." -ForegroundColor Yellow
$WebsiteDir = "$ProjectRoot\web_Lynx"
if (Test-Path "$WebsiteDir\package.json") {
  Push-Location $WebsiteDir
  $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  $webEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $webBuildOk = $false
  if ($pnpmCmd) {
    pnpm install --frozen-lockfile 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) { pnpm install 2>&1 | Write-Host }
    pnpm run build 2>&1 | Write-Host
    if ($LASTEXITCODE -eq 0) { $webBuildOk = $true }
  } else {
    npm ci 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) { npm install 2>&1 | Write-Host }
    npm run build 2>&1 | Write-Host
    if ($LASTEXITCODE -eq 0) { $webBuildOk = $true }
  }
  $ErrorActionPreference = $webEAP
  Pop-Location

  if ($webBuildOk -and (Test-Path "$WebsiteDir\dist")) {
    New-Item -ItemType Directory -Path "$DistDir\$PkgName\website" -Force | Out-Null
    Copy-Item -Recurse "$WebsiteDir\dist\*" "$DistDir\$PkgName\website\"
    Write-Host "  官网产物已复制 (web_Lynx/dist)" -ForegroundColor Green
  } else {
    Write-Host "  官网构建失败，跳过（不阻塞主应用部署）" -ForegroundColor Yellow
  }
} else {
  Write-Host "  web_Lynx 目录未找到，跳过官网构建" -ForegroundColor Yellow
}

# 复制服务器配置
New-Item -ItemType Directory -Path "$DistDir\$PkgName\nginx" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\nginx\lynxdo.conf" "$DistDir\$PkgName\nginx\"
New-Item -ItemType Directory -Path "$DistDir\$PkgName\pm2" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\pm2\ecosystem.config.cjs" "$DistDir\$PkgName\pm2\"
New-Item -ItemType Directory -Path "$DistDir\$PkgName\mysql" -Force | Out-Null
Copy-Item "$ProjectRoot\deploy\mysql\lynxdo.cnf" "$DistDir\$PkgName\mysql\"

# 8. 桌面端构建（可选）
# 规格：安装包固定命名「奇思_版本号.exe」，固定输出到 d:\Lynn安装包\，不上传服务器
# 构建后 cargo clean 防止 cargo-target-native 膨胀（10GB+）
if (-not $SkipDesktop) {
  Write-Host "[7/7] 桌面端构建 (Tauri)..." -ForegroundColor Yellow
  $TauriDir = "$ProjectRoot\desktop-native"
  if (Test-Path "$TauriDir\native-ui\package.json") {
    Push-Location "$TauriDir\native-ui"
    cmd /c "npm ci 2>&1"
    cmd /c "npm run build 2>&1"
    Pop-Location
    Push-Location "$TauriDir\src-tauri"
    # 统一 CARGO_TARGET_DIR 避免重复 target 目录膨胀（项目规格）
    # 注意：不设置 CARGO_BUILD_TARGET，本机构建不需要，且会导致 Tauri 打包时找不到二进制文件
    $env:CARGO_TARGET_DIR = "D:\cargo-target-native"
    cmd /c "cargo tauri build 2>&1"
    $tauriExit = $LASTEXITCODE
    Pop-Location
    if ($tauriExit -ne 0) { Write-Host "  Tauri 构建失败 (exit=$tauriExit)" -ForegroundColor Red }

    # 读取 tauri.conf.json 版本号（必须用 UTF-8 编码读取，否则中文乱码导致 ConvertFrom-Json 失败）
    $TauriConf = Get-Content "$TauriDir\src-tauri\tauri.conf.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $DesktopVersion = $TauriConf.version
    $FinalInstallerName = "奇思_$DesktopVersion.exe"
    $InstallerFixedDir = "d:\Lynn安装包"

    $BundleDir = "D:\cargo-target-native\release\bundle"
    $SetupExe = Get-ChildItem "$BundleDir\nsis\*setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($SetupExe) {
      # 代码签名（解决"未知发布者"问题，Windows SmartScreen 据此显示发布者 Lynn）
      # 签名失败不阻塞构建，仅输出警告
      $SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
      $PfxPath = "$TauriDir\src-tauri\lynnhub-code-sign.pfx"
      $PfxPassword = "lynn2026"
      if ((Test-Path $SignTool) -and (Test-Path $PfxPath)) {
        Write-Host "  正在签名安装包（发布者: Lynn）..." -ForegroundColor DarkGray
        cmd /c "`"$SignTool`" sign /f `"$PfxPath`" /p $PfxPassword /tr http://timestamp.digicert.com /td sha256 /fd sha256 `"$($SetupExe.FullName)`" 2>&1"
        if ($LASTEXITCODE -eq 0) {
          Write-Host "  代码签名成功" -ForegroundColor Green
        } else {
          Write-Host "  代码签名失败（错误码: $LASTEXITCODE），继续输出未签名包" -ForegroundColor Yellow
        }
      } else {
        Write-Host "  signtool 或 PFX 证书不存在，跳过签名" -ForegroundColor Yellow
      }

      # 固定目录：d:\Lynn安装包\
      New-Item -ItemType Directory -Path $InstallerFixedDir -Force | Out-Null
      $FinalPath = Join-Path $InstallerFixedDir $FinalInstallerName
      # 如已存在同版本包，覆盖
      Copy-Item $SetupExe.FullName $FinalPath -Force
      Write-Host "  安装包已输出: $FinalPath ($([math]::Round($SetupExe.Length/1MB,2)) MB)" -ForegroundColor Green
      Write-Host "  命名规则: 奇思_版本号.exe（按规格每次客户端改动版本号+0.01）" -ForegroundColor DarkGray

      # 同步复制到项目 downloads 目录（仅用于本地引用，不上传服务器）
      $DownloadsDir = "$ProjectRoot\downloads"
      if (Test-Path $DownloadsDir) {
        Copy-Item $FinalPath "$DownloadsDir\$FinalInstallerName" -Force
      }
    } else {
      Write-Host "  未找到安装包（跳过）" -ForegroundColor Yellow
    }

    # cargo clean 防止 cargo-target-native 膨胀（按项目规格）
    # 仅在构建成功时清理（失败时保留缓存以便增量编译重试）
    if ($tauriExit -eq 0) {
      Write-Host "  执行 cargo clean 清理 Rust 编译缓存..." -ForegroundColor DarkGray
      Push-Location "$TauriDir\src-tauri"
      cmd /c "cargo clean 2>&1"
      Pop-Location
      Write-Host "  cargo clean 完成" -ForegroundColor Green
    } else {
      Write-Host "  Tauri 构建失败，跳过 cargo clean 以便增量重试" -ForegroundColor Yellow
    }
  } else {
    Write-Host "  desktop-native 未找到，跳过桌面端构建" -ForegroundColor Yellow
  }
} else {
  Write-Host "[7/7] 跳过桌面端构建 (-SkipDesktop)" -ForegroundColor Yellow
}

# 9. 打包
Write-Host ""
Write-Host "打包中..." -ForegroundColor Yellow
$ArchivePath = "$DistDir\$PkgName.tar.gz"
tar -czf $ArchivePath -C $DistDir $PkgName
if ($LASTEXITCODE -ne 0) {
  Compress-Archive -Path "$DistDir\$PkgName\*" -DestinationPath "$DistDir\$PkgName.zip" -Force
  $ArchivePath = "$DistDir\$PkgName.zip"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "产物路径: $ArchivePath"
$archiveItem = Get-Item $ArchivePath
$archiveSizeMB = [math]::Round($archiveItem.Length / 1MB, 2)
Write-Host "产物大小: $archiveSizeMB MB"
Write-Host ""
Write-Host "下一步: 部署到服务器" -ForegroundColor Cyan
Write-Host ""
