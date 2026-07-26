# ============================================================
# Script : Chiffrement du PIN retailer Orange Money (RSA-OAEP)
# Usage  : .\om-encrypt-pin.ps1 -Pin "1234" -ClientId "xxx" -ClientSecret "yyy"
#          [-Sandbox] pour utiliser l'environnement sandbox
# ============================================================
param(
  [Parameter(Mandatory=$true)]
  [string]$Pin,

  [string]$ClientId,
  [string]$ClientSecret,

  [switch]$Sandbox
)

if (-not $ClientId)     { if ($env:OM_CLIENT_ID)     { $ClientId     = $env:OM_CLIENT_ID }     else { $ClientId     = "54b8526b-8fc3-43cd-a839-c055ef7b99ba" } }
if (-not $ClientSecret) { if ($env:OM_CLIENT_SECRET) { $ClientSecret = $env:OM_CLIENT_SECRET } else { $ClientSecret = "b8eaef08-5875-4210-97d9-b17f36bb5a94" } }

$baseUrl = if ($Sandbox) { "https://api.sandbox.orange-sonatel.com" } else { "https://api.orange-sonatel.com" }

# ── Helpers DER parser (compatible .NET Framework 4.x / PS 5.1) ──────────────
function Get-DerLength([byte[]]$data, [int]$pos) {
    if ($data[$pos] -lt 0x80) { return [int]$data[$pos] }
    $n = $data[$pos] -band 0x7F
    $len = 0
    for ($i = 1; $i -le $n; $i++) { $len = ($len -shl 8) -bor $data[$pos + $i] }
    return $len
}

function Get-DerLengthSize([byte[]]$data, [int]$pos) {
    if ($data[$pos] -lt 0x80) { return 1 }
    return 1 + ($data[$pos] -band 0x7F)
}

function Parse-RSAPublicKey([byte[]]$der) {
    $p = 0
    # Outer SEQUENCE
    $p++; $p += Get-DerLengthSize $der $p
    # AlgorithmIdentifier SEQUENCE
    $p++
    $algLen = Get-DerLength $der $p
    $p += Get-DerLengthSize $der $p
    $p += $algLen
    # BIT STRING
    $p++
    $p += Get-DerLengthSize $der $p
    $p++ # unused bits byte
    # Inner SEQUENCE (RSAPublicKey)
    $p++; $p += Get-DerLengthSize $der $p
    # Modulus INTEGER
    $p++
    $modLen = Get-DerLength $der $p
    $p += Get-DerLengthSize $der $p
    if ($der[$p] -eq 0x00) { $p++; $modLen-- }
    $modulus = $der[$p..($p + $modLen - 1)]
    $p += $modLen
    # Exponent INTEGER
    $p++
    $expLen = Get-DerLength $der $p
    $p += Get-DerLengthSize $der $p
    $exponent = $der[$p..($p + $expLen - 1)]
    return @{ Modulus = $modulus; Exponent = $exponent }
}

# ── OAuth2 token ──────────────────────────────────────────────────────────────
Write-Host "Base URL : $baseUrl"
Write-Host "Client ID : $($ClientId.Substring(0,8))..."
Write-Host "Obtention du token OAuth2..."

$tokenRes = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/oauth/v1/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=$ClientId&client_secret=$ClientSecret&grant_type=client_credentials"

$token = $tokenRes.access_token
Write-Host "Token OK."

# ── Cle publique RSA Orange ───────────────────────────────────────────────────
Write-Host "Recuperation de la cle publique RSA..."
$keyRes = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/api/account/v1/publicKeys" `
  -Headers @{ Authorization = "Bearer $token" }

$keyBase64 = $keyRes.key
$keyId     = $keyRes.keyId
Write-Host "Cle RSA recuperee (keyId: $keyId)"

# ── Chiffrement RSA-OAEP SHA-1 (compatible PS 5.1 / .NET 4.x) ────────────────
$keyBytes  = [Convert]::FromBase64String($keyBase64)
$rsaParams = Parse-RSAPublicKey $keyBytes

$rsa    = New-Object System.Security.Cryptography.RSACryptoServiceProvider
$params = New-Object System.Security.Cryptography.RSAParameters
$params.Modulus  = $rsaParams.Modulus
$params.Exponent = $rsaParams.Exponent
$rsa.ImportParameters($params)

$pinBytes       = [System.Text.Encoding]::UTF8.GetBytes($Pin)
$encryptedBytes = $rsa.Encrypt($pinBytes, $true) # $true = OAEP padding (SHA-1)
$encryptedB64   = [Convert]::ToBase64String($encryptedBytes)

Write-Host ""
Write-Host "============================================================"
Write-Host "PIN chiffre (RSA-OAEP SHA-1, base64) :"
Write-Host $encryptedB64
Write-Host "Longueur : $($encryptedB64.Length) caracteres (attendu: ~344)"
Write-Host "============================================================"
Write-Host ""
Write-Host "A mettre dans Supabase Secrets :"
Write-Host "OM_RETAILER_PIN_ENCRYPTED=$encryptedB64"
