# Cine3D mobile local bootstrap (Windows)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> Cine3D mobile setup" -ForegroundColor Cyan

if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
  Write-Host "Created .env.local from .env.example" -ForegroundColor Yellow
} else {
  Write-Host ".env.local already exists" -ForegroundColor Green
}

if (-not (Test-Path node_modules)) {
  Write-Host "Installing npm dependencies..."
  npm install
} else {
  Write-Host "node_modules present — skipping npm install (run npm install manually if needed)"
}

Write-Host ""
Write-Host "Environment check:" -ForegroundColor Cyan
Write-Host "  Node: $(node -v)"
Write-Host "  npm:  $(npm -v)"

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  "$env:LOCALAPPDATA\Android\Sdk",
  "$env:USERPROFILE\AppData\Local\Android\Sdk"
) | Where-Object { $_ }

$sdk = $sdkCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($sdk) {
  Write-Host "  Android SDK: $sdk" -ForegroundColor Green
} else {
  Write-Host "  Android SDK: NOT FOUND" -ForegroundColor Red
  Write-Host "  Install Android Studio: https://developer.android.com/studio" -ForegroundColor Yellow
  Write-Host "  Or: winget install Google.AndroidStudio" -ForegroundColor Yellow
}

$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) {
  Write-Host "  adb devices:"
  adb devices
} else {
  Write-Host "  adb: not on PATH (open Android Studio once, then restart terminal)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. Install Android Studio + create an emulator (or plug a phone with USB debugging)"
Write-Host "  2. Edit .env.local if needed"
Write-Host "  3. Run: npx expo run:android"
Write-Host ""
Write-Host "Note: Google login / FCM / Play Billing need console credentials you must create." -ForegroundColor DarkYellow
