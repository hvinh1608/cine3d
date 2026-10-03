#Requires -Version 5.1
# Auto-start Cloudflare Tunnel at Windows logon (Task Scheduler).
# Preferred for home PC — no LocalSystem credential issues.

$ErrorActionPreference = "Stop"
$Config = "D:\duan\cine3d\deploy\home\config.yml"
$Creds = "D:\duan\cine3d\deploy\home\tunnel-credentials.json"
$UserCreds = Join-Path $env:USERPROFILE ".cloudflared\b7b7a85f-6ff0-4a33-9b0b-dafb3ce585c2.json"
$TaskName = "CINE3D-Cloudflare-Tunnel"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "Chua cai cloudflared. winget install --id Cloudflare.cloudflared"
}
if (-not (Test-Path $Config)) { throw "Thieu $Config" }
if (-not (Test-Path $Creds) -and (Test-Path $UserCreds)) {
  Copy-Item $UserCreds $Creds -Force
}
if (-not (Test-Path $Creds)) { throw "Thieu $Creds" }

$exe = (Get-Command cloudflared).Source
$arg = "tunnel --config `"$Config`" run"
$action = New-ScheduledTaskAction -Execute $exe -Argument $arg -WorkingDirectory "D:\duan\cine3d"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "OK: Task '$TaskName' se chay khi ban dang nhap Windows."
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State

# Ensure tunnel is up now
$running = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $running) {
  Write-Host "Dang start tunnel ngay..."
  Start-Process -FilePath $exe -ArgumentList $arg -WindowStyle Hidden
  Start-Sleep -Seconds 4
}

try {
  $h = Invoke-RestMethod "https://api.cine3d.id.vn/health" -TimeoutSec 15
  Write-Host ("Public API: " + ($h | ConvertTo-Json -Compress))
} catch {
  Write-Host "Public API chua OK — doi vai giay hoac kiem tra Docker."
}
