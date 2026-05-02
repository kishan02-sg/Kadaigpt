/**
 * KadaiGPT - Backend Warm-Up Service
 * 
 * Problem: Render.com free tier spins down after 15 min of inactivity.
 * Cold starts take 30-60 seconds. Users see "fetch failed" errors.
 * 
 * Solution: This service:
 * 1. Pre-pings the backend on page load
 * 2. Retries with exponential backoff if cold-starting
 * 3. Provides status callbacks for loading UI
 * 4. Caches warm status to skip pings on subsequent navigations
 * 
 * Usage:
 *   import { warmup } from './warmup'
 *   const status = await warmup.ensureReady()
 */

const HEALTH_URL = import.meta.env.PROD
    ? '/api/health'
    : 'http://localhost:8000/api/health'

const PING_URL = import.meta.env.PROD
    ? '/api/ping'
    : 'http://localhost:8000/api/ping'

class BackendWarmupService {
    constructor() {
        this._isReady = false
        this._isWarming = false
        this._listeners = []
        this._lastCheck = 0
        this._healthData = null

        // Cache warm status for 10 minutes
        this.CACHE_DURATION_MS = 10 * 60 * 1000
    }

    /**
     * Subscribe to warmup status changes
     * @param {Function} callback - (status: 'checking'|'warming'|'ready'|'error', message: string) => void
     * @returns {Function} unsubscribe
     */
    onStatusChange(callback) {
        this._listeners.push(callback)
        return () => {
            this._listeners = this._listeners.filter(l => l !== callback)
        }
    }

    _notify(status, message = '') {
        this._listeners.forEach(cb => {
            try { cb(status, message) } catch (e) { /* ignore */ }
        })
    }

    /**
     * Check if backend is warm (cached check)
     */
    isReady() {
        if (!this._isReady) return false
        // Check if cache expired
        if (Date.now() - this._lastCheck > this.CACHE_DURATION_MS) {
            this._isReady = false
            return false
        }
        return true
    }

    /**
     * Get last known health data
     */
    getHealthData() {
        return this._healthData
    }

    /**
     * Ensure backend is ready. Warms up if needed.
     * @returns {Promise<{ready: boolean, healthData: object|null, warmupTime: number}>}
     */
    async ensureReady() {
        // Already warm and cache valid
        if (this.isReady()) {
            return { ready: true, healthData: this._healthData, warmupTime: 0 }
        }

        // Don't start multiple warmups
        if (this._isWarming) {
            return this._waitForReady()
        }

        this._isWarming = true
        const startTime = Date.now()

        this._notify('checking', 'Connecting to KadaiGPT server...')

        // Try quick ping first — fastest possible check
        try {
            const quickResp = await fetch(PING_URL, {
                signal: AbortSignal.timeout(3000)
            })
            if (quickResp.ok) {
                this._isReady = true
                this._isWarming = false
                this._lastCheck = Date.now()
                this._notify('ready', 'Connected!')

                // Fetch full health in background
                this._fetchHealthAsync()

                return { ready: true, healthData: null, warmupTime: Date.now() - startTime }
            }
        } catch {
            // Cold start — proceed with warmup
        }

        // Backend is cold — warmup with retries
        this._notify('warming', 'Server is waking up... Please wait (~30 seconds)')

        const MAX_RETRIES = 12  // 12 * 5s = 60 seconds max wait
        const RETRY_DELAY_MS = 5000

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(HEALTH_URL, {
                    signal: AbortSignal.timeout(10000)
                })

                if (response.ok) {
                    const data = await response.json()
                    this._healthData = data
                    this._isReady = true
                    this._isWarming = false
                    this._lastCheck = Date.now()

                    const warmupTime = Date.now() - startTime
                    console.log(`[Warmup] Backend ready in ${warmupTime}ms after ${attempt} attempt(s)`)
                    this._notify('ready', `Connected! (took ${Math.round(warmupTime / 1000)}s)`)

                    return { ready: true, healthData: data, warmupTime }
                }
            } catch {
                // Still waking up
            }

            if (attempt < MAX_RETRIES) {
                const remaining = MAX_RETRIES - attempt
                this._notify('warming',
                    `Server is waking up... (attempt ${attempt}/${MAX_RETRIES}, ~${remaining * 5}s remaining)`)
                await this._sleep(RETRY_DELAY_MS)
            }
        }

        // Failed after all retries
        this._isWarming = false
        this._notify('error', 'Could not connect to server. Please refresh the page.')
        return { ready: false, healthData: null, warmupTime: Date.now() - startTime }
    }

    async _fetchHealthAsync() {
        try {
            const resp = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10000) })
            if (resp.ok) {
                this._healthData = await resp.json()
            }
        } catch { /* ignore */ }
    }

    _waitForReady() {
        return new Promise(resolve => {
            const check = () => {
                if (!this._isWarming) {
                    resolve({ ready: this._isReady, healthData: this._healthData, warmupTime: 0 })
                } else {
                    setTimeout(check, 500)
                }
            }
            check()
        })
    }

    _sleep(ms) {
        return new Promise(r => setTimeout(r, ms))
    }
}

// Global singleton
const warmup = new BackendWarmupService()
export { warmup }
export default warmup
