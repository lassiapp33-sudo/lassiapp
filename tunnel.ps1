# tunnel.ps1 - Expo tunnel ngrok pour LASSI (SDK 54 / ngrok v2)
# Gere automatiquement l''auth token ngrok (requis depuis 2024)

$ErrorActionPreference = "Stop"

$ngrokBin   = Join-Path $PSScriptRoot "node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
$ngrokConfig = Join-Path $env:USERPROFILE ".ngrok2\ngrok.yml"

# --- Verifie si le token est deja configure ---
$tokenOk = $false

if ($env:NGROK_AUTHTOKEN -and $env:NGROK_AUTHTOKEN.Length -gt 10) {
    $tokenOk = $true
}
elseif (Test-Path $ngrokConfig) {
    $yml = Get-Content $ngrokConfig -Raw
    if ($yml -match "authtoken:\s*\S") { $tokenOk = $true }
}

# --- Si pas de token : guide l''utilisateur ---
if (-not $tokenOk) {
    Write-Host ""
    Write-Host "  LASSI - Configuration ngrok (une seule fois)" -ForegroundColor Yellow
    Write-Host "  ------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ngrok v2 exige un compte GRATUIT pour fonctionner." -ForegroundColor White
    Write-Host ""
    Write-Host "  1. Cree un compte (30s) : https://dashboard.ngrok.com/signup" -ForegroundColor Cyan
    Write-Host "  2. Copie ton token      : https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Cyan
    Write-Host ""
    $token = Read-Host "  Colle ton auth token ici"

    if (-not $token -or $token.Length -lt 10) {
        Write-Host "  Token invalide. Annulation." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "  Configuration du token..." -ForegroundColor DarkGray
    & $ngrokBin authtoken $token
    Write-Host "  Token enregistre." -ForegroundColor Green
    Write-Host ""
}

# --- Lance Expo en mode tunnel ---
Write-Host ""
Write-Host "  LASSI - Expo start --tunnel" -ForegroundColor Yellow
Write-Host ""

npx expo start --tunnel