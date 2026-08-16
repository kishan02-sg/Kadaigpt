/**
 * KadaiGPT E2E — Global Setup
 *
 * Registers ONE shared owner account (with a seeded product catalog) via the
 * backend API and persists it as a Playwright storageState file. Specs that
 * only need "a logged-in owner" (auth, navigation, billing) consume this via
 * `use.storageState` — zero auth-rate-limit calls per test, since every app
 * boot would otherwise hit POST/GET /auth/*.
 *
 * Specs that mutate store data (offline-billing) or test registration/staff
 * flows (staff-rbac, manual-walkthrough) register their own accounts — the
 * auth bucket (5/min/IP) has room because this file adds just one register.
 *
 * Runs after webServer is up; the state file lands in gitignored
 * test-results/.
 */

import { request } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const API = 'http://localhost:8000/api/v1'
const STATE_FILE = path.join(process.cwd(), 'test-results', 'e2e-auth-state.json')

export default async function globalSetup() {
    // NOTE: full URLs, not '/auth/register' — Playwright resolves a leading-
    // slash path against the origin, dropping the /api/v1 baseURL path.
    const api = await request.newContext({ baseURL: API })
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const email = `e2e.shared.${stamp}@example.com`

    const registerRes = await api.post(`${API}/auth/register`, {
        data: {
            email,
            password: 'Kadai@2026',
            full_name: 'E2E Shared Owner',
            store_name: `E2E Shared Store ${stamp}`,
            business_type: 'general',
        },
    })
    if (!registerRes.ok()) {
        throw new Error(`[globalSetup] register failed (${registerRes.status()}): ${await registerRes.text()}`)
    }
    const body = await registerRes.json()
    const { access_token: token, store } = body

    // Seed a small catalog so product/bill pages render real rows.
    for (const [name, price, stock] of [
        ['E2E Rice 5kg', 240, 50],
        ['E2E Sugar 1kg', 45, 30],
        ['E2E Oil 1L', 160, 20],
    ]) {
        const res = await api.post(`${API}/products`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { name, selling_price: price, current_stock: stock, tax_rate: 5 },
        })
        if (!res.ok()) {
            throw new Error(`[globalSetup] seed product failed (${res.status()}): ${await res.text()}`)
        }
    }

    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify({
        cookies: [],
        origins: [{
            origin: 'http://localhost:5173',
            localStorage: [
                { name: 'kadai_token', value: token },
                { name: 'kadai_user_role', value: 'owner' },
                { name: 'kadai_store_name', value: store.name },
                { name: 'kadai_onboarding_complete', value: 'true' },
            ],
        }],
    }))

    await api.dispose()
    console.log(`[globalSetup] shared owner ready: ${email} (${store.name})`)
}
