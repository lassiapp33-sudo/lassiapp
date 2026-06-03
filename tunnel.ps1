# tunnel.ps1 - Lance Expo via Tailscale (remplace ngrok)
# Usage : depuis C:\Users\USER\Desktop\lassiapp, executer .\tunnel.ps1
# Prerequis : Tailscale installe et connecte sur PC + telephone (meme compte)

$ErrorActionPreference = "Stop"

$appDir = Join-Path $PSScriptRoot "LassiApp"

if (-not (Test-Path $appDir)) {
    Write-Error "Dossier LassiApp introuvable : $appDir"
    exit 1
}

# Recupere l'IP Tailscale automatiquement
$tailscaleIp = $null
try {
    $tailscaleIp = (tailscale ip -4 2>$null).Trim()
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
