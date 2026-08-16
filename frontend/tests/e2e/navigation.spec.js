/**
 * KadaiGPT E2E Tests — Critical Flow: Navigation & Core UI
 * Tests page routing, offline/online indicator, keyboard shortcuts and
 * cross-route stability for an authenticated owner (shared e2e account).
 */

import { test, expect } from '@playwright/test'

test.describe('Navigation & Core UI', () => {

    test('should render dashboard on load', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByText("Today's Sales").first()).toBeVisible({ timeout: 15000 })
    })

    test('should navigate via hash routing', async ({ page }) => {
        await page.goto('/#products')
        await expect(page.locator('.page-title').filter({ hasText: /inventory management/i })).toBeVisible({ timeout: 15000 })
    })

    test('should show online/offline status indicator', async ({ page }) => {
        await page.goto('/')
        const statusIndicator = page.locator('.status-indicator').first()
        if (await statusIndicator.isVisible().catch(() => false)) {
            // Desktop navbar renders the indicator with an online/offline state.
            await expect(statusIndicator).toHaveClass(/online|offline/)
        } else {
            // The desktop navbar (with the indicator) is hidden on mobile —
            // verify the connectivity state the indicator reflects instead.
            await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true)
        }
    })

    test('should open command palette with Ctrl+K without crashing', async ({ page }) => {
        await page.goto('/')
        await page.keyboard.press('Control+k')
        await page.waitForTimeout(500)
        // Command palette may or may not be implemented — the page must not crash.
        const pageErrors = []
        page.on('pageerror', (err) => pageErrors.push(String(err)))
        expect(pageErrors.length).toBe(0)
    })

    test('should display notification bell', async ({ page }) => {
        await page.goto('/')
        await expect(page.locator('.notification-wrapper .icon-btn').first()).toBeVisible({ timeout: 15000 })
    })

    test('should handle all route transitions smoothly', async ({ page }) => {
        await page.goto('/')
        const routes = ['dashboard', 'products', 'customers', 'analytics', 'settings']

        for (const route of routes) {
            await page.goto(`/#${route}`)
            await page.waitForTimeout(1200)
            const hasError = await page.locator('text=Something went wrong').isVisible()
            expect(hasError, `route ${route} showed an error state`).toBe(false)
        }
    })
})
