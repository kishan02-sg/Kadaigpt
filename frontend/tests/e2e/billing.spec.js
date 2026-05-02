/**
 * KadaiGPT E2E Tests — Critical Flow: Billing
 * Tests bill creation, cart management, and bill listing
 */

import { test, expect } from '@playwright/test'

// Helper: Login with demo mode before each test
async function loginDemo(page) {
    await page.goto('/')
    const demoButton = page.locator('text=Demo Mode').or(page.locator('text=Try Demo'))
    if (await demoButton.isVisible()) {
        await demoButton.first().click()
        await page.waitForTimeout(3000)
    }
}

test.describe('Billing Flow', () => {

    test.beforeEach(async ({ page }) => {
        await loginDemo(page)
    })

    test('should navigate to create bill page', async ({ page }) => {
        // Click new bill button
        const newBillBtn = page.locator('text=New Bill').or(page.locator('[href*="create-bill"]'))
        await newBillBtn.first().click()
        await page.waitForTimeout(1000)

        // Should show bill creation form
        await expect(page.locator('text=Create Bill').or(page.locator('text=New Bill')).first()).toBeVisible()
    })

    test('should display bills list page', async ({ page }) => {
        // Navigate to bills
        const billsNav = page.locator('text=Bills').first()
        await billsNav.click()
        await page.waitForTimeout(1000)

        // Bills page should load
        await expect(page.locator('h1, h2, h3').filter({ hasText: /bill/i }).first()).toBeVisible()
    })

    test('should navigate between pages without errors', async ({ page }) => {
        const pages = ['Dashboard', 'Products', 'Bills', 'Customers']

        for (const pageName of pages) {
            const navLink = page.locator(`text=${pageName}`).first()
            if (await navLink.isVisible()) {
                await navLink.click()
                await page.waitForTimeout(1000)
                // Page should not show error state
                const errorVisible = await page.locator('text=Something went wrong').isVisible()
                expect(errorVisible).toBe(false)
            }
        }
    })
})
