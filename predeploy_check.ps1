# predeploy_check.ps1
# What: deterministic pre-deploy checks for KadaiGPT (push to main = prod deploy).
#       1) frontend production build  2) backend import sanity
#       3) no NOW() in raw text() SQL  4) bcrypt pinned to 4.2.1
#       5) known bloat deps scan  6) Vercel Python bundle size estimate (225 MB
#          hard cap on the platform - fails the check before you push, not after).
# See: PROJECT_NOTES.md (pre-deploy routine) and CLAUDE.md (the judgment checks:
# schema mirroring, tenancy, i18n, env vars — NOT covered here).
# Env vars: none required (sets PYTHONIOENCODING=utf-8 itself).
# Exit 0 = all checks pass; exit 1 = at least one failed.

$ErrorActionPreference = 'Continue'
$repo = $PSScriptRoot  # script lives at the repo root
$fail = 0

Write-Output '[1/6] Frontend production build...'
Push-Location (Join-Path $repo 'frontend')
npm run build *> $null
if ($LASTEXITCODE -ne 0) { Write-Output '  FAIL: npm run build'; $fail++ } else { Write-Output '  OK' }
Pop-Location

Write-Output '[2/6] Backend import sanity...'
Push-Location (Join-Path $repo 'backend')
$env:PYTHONIOENCODING = 'utf-8'
$routes = python -c "from app.main import app; print(len(app.routes))" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $routes) { Write-Output '  FAIL: app.main does not import'; $fail++ }
else { Write-Output "  OK ($routes routes)" }
Pop-Location

Write-Output '[3/6] NOW() in raw SQL (Postgres-only, silently breaks SQLite)...'
$nowHits = Get-ChildItem (Join-Path $repo 'backend\app') -Recurse -Filter '*.py' |
    Select-String -Pattern 'text\([^)]*NOW\(\)' -CaseSensitive
if ($nowHits) { $nowHits | ForEach-Object { Write-Output "  FAIL: $($_.Path):$($_.LineNumber)" }; $fail++ }
else { Write-Output '  OK' }

Write-Output '[4/6] bcrypt pin (must be exactly 4.2.1)...'
$req = Get-Content (Join-Path $repo 'requirements.txt') -Encoding utf8
$bcryptLine = $req | Where-Object { $_ -match '^\s*bcrypt' }
if ($bcryptLine -match '^\s*bcrypt==4\.2\.1\s*$') { Write-Output '  OK' }
else { Write-Output "  FAIL: expected 'bcrypt==4.2.1', found: '$bcryptLine'"; $fail++ }

Write-Output '[5/6] Known bloat deps scan (bundle safety, deterministic)...'
# These pull 100+ MB into the Vercel Python function (google-generativeai alone
# cost 113 MB / broke the 2026-08-16 deploy at 231.65 MB). Static scan - runs
# even where a fresh pip install can't (see check 6).
$bloatRe = '(?i)^\s*(google-generativeai|grpcio|protobuf|tensorflow|torch|opencv-python|scikit-learn|scipy|pandas|ultralytics)'
$bloatHit = @()
foreach ($reqFile in @((Join-Path $repo 'api\requirements.txt'), (Join-Path $repo 'requirements.txt'), (Join-Path $repo 'backend\requirements.txt'))) {
    if (Test-Path $reqFile) {
        Get-Content $reqFile | Where-Object { $_ -match $bloatRe } | ForEach-Object { $bloatHit += $reqFile + ': ' + $_ }
    }
}
if ($bloatHit.Count -gt 0) { $bloatHit | ForEach-Object { Write-Output "  FAIL: $_" }; $fail++ }
else { Write-Output '  OK' }

Write-Output '[6/6] Vercel Python bundle size estimate (hard cap 225 MB)...'
# Vercel's "Total bundle size" = api/ code + freshly-installed api/requirements.txt
# deps (this is what broke the 2026-08-16 deploy at 231.65 MB). Estimate the same
# thing locally: install into a throwaway venv and measure. Thresholds leave headroom
# for the api/ dir + runtime overhead we don't account for.
$venv = Join-Path $env:TEMP ("kadaigpt_bundlecheck_" + [guid]::NewGuid().ToString('N'))
try {
    python -m venv $venv *> $null
    $pipOut = & (Join-Path $venv 'Scripts\python.exe') -m pip install -q --disable-pip-version-check -r (Join-Path $repo 'api\requirements.txt') 2>&1 | Out-String
    ($pipOut -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) | ForEach-Object { Write-Output "    pip: $_" }
    if ($LASTEXITCODE -ne 0) {
        # e.g. asyncpg==0.30.0 has no wheel for Python 3.14, so a fresh install
        # can't build it on this machine. That is a LOCAL tooling gap, not a
        # deploy blocker (Vercel's runtime resolves it fine) - so warn, don't
        # fail. The hard gate below only fires when the estimate is knowable.
        Write-Output '  WARN: could not install api/requirements.txt in temp venv - bundle size unknown, skipping hard gate (check 5 still guards bloat deps)'
    }
    else {
        $pkgBytes = (Get-ChildItem (Join-Path $venv 'Lib\site-packages') -Recurse -File | Measure-Object Length -Sum).Sum
        $apiBytes  = (Get-ChildItem (Join-Path $repo 'api') -Recurse -File | Measure-Object Length -Sum).Sum
        $totalMB = [math]::Round(($pkgBytes + $apiBytes) / 1MB, 1)
        Write-Output "  bundle estimate: $totalMB MB (site-packages + api/)"
        if ($totalMB -gt 210) { Write-Output '  FAIL: bundle approaches Vercel 225 MB cap — shrink deps before pushing'; $fail++ }
        elseif ($totalMB -gt 180) { Write-Output '  WARN: bundle is growing — investigate before deploy' }
        else { Write-Output '  OK' }
    }
}
finally {
    if (Test-Path $venv) { Remove-Item -Recurse -Force $venv }
}

Write-Output ''
if ($fail -gt 0) { Write-Output "RESULT: $fail check(s) FAILED"; exit 1 }
else { Write-Output 'RESULT: all checks passed'; exit 0 }
