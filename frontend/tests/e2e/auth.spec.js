/**
 * KadaiGPT E2E Tests — Critical Flow: Authentication
 * Covers the unauthenticated login page, invalid credentials, registration
 * mode, dashboard landing for an authenticated owner, and logout.
 *
 * Authenticated tests use the shared owner account from global-setup.js
 * (storageState); unauthenticated tests override with an empty storage state.
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {

    test.describe('unauthenticated', () => {
        test.use({ storageState: { cookies: [], origins: [] } })

        test.beforeEach(async ({ page }) => {
            await page.goto('/')
        })

        test('should show login page when not authenticated', async ({ page }) => {
            await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
            await expect(page.locator('#email')).toBeVisible()
            await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
        })

        test('should show error for invalid credentials', async ({ page }) => {
            await page.fill('#email', 'invalid@test.com')
            await page.fill('#password', 'wrongpassword')
            await page.getByRole('button', { name: /sign in/i }).click()
            await expect(page.locator('.error-alert')).toBeVisible({ timeout: 10000 })
        })

        test('should switch to registration mode', async ({ page }) => {
            await page.getByRole('button', { name: /sign up free/i }).click()
            await expect(page.locator('#fullname')).toBeVisible()
            await expect(page.locator('#storename')).toBeVisible()
            await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
        })
    })

    test.describe('authenticated (shared e2e account)', () => {

        test('should land on dashboard when authenticated', async ({ page }) => {
            await page.goto('/')
            await expect(page.getByText("Today's Sales").first()).toBeVisible({ timeout: 15000 })
        })

        test('should logout successfully', async ({ page }) => {
            await page.goto('/')
            await expect(page.getByText("Today's Sales").first()).toBeVisible({ timeout: 15000 })

            await page.locator('.user-btn').click()
            await page.locator('.logout-btn').click()

            // Back on the login page, and the token is gone from this context.
            await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 10000 })
            const token = await page.evaluate(() => localStorage.getItem('kadai_token'))
            expect(token).toBeNull()
        })
    })
})
