# predeploy_check.ps1
# What: deterministic pre-deploy checks for KadaiGPT (push to main = prod deploy).
#       1) frontend production build  2) backend import sanity
#       3) no NOW() in raw text() SQL  4) bcrypt pinned to 4.2.1
# See: PROJECT_NOTES.md (pre-deploy routine) and CLAUDE.md (the judgment checks:
# schema mirroring, tenancy, i18n, env vars — NOT covered here).
# Env vars: none required (sets PYTHONIOENCODING=utf-8 itself).
# Exit 0 = all checks pass; exit 1 = at least one failed.

$ErrorActionPreference = 'Continue'
$repo = $PSScriptRoot  # script lives at the repo root
$fail = 0

Write-Output '[1/4] Frontend production build...'
Push-Location (Join-Path $repo 'frontend')
npm run build *> $null
if ($LASTEXITCODE -ne 0) { Write-Output '  FAIL: npm run build'; $fail++ } else { Write-Output '  OK' }
Pop-Location

Write-Output '[2/4] Backend import sanity...'
Push-Location (Join-Path $repo 'backend')
$env:PYTHONIOENCODING = 'utf-8'
$routes = python -c "from app.main import app; print(len(app.routes))" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $routes) { Write-Output '  FAIL: app.main does not import'; $fail++ }
else { Write-Output "  OK ($routes routes)" }
Pop-Location

Write-Output '[3/4] NOW() in raw SQL (Postgres-only, silently breaks SQLite)...'
$nowHits = Get-ChildItem (Join-Path $repo 'backend\app') -Recurse -Filter '*.py' |
    Select-String -Pattern 'text\([^)]*NOW\(\)' -CaseSensitive
if ($nowHits) { $nowHits | ForEach-Object { Write-Output "  FAIL: $($_.Path):$($_.LineNumber)" }; $fail++ }
else { Write-Output '  OK' }

Write-Output '[4/4] bcrypt pin (must be exactly 4.2.1)...'
$req = Get-Content (Join-Path $repo 'requirements.txt') -Encoding utf8
$bcryptLine = $req | Where-Object { $_ -match '^\s*bcrypt' }
if ($bcryptLine -match '^\s*bcrypt==4\.2\.1\s*$') { Write-Output '  OK' }
else { Write-Output "  FAIL: expected 'bcrypt==4.2.1', found: '$bcryptLine'"; $fail++ }

Write-Output ''
if ($fail -gt 0) { Write-Output "RESULT: $fail check(s) FAILED"; exit 1 }
else { Write-Output 'RESULT: all checks passed'; exit 0 }
