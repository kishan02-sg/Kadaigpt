/**
 * KadaiGPT E2E Tests — Critical Flow: Billing
 * Tests bill creation (online), cart management, and the bills list page
 * using the shared owner account + seeded product catalog from global-setup.js.
 */

import { test, expect } from '@playwright/test'

test.describe('Billing Flow', () => {

    test('should navigate to create bill page and see the seeded catalog', async ({ page }) => {
        await page.goto('/#create-bill')
        const search = page.locator('input[placeholder="Search products by name..."]')
        await expect(search).toBeVisible({ timeout: 15000 })

        // The shared store was seeded with products in global-setup.js.
        await search.fill('E2E Rice')
        // Generous timeout — under full-suite parallel load the products
        // fetch can lag, and a flaky miss fails the whole flow.
        await expect(page.locator('.product-item').first()).toBeVisible({ timeout: 25000 })
    })

    test('should display bills list page', async ({ page }) => {
        await page.goto('/#bills')
        await expect(page.locator('.page-title').filter({ hasText: /all bills/i })).toBeVisible({ timeout: 15000 })
    })

    test('should create a bill online and see it in the bills list', async ({ page }) => {
        await page.goto('/#create-bill')

        // Add the seeded product to the cart.
        const search = page.locator('input[placeholder="Search products by name..."]')
        await expect(search).toBeVisible({ timeout: 15000 })
        await search.fill('E2E Rice')
        await expect(page.locator('.product-item').first()).toBeVisible({ timeout: 25000 })
        await page.locator('.product-item').first().click()

        const qtyAdd = page.getByRole('button', { name: /add to cart/i })
        if (await qtyAdd.isVisible().catch(() => false)) {
            await qtyAdd.click()
        }
        await page.waitForTimeout(800)

        // Save the bill — the online path opens the payment/preview modal.
        await page.locator('.cf-generate').click()
        const paymentModal = page.locator('.payment-modal, .preview-modal').first()
        await expect(paymentModal).toBeVisible({ timeout: 25000 })

        // Close the modal and confirm the bill shows up in the bills list.
        const closeBtn = page.locator('.payment-modal .modal-close, .preview-modal .modal-close').first()
        if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click()
        }
        await page.goto('/#bills')
        await expect(page.locator('.page-title').filter({ hasText: /all bills/i })).toBeVisible({ timeout: 15000 })
        // At least one bill row exists (the one we just created).
        await expect(page.locator('tbody tr, .bill-row, .bills-table tr').first()).toBeVisible({ timeout: 20000 })
    })
})
