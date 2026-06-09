# tunnel-cloudflared.ps1 - Lance Expo via Cloudflare Tunnel
# Expo croit utiliser ngrok mais utilise cloudflared en realite
# Usage : depuis C:\Users\USER\Desktop\lassiapp, executer .\tunnel-cloudflared.ps1

$ErrorActionPreference = "Stop"
$appDir = Join-Path $PSScriptRoot "Lassi"

if (-not (Test-Path $appDir)) {
    Write-Error "Dossier Lassi introuvable : $appDir"
    exit 1
}

# --- Verifier / installer cloudflared ---
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  [!] cloudflared non trouve." -ForegroundColor Red
    Write-Host "  Installation via winget..." -ForegroundColor Yellow
    Write-Host ""
    winget install cloudflare.cloudflared --source winget --accept-source-agreements --accept-package-agreements

    # Rafraichir le PATH depuis le registre + repertoire shims WinGet (scope user)
    $machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $wingetLinks = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"
    $env:PATH = "$machinePath;$userPath;$wingetLinks"

    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host "  Ouvre un nouveau terminal et relance ce script." -ForegroundColor Yellow
        exit 1
    }
}

# --- Synchroniser le shim @expo/ngrok avec ngrok-localtunnel-shim ---
# node_modules/@expo/ngrok est gere par npm (file: dans package.json).
# On ecrase quand meme pour garantir la version cloudflared apres npm install.
$ngrokDir = Join-Path $appDir "node_modules\@expo\ngrok"
$null = [System.IO.Directory]::CreateDirectory($ngrokDir)

# Utiliser WriteAllText (UTF-8 sans BOM) car Set-Content -Encoding UTF8 ajoute un BOM en PS 5.1
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

[System.IO.File]::WriteAllText(
    (Join-Path $ngrokDir "package.json"),
    "{`n  `"name`": `"@expo/ngrok`",`n  `"version`": `"4.1.0`",`n  `"main`": `"index.js`"`n}`n",
    $utf8NoBom
)

$shimSrc = Join-Path $appDir "ngrok-localtunnel-shim\index.js"
if (Test-Path $shimSrc) {
    # Copier directement depuis la source (evite la duplication)
    [System.IO.File]::WriteAllText(
        (Join-Path $ngrokDir "index.js"),
        [System.IO.File]::ReadAllText($shimSrc, $utf8NoBom),
        $utf8NoBom
    )
} else {
    Write-Error "Shim introuvable : $shimSrc"
    exit 1
}

Write-Host ""
Write-Host "  LASSI - Expo start (Cloudflare Tunnel)" -ForegroundColor Yellow
Write-Host "  Demarrage... le tunnel se lance automatiquement." -ForegroundColor Cyan
Write-Host ""

Push-Location $appDir
try {
    npx expo start --tunnel --go --clear
} finally {
    Pop-Location
}
