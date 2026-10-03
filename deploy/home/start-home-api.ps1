#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$EnvFile = Join-Path $Root ".env.home"
$Example = Join-Path $Root ".env.home.example"
$Compose = Join-Path $Root "docker-compose.home.yml"
$TunnelConfig = Join-Path $Root "deploy\home\config.yml"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Chua cai Docker Desktop. Cai tai https://www.docker.com/products/docker-desktop/"
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $Example $EnvFile
  Write-Host "Da tao .env.home tu mau. Dien secret (JWT, Postgres, Google, email) roi chay lai script."
  exit 1
}

Write-Host "Khoi dong redis + backend + frontend..."
docker compose -f $Compose --env-file $EnvFile up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Cho backend healthy..."
docker compose -f $Compose --env-file $EnvFile ps

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/health" -TimeoutSec 5
  Write-Host ("Health: {0} / db {1}" -f $health.status, $health.database)
} catch {
  Write-Host "Backend chua tra /health. Xem log: docker logs cine3d-backend --tail 80"
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Host "Cai cloudflared: winget install --id Cloudflare.cloudflared"
  Write-Host "Roi chay: deploy\home\setup-tunnel.ps1"
  exit 0
}

if (-not (Test-Path $TunnelConfig)) {
  Write-Host "Chua co deploy\home\config.yml. Chay mot lan: deploy\home\setup-tunnel.ps1"
  exit 0
}

Write-Host "Mo Cloudflare Tunnel (API :5000, web :3000) ..."
cloudflared tunnel --config $TunnelConfig run
