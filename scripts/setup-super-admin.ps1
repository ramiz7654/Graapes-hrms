$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path (Join-Path $root '.env'))) {
  throw 'Root .env file was not found. Copy .env.example to .env and configure DATABASE_URL first.'
}

$envText = Get-Content (Join-Path $root '.env') -Raw
if ($envText -notmatch '(?m)^\s*DATABASE_URL\s*=') {
  throw 'DATABASE_URL is missing from .env. Configure the Supabase/PostgreSQL connection first.'
}

$email = (Read-Host 'Enter Super Admin email').Trim().ToLowerInvariant()
if ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Please enter a valid email address.' }
$securePassword = Read-Host 'Create a strong Super Admin password (minimum 12 characters)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if ($password.Length -lt 12) { throw 'Password must be at least 12 characters.' }

$oldEmail = $env:SUPER_ADMIN_EMAIL
$oldPassword = $env:SUPER_ADMIN_PASSWORD
try {
  $env:SUPER_ADMIN_EMAIL = $email
  $env:SUPER_ADMIN_PASSWORD = $password
  npm run db:seed
  if ($LASTEXITCODE -ne 0) { throw 'Database seed failed. Check the error above and confirm DATABASE_URL is correct.' }
}
finally {
  $env:SUPER_ADMIN_EMAIL = $oldEmail
  $env:SUPER_ADMIN_PASSWORD = $oldPassword
  $password = $null
  $securePassword.Dispose()
}
