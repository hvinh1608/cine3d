#Requires -Version 5.1
# Fix cloudflared Windows service config for LocalSystem account.

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$($MyInvocation.MyCommand.Path)`""
  ) | Out-Null
  exit 0
}

$Root = "D:\duan\cine3d"
$UserCf = Join-Path $env:USERPROFILE ".cloudflared"
$SystemCf = "C:\Windows\System32\config\systemprofile\.cloudflared"
$SrcConfig = Join-Path $Root "deploy\home\config.yml"

if (-not (Test-Path $SystemCf)) {
  New-Item -ItemType Directory -Path $SystemCf -Force | Out-Null
}

# Copy tunnel credentials + cert from user profile
Copy-Item (Join-Path $UserCf "*") $SystemCf -Force
# Ensure latest ingress config
Copy-Item $SrcConfig (Join-Path $SystemCf "config.yml") -Force

# Point credentials-file to System profile path inside config
$systemConfig = Join-Path $SystemCf "config.yml"
$credName = (Get-ChildItem $SystemCf -Filter "*.json" | Select-Object -First 1).Name
$credPath = Join-Path $SystemCf $credName
$content = Get-Content $systemConfig -Raw
$content = $content -replace "credentials-file:\s*.+", ("credentials-file: " + $credPath.Replace('\', '\\'))
# Actually YAML wants single backslashes or forward slashes - use forward slashes
$credYaml = $credPath -replace '\\', '/'
$content = (Get-Content $SrcConfig -Raw) -replace "(?m)^credentials-file:\s*.+$", "credentials-file: $credYaml"
Set-Content -Path $systemConfig -Value $content -Encoding UTF8

Write-Host "System config:"
Get-Content $systemConfig
Write-Host "---"
Get-ChildItem $SystemCf | Format-Table Name, Length

# Stop manual tunnels
Get-Process cloudflared -ErrorAction SilentlyContinue | Where-Object { $_.Path -notmatch 'nothing' } | ForEach-Object {
  # Keep service process; kill only non-service if possible. Safer: restart service which reconnects.
}

Restart-Service cloudflared -Force
Start-Sleep -Seconds 5
Get-Service cloudflared | Format-List Name, Status, StartType

try {
  $h = Invoke-RestMethod "https://api.cine3d.id.vn/health" -TimeoutSec 20
  Write-Host ("Public API OK: " + ($h | ConvertTo-Json -Compress))
} catch {
  Write-Host ("Public API still failing: " + $_.Exception.Message)
  Write-Host "Check Event Viewer Application logs for Cloudflared."
}

Write-Host "Done. Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
