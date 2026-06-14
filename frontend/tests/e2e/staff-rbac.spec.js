/**
 * KadaiGPT — Staff Login RBAC (All Roles)
 *
 * Registers a fresh owner, creates one staff member per role (manager,
 * cashier, inventory_manager), then logs in as each staff member via the
 * "Staff" login tab and verifies the top navbar matches that role's
 * config in src/config/roles.js (RBAC nav whitelist).
 *
 * NOTE: /auth/* endpoints are rate-limited to 5 req/min/IP (sliding 60s
 * window, GET /auth/staff/list also counts since it matches "/auth/").
 * Test 1's call pattern per role-creation: 1x create-staff + 1x
 * /auth/staff/list (StaffManagement re-fetches the list on success).
 * StaffManagement's mount effect ALSO calls /auth/staff/list, and
 * <StrictMode> (main.jsx) double-invokes mount effects in dev, so the
 * initial page load alone burns 2 extra calls.
 *   register(1) + staff/list-mount x2 (2,3) + create-staff manager(4) +
 *   staff/list(5)  => already at 5/5 for this window.
 * So each subsequent role's [create-staff + staff/list] pair (calls 6-7,
 * 8-9) must land in a FRESH window — wait 75s between roles so the prior
 * cluster ages out of the 60s window before the next one starts.
 * Each per-role login test below makes 2 auth calls (staff-login +
 * /auth/me) and starts with a ~65s wait so its window never overlaps the
 * previous test's window. Total runtime is ~6-7 minutes — do not re-run
 * this spec repeatedly within a few minutes or the IP will be
 * rate-limited / temporarily blocked.
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const OUT_DIR = path.join(process.cwd(), 'test-results', 'staff-rbac')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
const CREDS_FILE = path.join(OUT_DIR, 'staff-credentials.json')

const RUN_ID = Date.now()
const OWNER_EMAIL = `qa.rbac+${RUN_ID}@example.com`
const OWNER_PASSWORD = 'Kadai@2026'
const OWNER_FULLNAME = 'RBAC QA Owner'
const OWNER_STORE = `RBAC QA Store ${RUN_ID}`

async function shot(page, name) {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true })
}

async function dismissOnboarding(page) {
    const onboardingCta = page.getByRole('button', { name: /KadaiGPT चालू करें|get started|start now|चालू करें/i }).first()
    if (await onboardingCta.isVisible().catch(() => false)) {
        await onboardingCta.click()
        await page.waitForTimeout(500)
    }
    const onboardingOverlay = page.locator('.onboarding-overlay').first()
    if (await onboardingOverlay.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
    }
}

// Top-navbar items each role should see — from src/config/roles.js `nav`
// arrays. Only top-level nav buttons render `aria-label`; "More" dropdown
// items do not, so this checks the always-visible nav bar.
const ROLE_NAV_VISIBLE = {
    manager: ['Dashboard', 'New Bill', 'Bills', 'Products', 'Customers', 'Staff'],
    cashier: ['New Bill', 'Bills', 'Products', 'Customers', 'Loyalty'],
    inventory_manager: ['Dashboard', 'Products', 'Suppliers', 'Import/Export', 'Analytics'],
}

// Top-navbar items belonging to OTHER roles that must NOT be visible
const ROLE_NAV_HIDDEN = {
    manager: ['Loyalty', 'Suppliers', 'Import/Export'],
    cashier: ['Dashboard', 'Staff', 'Suppliers', 'Import/Export', 'Analytics'],
    inventory_manager: ['Staff', 'New Bill', 'Bills', 'Customers', 'Loyalty'],
}

const STAFF_ROLES = ['manager', 'cashier', 'inventory_manager']

test.describe.configure({ mode: 'serial' })

test('Owner registers and creates staff for all 3 roles', async ({ page }) => {
    test.setTimeout(240000)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Switch to registration mode
    await page.getByRole('button', { name: /sign up free/i }).click()
    await expect(page.locator('#fullname')).toBeVisible()

    await page.fill('#fullname', OWNER_FULLNAME)
    await page.fill('#email', OWNER_EMAIL)
    await page.fill('#storename', OWNER_STORE)
    await page.fill('#password', OWNER_PASSWORD)
    await page.locator('.checkbox-btn').click()
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForTimeout(3000)
    await shot(page, '01-owner-registered')

    await dismissOnboarding(page)

    // Go to Staff page
    await page.evaluate(() => { window.location.hash = '#staff' })
    await page.waitForTimeout(1500)
    await shot(page, '02-staff-page')

    const created = {}
    for (let i = 0; i < STAFF_ROLES.length; i++) {
        const role = STAFF_ROLES[i]

        // Rate-limit safety: see file header. Each role's create-staff +
        // staff/list refresh is a 2-call cluster; wait for the previous
        // cluster to age out of the 60s window before the next one.
        if (i > 0) await page.waitForTimeout(75000)

        await page.getByRole('button', { name: /add staff/i }).first().click()
        await page.waitForTimeout(500)

        // The radio input itself is hidden (.role-option input { display: none })
        // so click its visible parent <label class="role-option"> instead.
        await page.locator(`label.role-option:has(input[value="${role}"])`).click()
        await page.locator("input[placeholder=\"Enter staff member's name\"]").fill(`RBAC ${role}`)
        await shot(page, `03-create-staff-${role}-filled`)

        await page.getByRole('button', { name: /create staff/i }).click()
        await page.waitForTimeout(1500)
        await shot(page, `04-staff-created-${role}`)

        const staffId = (await page.locator('.staff-id-big').textContent())?.trim()
        const tempPassword = (await page.locator('.temp-pass').textContent())?.trim()
        expect(staffId, `staff_id should be generated for ${role}`).toMatch(/^KDG-/)
        expect(tempPassword, `temporary_password should be generated for ${role}`).toBeTruthy()
        created[role] = { staffId, tempPassword }

        await page.getByRole('button', { name: /^done$/i }).click()
        await page.waitForTimeout(500)
    }

    fs.writeFileSync(CREDS_FILE, JSON.stringify(created, null, 2))
})

for (const role of STAFF_ROLES) {
    test(`Staff login as ${role} shows correct role-based nav`, async ({ page }) => {
        test.setTimeout(150000)

        // Rate-limit safety: see file header. Wait before this test's first
        // /auth/* call so it lands outside the previous test's 60s window.
        await page.waitForTimeout(65000)

        const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'))
        const { staffId, tempPassword } = creds[role]
        expect(staffId, `staff-credentials.json should have ${role} creds`).toBeTruthy()

        await page.goto('/')
        await page.waitForLoadState('networkidle')

        const staffTab = page.locator('.login-tab', { hasText: 'Staff' })
        await staffTab.click()
        await page.waitForTimeout(300)

        await page.locator('#staffid').fill(staffId)
        await page.locator('#password').fill(tempPassword)
        await shot(page, `10-${role}-login-filled`)

        await page.getByRole('button', { name: /sign in/i }).click()
        await page.waitForTimeout(2500)
        await shot(page, `11-${role}-dashboard`)

        await dismissOnboarding(page)

        const nav = page.locator('nav.nav-links')
        await expect(nav).toBeVisible()

        for (const label of ROLE_NAV_VISIBLE[role]) {
            await expect(nav.locator(`.nav-link[aria-label="${label}"]`), `${role} should see "${label}"`).toBeVisible()
        }
        for (const label of ROLE_NAV_HIDDEN[role]) {
            await expect(nav.locator(`.nav-link[aria-label="${label}"]`), `${role} should NOT see "${label}"`).toHaveCount(0)
        }

        await shot(page, `12-${role}-nav-verified`)
    })
}
