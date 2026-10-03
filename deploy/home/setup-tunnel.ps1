#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Example = Join-Path $PSScriptRoot "config.yml.example"
$Config = Join-Path $PSScriptRoot "config.yml"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "Dang cai cloudflared bang winget..."
  winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
}

Write-Host "Dang nhap Cloudflare (trinh duyet se mo). Chon zone cine3d.id.vn."
cloudflared tunnel login

$existing = cloudflared tunnel list 2>$null | Select-String "cine3d-api"
if (-not $existing) {
  cloudflared tunnel create cine3d-api
}

Write-Host "Gan DNS api.cine3d.id.vn vao tunnel (ghi de CNAME tren Cloudflare)..."
cloudflared tunnel route dns --overwrite-dns cine3d-api api.cine3d.id.vn

$listed = cloudflared tunnel list
Write-Host $listed
Write-Host ""
Write-Host "Chep UUID cot ID cua cine3d-api vao deploy\home\config.yml"
if (-not (Test-Path $Config)) {
  Copy-Item $Example $Config
}

$user = $env:USERNAME
(Get-Content $Config) `
  -replace "REPLACE_WINDOWS_USER", $user `
  | Set-Content $Config

Write-Host "Mo $Config, thay REPLACE_WITH_TUNNEL_UUID bang UUID that."
Write-Host "Cloudflare Dashboard -> Network: bat WebSockets."
Write-Host "Sau do: .\deploy\home\start-home-api.ps1"
