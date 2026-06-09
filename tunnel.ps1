# tunnel.ps1 - Lance Expo via Tailscale (remplace ngrok)
# Usage : depuis C:\Users\USER\Desktop\lassiapp, executer .\tunnel.ps1
# Prerequis : Tailscale installe et connecte sur PC + telephone (meme compte)

$ErrorActionPreference = "Stop"

$appDir = Join-Path $PSScriptRoot "LassiApp"

if (-not (Test-Path $appDir)) {
    Write-Error "Dossier LassiApp introuvable : $appDir"
    exit 1
}

# Recupere l'IP Tailscale automatiquement (sans 2>$null : peut corrompre la variable en PS 5.1)
$tailscaleIp = $null
try {
    $raw = & tailscale ip -4
    $tailscaleIp = ($raw | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' } | Select-Object -First 1)
    if ($tailscaleIp) { $tailscaleIp = $tailscaleIp.Trim() }
} catch {}

if (-not $tailscaleIp) {
    Write-Host ""
    Write-Host "  [!] Tailscale non detecte." -ForegroundColor Red
    Write-Host "  Installe Tailscale sur https://tailscale.com/download" -ForegroundColor Yellow
    Write-Host "  Puis relance ce script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  LASSI - Expo start (Tailscale)" -ForegroundColor Yellow
Write-Host "  IP Tailscale : $tailscaleIp" -ForegroundColor Cyan
Write-Host "  Assure-toi que Tailscale est aussi actif sur ton telephone" -ForegroundColor DarkGray
Write-Host ""

Push-Location $appDir
try {
    npx expo start --host $tailscaleIp --go
} finally {
    Pop-Location
}
