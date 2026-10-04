# OTA TRIPLE-PUBLISH LASSI — Script officiel, unique, obligatoire
# Usage : .\ota-triple-publish.ps1 -Message "description du fix"
# REGLES :
#   1. Toujours commiter dans git AVANT de lancer ce script
#   2. Ne jamais lancer deux instances en parallele
#   3. Ne jamais pousser d OTA avec une autre commande

param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"

$SUPABASE_URL      = "https://tsdemraszwtbzgtyjzum.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZGVtcmFzend0YnpndHlqenVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5MjcsImV4cCI6MjA5NTIwMzkyN30.EQ64jUdey9U344pXMDmysM0UJrk3zhKA66JfVuQ3W-s"
$DIST              = "dist_ota_$(Get-Date -Format 'yyyyMMdd_HHmm')"
$CONFIG            = "app.config.js"
$RUNTIMES          = @("1.0.1", "1.0.2", "1.0.3")

$env:EXPO_PUBLIC_SUPABASE_URL      = $SUPABASE_URL
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = $SUPABASE_ANON_KEY
$env:EXPO_PUBLIC_PAYMENT_MODE      = "production"
$env:EAS_SKIP_AUTO_FINGERPRINT     = "1"

function Set-AppVersion {
  param([string]$v)
  $content = [System.IO.File]::ReadAllText((Resolve-Path $CONFIG), [System.Text.Encoding]::UTF8)
  $content = $content -replace '(version:\s*")[^"]+(")', "`${1}$v`$2"
  [System.IO.File]::WriteAllText((Resolve-Path $CONFIG), $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  version = $v"
}

function Push-Runtime {
  param([string]$rt)
  Write-Host ""
  Write-Host "== Push rt$rt =="
  Set-AppVersion $rt
  & eas update --branch production --message $Message --skip-bundler --input-dir $DIST --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "eas update rt$rt a echoue (exit $LASTEXITCODE)" }
  Write-Host "  rt$rt publie OK"
}

# ETAPE 1 : export UNIQUE (bundle identique pour les 3 runtimes)
Write-Host ""
Write-Host "== Export bundle =="
Set-AppVersion "1.0.1"
& npx expo export --platform android --output-dir $DIST
if ($LASTEXITCODE -ne 0) { throw "expo export a echoue" }
Write-Host "  Bundle exporte dans $DIST"

# ETAPE 2 : push sequentiel rt1.0.1 puis rt1.0.2 puis rt1.0.3
foreach ($rt in $RUNTIMES) {
  Push-Runtime $rt
}

# ETAPE 3 : reset baseline a 1.0.1
Set-AppVersion "1.0.1"
Write-Host ""
Write-Host "DONE - 3 OTAs publies, baseline reset a 1.0.1"
