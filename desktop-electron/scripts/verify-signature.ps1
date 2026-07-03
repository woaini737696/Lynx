param(
    [string]$ExePath
)
if (-not (Test-Path $ExePath)) {
    Write-Host "[verify] NOT FOUND: $ExePath"
    exit 1
}
$s = Get-AuthenticodeSignature -FilePath $ExePath
Write-Host "Path      : $ExePath"
Write-Host "Size(MB)  : $([math]::Round((Get-Item $ExePath).Length/1MB, 2))"
Write-Host "Status    : $($s.Status)"
Write-Host "Signer    : $($s.SignerCertificate.Subject)"
Write-Host "Issuer    : $($s.SignerCertificate.Issuer)"
Write-Host "Thumbprint: $($s.SignerCertificate.Thumbprint)"
Write-Host "NotBefore : $($s.SignerCertificate.NotBefore)"
Write-Host "NotAfter  : $($s.SignerCertificate.NotAfter)"
