# ============================================================
# OTA TRIPLE-PUBLISH LASSI — Script officiel, unique, obligatoire
# Usage : .\ota-triple-publish.ps1 -Message "description du fix"
# ============================================================
# REGLES :
#   1. Toujours commiter dans git AVANT de lancer ce script
#   2. Ne jamais lancer deux instances de ce script en parallele
#   3. Ne jamais pousser d'OTA avec une autre commande
# ============================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"

$SUPABASE_URL      = "https://qyuynxgrbqmcnvkhvcwb.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dXlueGdyYnFtY252a2h2Y3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTkxODcsImV4cCI6MjA3NTE3NTE4N30.JNT-XYlYeQhVpSxHpB-c5rWhxJkL5yp1cMzCDNWnOeo"
$DIST              = "dist_ota_$(Get-Date -Format 'yyyyMMdd_HHmm')"
$CONFIG            = "app.config.js"
$RUNTIMES          = @("1.0.1", "1.0.2", "1.0.3")

# ── Variables env (DOIVENT rester dans le meme processus que expo export) ──
$env:EXPO_PUBLIC_SUPABASE_URL      = $SUPABASE_URL
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = $SUPABASE_ANON_KEY
$env:EXPO_PUBLIC_PAYMENT_MODE      = "production"
$env:EAS_SKIP_AUTO_FINGERPRINT     = "1"

function Set-Version {
  param([string]$v)
  # Remplace la version dans app.config.js — regex large pour survivre aux commentaires du linter
  $content = Get-Content $CONFIG -Raw -Encoding utf8
  $content = $content -replace '(version:\s*")[^"]+(")', "`${1}$v`$2"
  # Ecriture directe sans passer par le linter (encodage utf8 sans BOM)
  [System.IO.File]::WriteAllText((Resolve-Path $CONFIG), $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  version = $v" -ForegroundColor Cyan
}

function Push-Runtime {
  param([string]$rt)
  Write-Host ""
  Write-Host "━━ Push rt$rt ━━" -ForegroundColor Yellow
  # Set version JUSTE AVANT le push (atomic — linter n'a pas le temps d'intervenir)
  Set-Version $rt
  & eas update --branch production --message $Message --skip-bundler --input-dir $DIST --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "eas update rt$rt a echoue (exit $LASTEXITCODE)" }
  Write-Host "  rt$rt publie" -ForegroundColor Green
}

# ══ ETAPE 1 : export UNIQUE ══════════════════════════════════════════════════
Write-Host ""
Write-Host "━━ Export bundle (1 seul pour les 3 runtimes) ━━" -ForegroundColor Yellow
Set-Version "1.0.1"
& npx expo export --platform android --output-dir $DIST
if ($LASTEXITCODE -ne 0) { throw "expo export a echoue" }
Write-Host "  Bundle exporte dans $DIST" -ForegroundColor Green

# ══ ETAPE 2 : push sequentiel rt1.0.1 → rt1.0.2 → rt1.0.3 ══════════════════
foreach ($rt in $RUNTIMES) {
  Push-Runtime $rt
}

# ══ ETAPE 3 : reset baseline ════════════════════════════════════════════════
Set-Version "1.0.1"
Write-Host ""
Write-Host "DONE — 3 OTAs publies, baseline reset a 1.0.1" -ForegroundColor Green
Write-Host "Verifier sur EAS : https://expo.dev/accounts/lassiapp/projects/LassiApp/updates"
