# 代码签名脚本 - 用法: powershell -File scripts\sign-exe.ps1 <exe-path>
param(
    [Parameter(Mandatory=$true)]
    [string]$ExePath
)

$thumbprint = '7BCF15A9E0867DADA9F97DAC69297EAF2672F748'
$cert = Get-ChildItem "Cert:\CurrentUser\My\$thumbprint" -ErrorAction SilentlyContinue

if (-not $cert) {
    Write-Host "[sign] ERROR: 证书未找到 (thumbprint: $thumbprint)"
    exit 1
}

Write-Host "[sign] 使用证书: $($cert.Subject)"
Write-Host "[sign] 签名文件: $ExePath"

$sig = Set-AuthenticodeSignature -FilePath $ExePath -Certificate $cert -HashAlgorithm SHA256 -TimestampServer "http://timestamp.digicert.com"

Write-Host "[sign] 签名状态: $($sig.Status)"
if ($sig.SignerCertificate) {
    Write-Host "[sign] 签名者: $($sig.SignerCertificate.Subject)"
}
if ($sig.Status -ne 'Valid') {
    Write-Host "[sign] WARN: 签名状态非 Valid"
    exit 2
}

Write-Host "[sign] 签名成功!"
