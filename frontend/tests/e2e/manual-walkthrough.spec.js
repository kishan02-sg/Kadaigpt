/**
 * KadaiGPT — Manual Shopkeeper Walkthrough (Evidence-Based QA)
 *
 * Single sequential test that drives the real UI end-to-end like a real
 * shopkeeper would: register -> dashboard -> products -> create bill ->
 * bills -> customers -> analytics -> gst -> notifications -> settings ->
 * staff -> staff login (RBAC) -> mobile viewport.
 *
 * Screenshots + a JSON log of console errors / failed network calls are
 * written to test-results/e2e-manual/.
 *
 * NOTE: auth endpoints are rate-limited to 5 req/min/IP — this spec makes
 * exactly ONE register call and ONE staff-login call. Do not re-run this
 * spec repeatedly within a minute.
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const OUT_DIR = path.join(process.cwd(), 'test-results', 'e2e-manual')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const RUN_ID = Date.now()
const TEST_EMAIL = `qa.tester+kadai${RUN_ID}@example.com`
const TEST_PASSWORD = 'Kadai@2026'
const TEST_FULLNAME = 'QA Tester'
const TEST_STORE = `QA Kirana Store ${RUN_ID}`

// Collected across the whole run
const consoleErrors = []
const networkErrors = []

function logIssue(arr, entry) {
    arr.push(entry)
    console.log('[ISSUE]', JSON.stringify(entry))
}

async function shot(page, name) {
    const file = path.join(OUT_DIR, `${name}.png`)
    await page.screenshot({ path: file, fullPage: true })
    return file
}

test.describe.configure({ mode: 'serial' })

test('Full shopkeeper walkthrough', async ({ page }, testInfo) => {
    test.setTimeout(180000)

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            logIssue(consoleErrors, { step: testInfo.annotations.length, text: msg.text(), url: page.url() })
        }
    })
    page.on('response', (res) => {
        if (res.status() >= 400) {
            logIssue(networkErrors, { status: res.status(), url: res.url(), pageUrl: page.url() })
        }
    })

    // ─────────────────────────────────────────────
    // STEP 1: Registration
    // ─────────────────────────────────────────────
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await shot(page, '01-login-page')

    // Switch to registration mode
    await page.getByRole('button', { name: /sign up free/i }).click()
    await expect(page.locator('#fullname')).toBeVisible()

    await page.fill('#fullname', TEST_FULLNAME)
    await page.fill('#email', TEST_EMAIL)
    await page.fill('#storename', TEST_STORE)
    await page.fill('#password', TEST_PASSWORD)

    // Accept terms checkbox
    await page.locator('.checkbox-btn').click()
    await shot(page, '01b-registration-filled')

    // Submit
    await page.getByRole('button', { name: /create account/i }).click()

    // Wait for dashboard to load (hash-based routing, no URL change expected necessarily)
    await page.waitForTimeout(3000)
    await shot(page, '02-after-registration')

    // Dismiss first-time onboarding overlay/wizard if present (new accounts
    // get a "Get Started" modal with a "KadaiGPT चालू करें" CTA that covers
    // the whole screen and blocks nav clicks until closed).
    const onboardingCta = page.getByRole('button', { name: /KadaiGPT चालू करें|get started|start now|चालू करें/i }).first()
    if (await onboardingCta.isVisible().catch(() => false)) {
        await shot(page, '02b-onboarding-overlay')
        await onboardingCta.click()
        await page.waitForTimeout(500)
    }
    const onboardingOverlay = page.locator('.onboarding-overlay').first()
    if (await onboardingOverlay.isVisible().catch(() => false)) {
        // Fallback: force-remove via Escape or close button if CTA didn't dismiss it
        const closeBtn = page.locator('.onboarding-overlay .modal-close, .onboarding-overlay button[aria-label="Close"]').first()
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click()
        } else {
            await page.keyboard.press('Escape')
        }
        await page.waitForTimeout(500)
    }

    // ─────────────────────────────────────────────
    // STEP 2: Dashboard
    // ─────────────────────────────────────────────
    await page.waitForLoadState('networkidle').catch(() => {})
    await shot(page, '03-dashboard')

    // ─────────────────────────────────────────────
    // STEP 3: Products / Inventory — add a product
    // ─────────────────────────────────────────────
    // Navigate via nav item
    const productsNav = page.locator('[id*="products"], a[href="#products"], button:has-text("Products")').first()
    if (await productsNav.isVisible().catch(() => false)) {
        await productsNav.click()
    } else {
        await page.evaluate(() => { window.location.hash = '#products' })
    }
    await page.waitForTimeout(1500)
    await shot(page, '04-products-page-empty')

    const addProductBtn = page.getByRole('button', { name: /add product/i }).first()
    await addProductBtn.click()
    await page.waitForTimeout(500)
    await shot(page, '05-add-product-modal')

    const PRODUCT_NAME = 'Tata Salt 1kg'
    await page.locator('input[placeholder="e.g., Basmati Rice"]').fill(PRODUCT_NAME)
    await page.locator('input[placeholder="0"]').first().fill('28') // Price
    // Current Stock is the 2nd "0" placeholder
    const zeroInputs = page.locator('input[placeholder="0"]')
    await zeroInputs.nth(1).fill('50') // Current Stock

    await shot(page, '06-add-product-filled')

    await page.getByRole('button', { name: /^add product$/i }).last().click()
    await page.waitForTimeout(1500)
    await shot(page, '07-product-added')

    // Verify it appears in the list
    const productInList = page.getByText(PRODUCT_NAME, { exact: false }).first()
    const productVisible = await productInList.isVisible().catch(() => false)
    console.log(`[CHECK] Product "${PRODUCT_NAME}" visible in list: ${productVisible}`)

    // ─────────────────────────────────────────────
    // STEP 4: Create Bill — add product to cart, save
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#create-bill' })
    await page.waitForTimeout(1500)
    await shot(page, '08-create-bill-page')

    // Search for the product
    const billSearch = page.locator('input[placeholder="Search products by name..."]')
    await billSearch.fill('Tata Salt')
    await page.waitForTimeout(800)
    await shot(page, '09-create-bill-search')

    // Click the product card to add to cart
    const productCard = page.locator('.product-item').first()
    const cardVisible = await productCard.isVisible().catch(() => false)
    console.log(`[CHECK] Product card visible in Create Bill: ${cardVisible}`)
    if (cardVisible) {
        await productCard.click()
        await page.waitForTimeout(800)
    }
    await shot(page, '10-create-bill-cart')

    // Handle quantity modal if it appears
    const qtyModalAddBtn = page.getByRole('button', { name: /add to cart/i })
    if (await qtyModalAddBtn.isVisible().catch(() => false)) {
        await qtyModalAddBtn.click()
        await page.waitForTimeout(800)
        await shot(page, '10b-create-bill-cart-after-qty')
    }

    // Click the generate/save bill button (cf-generate)
    const generateBtn = page.locator('.cf-generate')
    let billSaved = false
    if (await generateBtn.isVisible().catch(() => false)) {
        await shot(page, '11-cart-before-save')
        await generateBtn.click()
        await page.waitForTimeout(2000)
        billSaved = true
    } else {
        console.log('[CHECK] .cf-generate button NOT visible — cart may be empty')
    }
    await shot(page, '12-after-save-bill')

    // Capture any "Bill Created" payment modal / preview
    const previewModal = page.locator('.preview-modal, .payment-modal')
    if (await previewModal.first().isVisible().catch(() => false)) {
        await shot(page, '12b-bill-created-modal')
        // Close the modal if possible
        const closeBtn = page.locator('.modal-close').first()
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click()
            await page.waitForTimeout(500)
        }
    }
    console.log(`[CHECK] Bill save attempted: ${billSaved}`)

    // ─────────────────────────────────────────────
    // STEP 5: Bills list
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#bills' })
    await page.waitForTimeout(1500)
    await shot(page, '13-bills-list')

    // ─────────────────────────────────────────────
    // STEP 6: Customers — add a customer
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#customers' })
    await page.waitForTimeout(1500)
    await shot(page, '14-customers-page-empty')

    const addCustomerBtn = page.getByRole('button', { name: /add customer/i }).first()
    if (await addCustomerBtn.isVisible().catch(() => false)) {
        await addCustomerBtn.click()
        await page.waitForTimeout(500)
        await shot(page, '15-add-customer-modal')

        await page.locator('input[placeholder="Full Name"]').first().fill('Ramesh Kumar')
        await page.locator('input[placeholder*="10-digit mobile"]').first().fill('9876543210')
        await shot(page, '16-add-customer-filled')

        await page.getByRole('button', { name: /^add customer$/i }).last().click()
        await page.waitForTimeout(1500)
    }
    await shot(page, '17-customers-after-add')

    // ─────────────────────────────────────────────
    // STEP 7: Analytics
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#analytics' })
    await page.waitForTimeout(2000)
    await shot(page, '18-analytics')

    // ─────────────────────────────────────────────
    // STEP 8: GST page
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#gst' })
    await page.waitForTimeout(2000)
    await shot(page, '19-gst-page')

    // ─────────────────────────────────────────────
    // STEP 9: Notifications
    // ─────────────────────────────────────────────
    // Go back to dashboard so header is in normal state
    await page.evaluate(() => { window.location.hash = '#dashboard' })
    await page.waitForTimeout(1000)

    const bellBtn = page.locator('.notification-wrapper .icon-btn').first()
    if (await bellBtn.isVisible().catch(() => false)) {
        await bellBtn.click()
        await page.waitForTimeout(800)
        await shot(page, '20-notifications-dropdown')
        // Close the dropdown again so it doesn't intercept clicks on later steps
        await bellBtn.click()
        await page.waitForTimeout(300)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
    } else {
        console.log('[CHECK] Notification bell not visible')
        await shot(page, '20-notifications-not-found')
    }

    // ─────────────────────────────────────────────
    // STEP 10: Settings + Staff creation
    // ─────────────────────────────────────────────
    await page.evaluate(() => { window.location.hash = '#settings' })
    await page.waitForTimeout(1500)
    await shot(page, '21-settings-page')

    await page.evaluate(() => { window.location.hash = '#staff' })
    await page.waitForTimeout(1500)
    await shot(page, '22-staff-page')

    let createdStaffId = null
    let createdStaffTempPassword = null
    const addStaffBtn = page.getByRole('button', { name: /add staff/i }).first()
    if (await addStaffBtn.isVisible().catch(() => false)) {
        await addStaffBtn.click()
        await page.waitForTimeout(500)
        await shot(page, '23-add-staff-modal')

        await page.locator('input[placeholder="Enter staff member\'s name"]').fill('Suresh Cashier')
        await page.locator('input[placeholder="Enter phone number"]').fill('9123456780')
        await shot(page, '24-add-staff-filled')

        await page.getByRole('button', { name: /create staff/i }).click()
        await page.waitForTimeout(2000)
        await shot(page, '25-staff-created')

        // Extract the generated Staff ID and temp password
        const staffIdEl = page.locator('.staff-id-big')
        if (await staffIdEl.isVisible().catch(() => false)) {
            createdStaffId = (await staffIdEl.textContent())?.trim()
            console.log(`[CHECK] Generated Staff ID: ${createdStaffId}`)
        }
        const tempPassEl = page.locator('.temp-pass')
        if (await tempPassEl.isVisible().catch(() => false)) {
            createdStaffTempPassword = (await tempPassEl.textContent())?.trim()
            console.log(`[CHECK] Generated temp password: ${createdStaffTempPassword}`)
        }

        // Close the modal
        const doneBtn = page.getByRole('button', { name: /^done$/i })
        if (await doneBtn.isVisible().catch(() => false)) {
            await doneBtn.click()
            await page.waitForTimeout(500)
        }
    } else {
        console.log('[CHECK] Add Staff button not visible')
    }
    // Safety net: if the Add Staff modal is still open (e.g. create-staff
    // request failed/was rate-limited and "Done" never appeared), close it
    // so it doesn't block subsequent clicks on .user-btn etc.
    const leftoverModal = page.locator('.modal-overlay').first()
    if (await leftoverModal.isVisible().catch(() => false)) {
        const cancelBtn = page.getByRole('button', { name: /^cancel$/i }).first()
        const closeX = page.locator('.modal-overlay .modal-close, .modal-overlay button[aria-label="Close"]').first()
        if (await cancelBtn.isVisible().catch(() => false)) {
            await cancelBtn.click()
        } else if (await closeX.isVisible().catch(() => false)) {
            await closeX.click()
        } else {
            await page.keyboard.press('Escape')
        }
        await page.waitForTimeout(500)
    }
    await shot(page, '26-staff-page-after')

    // Persist staff ID + temp password for reporting and for the staff-login step
    fs.writeFileSync(path.join(OUT_DIR, 'staff-id.json'), JSON.stringify({
        staffId: createdStaffId,
        tempPassword: createdStaffTempPassword,
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    }, null, 2))

    // ─────────────────────────────────────────────
    // STEP 11: Logout + Staff login (RBAC)
    // ─────────────────────────────────────────────
    // Open user menu and logout
    const userBtn = page.locator('.user-btn')
    if (await userBtn.isVisible().catch(() => false)) {
        await userBtn.click()
        await page.waitForTimeout(500)
        await shot(page, '27-user-menu')

        const logoutBtn = page.locator('.logout-btn')
        if (await logoutBtn.isVisible().catch(() => false)) {
            await logoutBtn.click()
            await page.waitForTimeout(1500)
        }
    }
    await shot(page, '28-after-logout')

    if (createdStaffId) {
        // Switch to Staff tab
        const staffTab = page.locator('.login-tab', { hasText: 'Staff' })
        if (await staffTab.isVisible().catch(() => false)) {
            await staffTab.click()
            await page.waitForTimeout(500)
            await shot(page, '29-staff-login-tab')

            await page.locator('#staffid').fill(createdStaffId)
            // We don't know the temp password reliably without reading it earlier — try common default
            // Read from staff-id.json if temp password was captured
            const tempPwData = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'staff-id.json'), 'utf-8'))
            const tempPassword = tempPwData.tempPassword || 'Staff@123'
            await page.locator('#password').fill(tempPassword)
            await shot(page, '30-staff-login-filled')

            await page.getByRole('button', { name: /sign in/i }).click()
            await page.waitForTimeout(2000)
            await shot(page, '31-staff-login-result')
        }
    } else {
        await shot(page, '29-staff-login-skipped')
    }

    // ─────────────────────────────────────────────
    // Write console/network error log
    // ─────────────────────────────────────────────
    fs.writeFileSync(
        path.join(OUT_DIR, 'console-network-errors.json'),
        JSON.stringify({ consoleErrors, networkErrors }, null, 2)
    )
})

// ─────────────────────────────────────────────────
// Mobile viewport walkthrough (separate test, fresh page)
// Uses the project's mobile-chrome (Pixel 5) device when run with that project,
// or a manual 393x851 viewport override otherwise.
// ─────────────────────────────────────────────────
test('Mobile viewport walkthrough', async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 393, height: 851 })

    const mobileConsoleErrors = []
    const mobileNetworkErrors = []
    page.on('console', (msg) => {
        if (msg.type() === 'error') mobileConsoleErrors.push({ text: msg.text(), url: page.url() })
    })
    page.on('response', (res) => {
        if (res.status() >= 400) mobileNetworkErrors.push({ status: res.status(), url: res.url() })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await shot(page, '32-mobile-login')

    // Login with the account created in the first test
    const dataPath = path.join(OUT_DIR, 'staff-id.json')
    let creds = { email: TEST_EMAIL, password: TEST_PASSWORD }
    if (fs.existsSync(dataPath)) {
        const saved = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        creds = { email: saved.email, password: saved.password }
    }

    // Make sure we're on Owner tab + Login mode (default)
    const emailInput = page.locator('#email')
    if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill(creds.email)
        await page.locator('#password').fill(creds.password)
        await shot(page, '33-mobile-login-filled')
        await page.getByRole('button', { name: /sign in/i }).click()
        await page.waitForTimeout(3000)
    }
    await shot(page, '34-mobile-dashboard')

    // Check bottom mobile nav renders
    await shot(page, '35-mobile-nav-visible')

    // Navigate to billing via mobile nav
    await page.evaluate(() => { window.location.hash = '#create-bill' })
    await page.waitForTimeout(1500)
    await shot(page, '36-mobile-create-bill')

    await page.evaluate(() => { window.location.hash = '#products' })
    await page.waitForTimeout(1500)
    await shot(page, '37-mobile-products')

    fs.writeFileSync(
        path.join(OUT_DIR, 'console-network-errors-mobile.json'),
        JSON.stringify({ consoleErrors: mobileConsoleErrors, networkErrors: mobileNetworkErrors }, null, 2)
    )
})
