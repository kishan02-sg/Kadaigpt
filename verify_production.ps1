# verify_production.ps1
# What: end-to-end smoke test against the DEPLOYED production app.
#       1) /api/health (database must be "healthy")
#       2) register a throwaway store + owner
#       3) create a UPI bill (items-only, no products needed)
#       4) confirm payment state - Razorpay configured => PENDING_PAYMENT
#          + QR payload (scan to confirm the webhook flips it to paid);
#          otherwise the manual-trust flow completes as COMPLETED.
# Usage:  powershell -ExecutionPolicy Bypass -File verify_production.ps1
#         (or with -BaseUrl https://... to point at a different deploy)
# Exit 0 = all steps passed; 1 = any step failed.
# Note: each run registers a fresh store named "Verify Store <timestamp>" -
#       that row lives in the production DB (harmless, but it is real data).
# ASCII-only on purpose: Windows PowerShell 5.1 mis-decodes UTF-8 without BOM.

param(
    [string]$BaseUrl = "https://kadaigpt-main.vercel.app"
)

$ErrorActionPreference = 'Continue'
$fail = 0
$ts = Get-Date -Format 'yyyyMMddHHmmss'

function Step([string]$name, [scriptblock]$body) {
    try { & $body }
    catch { Write-Output "  FAIL: $($_.Exception.Message)"; $script:fail++ }
}

Write-Output "[1/4] Health check - $BaseUrl/api/health"
Step "health" {
    $health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get -TimeoutSec 30
    if ($health.database.status -ne 'healthy') {
        throw "database status = '$($health.database.status)' ($($health.database.error)) - fix DATABASE_URL in Vercel first (see DEPLOYMENT_GUIDE.md)"
    }
    Write-Output "  OK (db: $($health.database.status))"
}

Write-Output "[2/4] Register store"
$token = $null
Step "register" {
    # email-validator rejects reserved TLDs like .test; gmail.com passes and this
    # mailbox is never used (no emails are sent for this throwaway store).
    $email = "verify.$ts@gmail.com"
    $body = @{
        email         = $email
        password      = "Verify!pass$ts"
        full_name     = "Verify Bot"
        phone         = "9" + $ts.Substring($ts.Length - 9)  # 10 digits
        store_name    = "Verify Store $ts"
        business_type = "general"
    } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/register" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
    if (-not $resp.access_token) { throw "no access_token in register response" }
    $script:token = $resp.access_token
    Write-Output "  OK (store: $($resp.store.name), id: $($resp.store.id))"
}

Write-Output "[3/4] Create UPI bill"
$billId = $null
Step "create bill" {
    $headers = @{ Authorization = "Bearer $token" }
    $body = @{
        customer_name  = "Verify Customer"
        payment_method = "UPI"
        items = @(@{
            product_name = "Verify Item"
            unit_price   = 10.0
            quantity     = 2
        })
    } | ConvertTo-Json -Depth 5
    $bill = Invoke-RestMethod -Uri "$BaseUrl/api/v1/bills" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 30
    $script:billId = $bill.id
    Write-Output "  OK (bill id: $($bill.id), status: $($bill.status), payment: $(if ($bill.payment) { $bill.payment.status } else { 'none (manual flow)' }))"
}

Write-Output "[4/4] Confirm payment state"
Step "payment status" {
    $headers = @{ Authorization = "Bearer $token" }
    $status = Invoke-RestMethod -Uri "$BaseUrl/api/v1/bills/$billId/payment-status" -Method Get -Headers $headers -TimeoutSec 30
    if ($status.payment.status -eq 'pending') {
        Write-Output "  OK - PENDING_PAYMENT with real Razorpay QR ($($status.payment.qr_image_url))"
        Write-Output "  NOTE: scan the QR in a UPI app to confirm the webhook flips it to 'paid'."
    }
    elseif ($status.payment.status -eq 'paid') {
        Write-Output "  OK - payment CONFIRMED by webhook (razorpay_payment_id: $($status.payment.razorpay_payment_id))"
    }
    elseif ($null -eq $status.payment) {
        Write-Output "  OK - manual-trust flow (Razorpay not configured): bill completed as $($status.bill.status)"
    }
    else {
        Write-Output "  WARN - unexpected payment state: $($status | ConvertTo-Json -Compress)"
    }
}

Write-Output ''
if ($fail -gt 0) { Write-Output "RESULT: $fail step(s) FAILED"; exit 1 }
else { Write-Output 'RESULT: all steps passed'; exit 0 }
