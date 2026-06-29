# ============================================================
# Script : Chiffrement du PIN retailer Orange Money (RSA-OAEP)
# Usage  : .\om-encrypt-pin.ps1 -Pin "1234" [-Sandbox]
#
# Ce script chiffre le PIN du compte retailer LASSI avec la
# clé publique RSA d'Orange Money Sonatel, puis affiche la
# valeur base64 à mettre dans OM_RETAILER_PIN_ENCRYPTED.
# ============================================================
param(
  [Parameter(Mandatory=$true)]
  [string]$Pin,

  [switch]$Sandbox
)

# ── Récupérer un token OAuth ──────────────────────────────────────────────────
$clientId     = $env:OM_CLIENT_ID     ?? "54b8526b-8fc3-43cd-a839-c055ef7b99ba"
$clientSecret = $env:OM_CLIENT_SECRET ?? "b8eaef08-5875-4210-97d9-b17f36bb5a94"
$baseUrl      = if ($Sandbox) { "https://api.sandbox.orange-sonatel.com" } else { "https://api.orange-sonatel.com" }

Write-Host "Base URL : $baseUrl"
Write-Host "Obtention du token OAuth2..."

$tokenRes = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/oauth/v1/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=$clientId&client_secret=$clientSecret&grant_type=client_credentials"

$token = $tokenRes.access_token
Write-Host "Token OK."

# ── Récupérer la clé publique RSA d'Orange ───────────────────────────────────
Write-Host "Récupération de la clé publique RSA..."
$keyRes = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/api/account/v1/publicKeys" `
  -Headers @{ Authorization = "Bearer $token" }

$keyBase64 = $keyRes.key
$keyId     = $keyRes.keyId
Write-Host "Clé RSA récupérée (keyId: $keyId)"

# ── Reconstruire la clé au format PEM (SubjectPublicKeyInfo) ─────────────────
$keyBytes = [Convert]::FromBase64String($keyBase64)
$rsa      = [System.Security.Cryptography.RSA]::Create()
$rsa.ImportSubjectPublicKeyInfo($keyBytes, [ref]$null)

# ── Chiffrer le PIN en RSA-OAEP SHA-1 ────────────────────────────────────────
# Orange Money Sonatel utilise RSA-OAEP avec SHA-1 (standard pour leur API)
$pinBytes       = [System.Text.Encoding]::UTF8.GetBytes($Pin)
$encryptedBytes = $rsa.Encrypt($pinBytes, [System.Security.Cryptography.RSAEncryptionPadding]::OaepSHA1)
$encryptedB64   = [Convert]::ToBase64String($encryptedBytes)

Write-Host ""
Write-Host "============================================================"
Write-Host "PIN chiffré (RSA-OAEP SHA-1, base64) :"
Write-Host $encryptedB64
Write-Host "Longueur : $($encryptedB64.Length) caractères (attendu: ~344)"
Write-Host "============================================================"
Write-Host ""
Write-Host "À mettre dans supabase/functions/.env :"
Write-Host "OM_RETAILER_PIN_ENCRYPTED=$encryptedB64"
