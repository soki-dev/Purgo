$ErrorActionPreference = 'Stop'

$certDir = Join-Path $PSScriptRoot '..\build\cert'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Purgo Dev" -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(3)

$password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$securePw = ConvertTo-SecureString -String $password -Force -AsPlainText

$pfxPath = Join-Path $certDir 'purgo-selfsigned.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePw | Out-Null
Set-Content -Path (Join-Path $certDir 'cert-password.txt') -Value $password -NoNewline

Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "Zertifikat erstellt: $pfxPath"
Write-Host "Passwort gespeichert in: $(Join-Path $certDir 'cert-password.txt')"
Write-Host "WICHTIG: Selbstsigniert - Windows SmartScreen vertraut dem NICHT automatisch. Nur fuer lokale Signier-Tests."
