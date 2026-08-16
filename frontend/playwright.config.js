/**
 * KadaiGPT - Playwright E2E Test Configuration
 * Tests critical user flows: login, billing, products, navigation
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 30000,
    // One shared owner account for specs that just need "a logged-in owner"
    // (keeps the suite under the 5 auth-requests/min backend rate limit).
    globalSetup: './tests/e2e/global-setup.js',

    use: {
        baseURL: 'http://localhost:5173',
        // Most specs boot already logged in via the shared account. Specs that
        // need a clean slate override with test.use({ storageState: ... }).
        storageState: 'test-results/e2e-auth-state.json',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],

    webServer: [
        // FastAPI backend on a dedicated e2e database (never the dev kadaigpt.db).
        // Only the offline-billing spec needs it, but the suite is cheaper to
        // keep hermetic than to special-case.
        {
            // app.main (not backend/main.py): the canonical app with the
            // /api/ping + /api/health routes the frontend warmup pings.
            command: 'python -m uvicorn app.main:app --port 8000',
            url: 'http://localhost:8000/docs',
            cwd: '../backend',
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
            env: {
                ...process.env,
                DATABASE_URL: 'sqlite+aiosqlite:///./kadaigpt_e2e.db',
                APP_ENV: 'development',
                // The suite registers several accounts in parallel (shared
                // account + fresh stores per spec) — give the e2e backend
                // headroom. Production keeps the 5/min default.
                AUTH_RATE_LIMIT_PER_MINUTE: '50',
                RATE_LIMIT_PER_MINUTE: '1000',
                // Windows console is cp1252; the backend module-level prints
                // emoji and dies with UnicodeEncodeError otherwise.
                PYTHONIOENCODING: 'utf-8',
            },
        },
        {
            command: 'npm run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    ],
})
