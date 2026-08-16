/**
 * KadaiGPT E2E — Offline Billing Loop
 *
 * Proves the full offline → pending → reconnect → sync → server flow:
 *   1. A bill saved while offline is written to localStorage
 *      (kadaigpt_offline_bills), shows a distinct "saved offline" toast, and
 *      appears in the Bills list with a 📥 Pending Sync badge.
 *   2. Going back online auto-syncs the queued POST (fresh token at sync
 *      time), removes the offline bill record, and the bill lands in the
 *      server's bills table EXACTLY once — one POST and one OFL- row (the
 *      server prefixes offline-synced bills with OFL).
 *
 * Requires the FastAPI backend (started by playwright.config.js webServer on
 * a dedicated e2e database) plus the vite dev server on :5173.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000/api/v1'
const PRODUCT_NAME = 'E2E Offline Sugar 1kg'

// Each test registers its own store, so runs are independent and stay well
// under the 5 auth-requests/min rate limit (exactly 1 register, 0 logins).
async function registerFreshStore(request) {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const res = await request.post(`${API}/auth/register`, {
        data: {
            email: `offline.e2e.${stamp}@example.com`,
            password: 'Kadai@2026',
            full_name: 'Offline QA Tester',
            store_name: `Offline QA Store ${stamp}`,
            business_type: 'general',
        },
    })
    expect(res.ok(), `register failed: ${await res.text()}`).toBeTruthy()
    const body = await res.json()
    return { token: body.access_token, storeName: body.store.name }
}

async function seedProduct(request, token) {
    const res = await request.post(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: PRODUCT_NAME, selling_price: 45, current_stock: 10, tax_rate: 5 },
    })
    expect(res.ok(), `seed product failed: ${await res.text()}`).toBeTruthy()
    return res.json()
}

// Idempotent per-navigation setup — deliberately never touches the offline
// queue keys, so a mid-test reload doesn't wipe the pending bill.
async function loginAs(page, token, storeName) {
    await page.addInitScript(({ token, storeName }) => {
        localStorage.setItem('kadai_token', token)
        localStorage.setItem('kadai_user_role', 'owner')
        localStorage.setItem('kadai_store_name', storeName)
        localStorage.setItem('kadai_onboarding_complete', 'true')
        localStorage.removeItem('kadai_demo_mode')
    }, { token, storeName })
}

test.describe('Offline billing loop', () => {
    test('save bill offline → Pending Sync → reconnect → lands in server list exactly once', async ({ page, context, request }) => {
        test.setTimeout(90000)

        const { token, storeName } = await registerFreshStore(request)
        await seedProduct(request, token)
        await loginAs(page, token, storeName)

        // ── Boot the app as the freshly registered owner ──
        // Viewport-agnostic boot checks: the desktop nav "Dashboard" label is
        // hidden on mobile, so wait for the warmup splash to resolve AND the
        // login form to be gone instead.
        await page.goto('/')
        await expect(page.getByText(/server is waking up/i)).toHaveCount(0, { timeout: 30000 })
        await expect(page.locator('#email, input[type="email"]')).toHaveCount(0, { timeout: 15000 })

        // ── Create Bill: search the seeded product and add it to the cart ──
        await page.evaluate(() => { window.location.hash = '#create-bill' })
        const billSearch = page.locator('input[placeholder="Search products by name..."]')
        await expect(billSearch).toBeVisible({ timeout: 15000 })
        await billSearch.fill('E2E Offline Sugar')
        // Generous timeout: under full-suite parallel load the products fetch
        // can take a while, and a flaky miss here fails the whole offline loop.
        await expect(page.locator('.product-item').first()).toBeVisible({ timeout: 25000 })
        await page.locator('.product-item').first().click()
        const qtyAdd = page.getByRole('button', { name: /add to cart/i })
        if (await qtyAdd.isVisible().catch(() => false)) {
            await qtyAdd.click()
        }
        await page.waitForTimeout(800)

        // ── Go offline and save the bill ──
        await context.setOffline(true)
        await page.locator('.cf-generate').click()

        // Distinct offline toast (never the green "created" success one)
        await expect(page.getByText(/saved offline/i).first()).toBeVisible({ timeout: 5000 })

        // localStorage: the bill is queued, plus the POST for later sync
        const offlineState = await page.evaluate(() => ({
            bills: JSON.parse(localStorage.getItem('kadaigpt_offline_bills') || '[]'),
            queue: JSON.parse(localStorage.getItem('kadaigpt_sync_queue') || '[]'),
        }))
        expect(offlineState.bills.length).toBe(1)
        expect(offlineState.bills[0].status).toBe('pending_sync')
        expect(offlineState.bills[0].is_offline).toBe(true)
        expect(offlineState.queue.length).toBe(1)
        expect(offlineState.queue[0].method).toBe('POST')
        expect(offlineState.queue[0].url).toContain('/api/v1/bills')
        expect(offlineState.queue[0].body).toContain('local_id')

        // ── Bills list shows the pending bill while still offline ──
        await page.evaluate(() => { window.location.hash = '#bills' })
        await expect(page.getByText('📥 Pending Sync').first()).toBeVisible({ timeout: 20000 })

        // ── Reconnect → auto-sync (no user action) ──
        // Count only the original POSTs (not the trailing-slash 307 follow-up).
        let originalBillPosts = 0
        page.on('request', (req) => {
            if (req.method() === 'POST' && req.url().includes('/api/v1/bills') && !req.redirectedFrom()) {
                originalBillPosts++
            }
        })
        await context.setOffline(false)

        // The queue drains by itself via App.jsx + offlineSync reconnect handlers.
        await expect.poll(() => page.evaluate(() =>
            JSON.parse(localStorage.getItem('kadaigpt_offline_bills') || '[]').length
        ), { timeout: 45000 }).toBe(0)
        await expect.poll(() => page.evaluate(() =>
            JSON.parse(localStorage.getItem('kadaigpt_sync_queue') || '[]').length
        ), { timeout: 45000 }).toBe(0)

        // Server-side: exactly one OFL- bill landed (offline bills get an OFL
        // prefix), with the right amount — ₹45 + 5% GST = ₹47.25.
        const billsRes = await request.get(`${API}/bills`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        expect(billsRes.ok()).toBeTruthy()
        const bills = await billsRes.json()
        const synced = bills.filter((b) => (b.bill_number || '').startsWith('OFL-'))
        expect(synced.length).toBe(1)
        expect(synced[0].total_amount).toBeCloseTo(45 * 1.05, 1)
        expect(originalBillPosts).toBe(1) // exactly one POST → exactly one row

        // ── The synced bill shows in the UI, offline badge gone ──
        await page.reload()
        await page.evaluate(() => { window.location.hash = '#bills' })
        await expect(page.getByText(synced[0].bill_number).first()).toBeVisible({ timeout: 15000 })
        await expect(page.getByText('📥 Pending Sync')).toHaveCount(0)
    })
})
