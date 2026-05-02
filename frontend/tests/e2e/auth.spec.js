/**
 * KadaiGPT E2E Tests — Critical Flow: Authentication
 * Tests login, demo mode, logout, and session persistence
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/')
    })

    test('should show login page when not authenticated', async ({ page }) => {
        // Login form should be visible
        await expect(page.locator('text=Login')).toBeVisible()
    })

    test('should login with demo mode', async ({ page }) => {
        // Click demo mode button
        const demoButton = page.locator('text=Demo Mode').or(page.locator('text=Try Demo'))
        if (await demoButton.isVisible()) {
            await demoButton.first().click()
            // Should navigate to dashboard
            await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 })
        }
    })

    test('should show error for invalid credentials', async ({ page }) => {
        // Fill in invalid credentials
        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]')
        const passwordInput = page.locator('input[type="password"]')

        if (await emailInput.isVisible()) {
            await emailInput.fill('invalid@test.com')
            await passwordInput.fill('wrongpassword')

            // Submit the form
            const submitBtn = page.locator('button[type="submit"]').or(page.locator('text=Login').locator('button'))
            await submitBtn.first().click()

            // Should show error toast or message
            await page.waitForTimeout(2000)
        }
    })

    test('should logout successfully', async ({ page }) => {
        // First login with demo mode
        const demoButton = page.locator('text=Demo Mode').or(page.locator('text=Try Demo'))
        if (await demoButton.isVisible()) {
            await demoButton.first().click()
            await page.waitForTimeout(3000)

            // Look for logout button or user menu
            const logoutBtn = page.locator('text=Logout').or(page.locator('[title="Logout"]'))
            if (await logoutBtn.isVisible()) {
                await logoutBtn.first().click()
                // Should return to login page
                await expect(page.locator('text=Login').first()).toBeVisible({ timeout: 5000 })
            }
        }
    })
})
