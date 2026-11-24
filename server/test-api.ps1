# Device Amortization Backend - API Test Script (English-only to avoid PS 5.1 encoding issues)
# Covers the email verification-code (OTP) login flow.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8787'

function Get-ErrBody($err) {
  try { return ($err.ErrorDetails.Message | ConvertFrom-Json) } catch { return $null }
}

function Get-HttpCode($err) {
  try { return [int]$err.Exception.Response.StatusCode } catch { return -1 }
}

function Post-Json($url, $obj) {
  return Invoke-RestMethod $url -Method Post -ContentType 'application/json' -Body ($obj | ConvertTo-Json -Compress)
}

Write-Host '===== Device Amortization API Tests (email code login) ====='

# 1. health
$h = Invoke-RestMethod "$base/api/health"
Write-Host "[1] health: ok=$($h.ok), mailConfigured=$($h.mailConfigured) PASS"

$email = 'code-test@example.com'

# 2. request verification code (demo mode returns devCode)
$r = Post-Json "$base/api/auth/request" @{ email = $email }
if (-not $r.devCode) { throw '[2] devCode missing in demo mode' }
$code = $r.devCode
if ($code.Length -ne 6) { throw "[2] code length unexpected: $($code.Length)" }
Write-Host "[2] request code: ok=$($r.ok), sent=$($r.sent), len=$($code.Length), ttl=$($r.expiresInMinutes)min PASS"

# 3. wrong code is rejected and reports remaining attempts
$wrong = '000001'
if ($code -eq $wrong) { $wrong = '000002' }
$attemptsLeft = -1
try {
  Post-Json "$base/api/auth/verify" @{ email = $email; code = $wrong } | Out-Null
  throw '[3] wrong code was accepted!'
} catch {
  $body = Get-ErrBody $_
  if ((Get-HttpCode $_) -ne 400) { throw "[3] expected HTTP 400, got $(Get-HttpCode $_)" }
  if ($body.error -ne 'code_invalid') { throw "[3] expected code_invalid, got $($body.error)" }
  $attemptsLeft = $body.attemptsLeft
}
Write-Host "[3] wrong code rejected: attemptsLeft=$attemptsLeft PASS"

# 4. correct code issues a session
$v = Post-Json "$base/api/auth/verify" @{ email = $email; code = $code }
$session = $v.token
if (-not $session) { throw '[4] no session token returned' }
Write-Host "[4] verify code: user=$($v.user.email), sessionLen=$($session.Length) PASS"

# 5. code is single-use
$reused = $false
try {
  Post-Json "$base/api/auth/verify" @{ email = $email; code = $code } | Out-Null
} catch {
  $reused = $true
}
if (-not $reused) { throw '[5] verification code was reusable!' }
Write-Host '[5] code single-use: reuse rejected PASS'

# 6. me
$me = Invoke-RestMethod "$base/api/auth/me" -Headers @{ 'X-Session-Token' = $session }
Write-Host "[6] me: $($me.user.email), cloudSync=$($me.sync -ne $null) PASS"

# 6b. legacy Authorization: Bearer also accepted (compat path)
$legacy = $false
try {
  $me2 = Invoke-RestMethod "$base/api/auth/me" -Headers @{ Authorization = "Bearer $session" }
  $legacy = ($me2.user.email -eq $email)
} catch { $legacy = $false }
if (-not $legacy) { throw '[6b] Authorization: Bearer fallback rejected' }
Write-Host '[6b] token via Authorization fallback accepted PASS'

$authHeader = @{ 'X-Session-Token' = $session }

# 7. sync upload
$doc = @{ data = @(@{ id = 't1'; name = 'Test Device'; price = 1000 }); baseUpdatedAt = $null } | ConvertTo-Json -Depth 6 -Compress
$up = Invoke-RestMethod "$base/api/sync" -Method Put -ContentType 'application/json' -Headers $authHeader -Body $doc
Write-Host "[7] sync upload: revision=$($up.revision) PASS"

# 8. sync download
$dl = Invoke-RestMethod "$base/api/sync" -Headers $authHeader
if ($dl.data.Count -ne 1) { throw "[8] expected 1 device, got $($dl.data.Count)" }
Write-Host "[8] sync download: count=$($dl.data.Count), name=$($dl.data[0].name) PASS"

# 9. conflict detection (stale baseUpdatedAt is rejected)
$stale = $false
try {
  $bad = @{ data = @(); baseUpdatedAt = $dl.updatedAt - 9999 } | ConvertTo-Json -Depth 6 -Compress
  Invoke-RestMethod "$base/api/sync" -Method Put -ContentType 'application/json' -Headers $authHeader -Body $bad | Out-Null
} catch {
  if ((Get-HttpCode $_) -ne 409) { throw "[9] expected HTTP 409, got $(Get-HttpCode $_)" }
  $stale = $true
}
if (-not $stale) { throw '[9] stale upload was not rejected' }
Write-Host '[9] conflict detection: stale upload rejected (HTTP 409) PASS'

# 10. upload with correct base
$ok2 = @{ data = $dl.data; baseUpdatedAt = $dl.updatedAt } | ConvertTo-Json -Depth 6 -Compress
$up2 = Invoke-RestMethod "$base/api/sync" -Method Put -ContentType 'application/json' -Headers $authHeader -Body $ok2
Write-Host "[10] upload with correct base: revision=$($up2.revision) PASS"

# 11. no-credential request rejected
$noAuth = $false
try { Invoke-RestMethod "$base/api/sync" | Out-Null } catch {
  if ((Get-HttpCode $_) -ne 401) { throw "[11] expected HTTP 401, got $(Get-HttpCode $_)" }
  $noAuth = $true
}
if (-not $noAuth) { throw '[11] unauthenticated request was allowed' }
Write-Host '[11] auth check: no-credential rejected (HTTP 401) PASS'

# 12. resend rate limit (same email within 60s)
$limited = $false
try { Post-Json "$base/api/auth/request" @{ email = $email } | Out-Null } catch {
  if ((Get-HttpCode $_) -ne 429) { throw "[12] expected HTTP 429, got $(Get-HttpCode $_)" }
  $limited = $true
}
if (-not $limited) { throw '[12] resend rate limit not enforced' }
Write-Host '[12] rate limit: rapid resend rejected (HTTP 429) PASS'

# 13. email validation
$badEmail = $false
try { Post-Json "$base/api/auth/request" @{ email = 'not-an-email' } | Out-Null } catch {
  if ((Get-HttpCode $_) -ne 400) { throw "[13] expected HTTP 400, got $(Get-HttpCode $_)" }
  $badEmail = $true
}
if (-not $badEmail) { throw '[13] invalid email accepted' }
Write-Host '[13] email validation: invalid email rejected PASS'

# 14. verification code format validation
$badCode = $false
try { Post-Json "$base/api/auth/verify" @{ email = $email; code = 'abc' } | Out-Null } catch {
  $body = Get-ErrBody $_
  if ($body.error -ne 'bad_code') { throw "[14] expected bad_code, got $($body.error)" }
  $badCode = $true
}
if (-not $badCode) { throw '[14] malformed code accepted' }
Write-Host '[14] code format validation: non-numeric rejected PASS'

# 15. logout
$out = Invoke-RestMethod "$base/api/auth/logout" -Method Post -Headers $authHeader
Write-Host "[15] logout: ok=$($out.ok) PASS"

# 16. session invalidated after logout
$gone = $false
try { Invoke-RestMethod "$base/api/sync" -Headers $authHeader | Out-Null } catch {
  if ((Get-HttpCode $_) -ne 401) { throw "[16] expected HTTP 401, got $(Get-HttpCode $_)" }
  $gone = $true
}
if (-not $gone) { throw '[16] session still valid after logout' }
Write-Host '[16] post-logout auth: session invalidated (HTTP 401) PASS'

Write-Host ''
Write-Host '===== ALL 17 TESTS PASSED ====='
