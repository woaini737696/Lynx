# 验证 build/ 目录下所有 NSIS 资源
$buildDir = Join-Path $PSScriptRoot "..\build"
Write-Host "=== build/ 目录资源验证 ==="
Write-Host ""

# icon.ico
$icon = Join-Path $buildDir "icon.ico"
if (Test-Path $icon) {
    $size = (Get-Item $icon).Length
    Write-Host "[OK]  icon.ico: $size bytes"
} else {
    Write-Host "[ERR] icon.ico 缺失"
}

# license.txt - BOM 校验
$license = Join-Path $buildDir "license.txt"
if (Test-Path $license) {
    $bytes = [System.IO.File]::ReadAllBytes($license)
    $bom = ""
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bom = "UTF-8 BOM (PASS)"
    } else {
        $bom = "无 BOM (NSIS 中文显示会乱码)"
    }
    Write-Host "[OK]  license.txt: $($bytes.Length) bytes, $bom"
    # 显示前 200 字符（去掉 BOM）
    $text = [System.Text.Encoding]::UTF8.GetString($bytes[3..([Math]::Min(200, $bytes.Length-1))])
    Write-Host "      内容预览: $($text.Substring(0, [Math]::Min(100, $text.Length)))..."
} else {
    Write-Host "[ERR] license.txt 缺失"
}

# installer-header.bmp
$header = Join-Path $buildDir "installer-header.bmp"
if (Test-Path $header) {
    $bytes = [System.IO.File]::ReadAllBytes($header)
    # BMP 头校验：前2字节 "BM"
    $isBmp = ($bytes[0] -eq 0x42 -and $bytes[1] -eq 0x4D)
    # 读取 BITMAPINFOHEADER（偏移14开始，4字节宽高）
    $width  = [BitConverter]::ToInt32($bytes, 18)
    $height = [BitConverter]::ToInt32($bytes, 22)
    $bpp    = [BitConverter]::ToInt16($bytes, 28)
    Write-Host "[OK]  installer-header.bmp: $($bytes.Length) bytes, ${width}x${height}, $bpp bpp, BMP=$isBmp"
} else {
    Write-Host "[ERR] installer-header.bmp 缺失"
}

# installer-sidebar.bmp
$side = Join-Path $buildDir "installer-sidebar.bmp"
if (Test-Path $side) {
    $bytes = [System.IO.File]::ReadAllBytes($side)
    $isBmp = ($bytes[0] -eq 0x42 -and $bytes[1] -eq 0x4D)
    $width  = [BitConverter]::ToInt32($bytes, 18)
    $height = [BitConverter]::ToInt32($bytes, 22)
    $bpp    = [BitConverter]::ToInt16($bytes, 28)
    Write-Host "[OK]  installer-sidebar.bmp: $($bytes.Length) bytes, ${width}x${height}, $bpp bpp, BMP=$isBmp"
} else {
    Write-Host "[ERR] installer-sidebar.bmp 缺失"
}
