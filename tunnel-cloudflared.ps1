# tunnel-cloudflared.ps1 - Lance Expo via Cloudflare Tunnel
# Expo croit utiliser ngrok mais utilise cloudflared en realite
# Usage : depuis C:\Users\USER\Desktop\lassiapp, executer .\tunnel-cloudflared.ps1

$ErrorActionPreference = "Stop"
$appDir = Join-Path $PSScriptRoot "LassiApp"

if (-not (Test-Path $appDir)) {
    Write-Error "Dossier LassiApp introuvable : $appDir"
    exit 1
}

# --- Verifier / installer cloudflared ---
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  [!] cloudflared non trouve." -ForegroundColor Red
    Write-Host "  Installation via winget..." -ForegroundColor Yellow
    Write-Host ""
    winget install cloudflare.cloudflared --source winget --accept-source-agreements --accept-package-agreements
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Host "  Ouvre un nouveau terminal et relance ce script." -ForegroundColor Yellow
        exit 1
    }
}

# --- Creer le faux module @expo/ngrok qui utilise cloudflared ---
$ngrokDir = Join-Path $appDir "node_modules\@expo\ngrok"
New-Item -ItemType Directory -Force -Path $ngrokDir | Out-Null

Set-Content -Path (Join-Path $ngrokDir "package.json") -Encoding UTF8 -Value @'
{
  "name": "@expo/ngrok",
  "version": "4.1.0",
  "main": "index.js"
}
'@

Set-Content -Path (Join-Path $ngrokDir "index.js") -Encoding UTF8 -Value @'
const { spawn } = require('child_process');

let cfProcess = null;

function cleanup() {
  if (cfProcess) {
    try { cfProcess.kill(); } catch(e) {}
    cfProcess = null;
  }
}
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function startTunnel(port) {
  return new Promise((resolve, reject) => {
    cfProcess = spawn('cloudflared', [
      'tunnel', '--url', `http://localhost:${port}`
    ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

    cfProcess.on('error', err =>
      reject(new Error('cloudflared introuvable : ' + err.message))
    );

    let output = '';
    let resolved = false;

    cfProcess.stderr.on('data', (data) => {
      output += data.toString();
      const m = output.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
      if (m && !resolved) {
        resolved = true;
        console.log('\n\x1b[32m  Tunnel Cloudflare : ' + m[0] + '\x1b[0m');
        console.log('\x1b[90m  Scanne le QR code avec la camera iPhone -> Expo Go\x1b[0m\n');
        resolve(m[0]);
      }
    });

    setTimeout(() => {
      if (!resolved) reject(new Error('Timeout : URL cloudflared introuvable apres 60s'));
    }, 60000);
  });
}

// Expo SDK 54 appelle instance.connect(portOrOptions)
async function connect(portOrOptions) {
  const port = typeof portOrOptions === 'object'
    ? (portOrOptions.port || portOrOptions.addr || 8081)
    : portOrOptions;
  return startTunnel(port);
}

async function connectAsync(port) { return startTunnel(port); }
async function disconnect() { cleanup(); }
async function disconnectAsync() { cleanup(); }
async function kill() { cleanup(); }
async function killAsync() { cleanup(); }

module.exports = { connect, connectAsync, disconnect, disconnectAsync, kill, killAsync };
'@

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
