/**
 * KadaiGPT - Offline Sync Service
 * Manages offline data storage, sync queue, and connectivity detection
 * 
 * Uses localStorage as a lightweight sync queue (IndexedDB can be added later)
 */

const SYNC_QUEUE_KEY = 'kadaigpt_sync_queue'
const OFFLINE_DATA_KEY = 'kadaigpt_offline_data'

class OfflineSyncService {
    constructor() {
        this.isOnline = navigator.onLine
        this.syncInProgress = false
        this.listeners = new Set()

        // Listen for connectivity changes
        window.addEventListener('online', () => this._handleOnline())
        window.addEventListener('offline', () => this._handleOffline())

        // Listen for SW messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'QUEUE_OFFLINE_REQUEST') {
                    this.addToQueue(event.data.data)
                } else if (event.data.type === 'PROCESS_SYNC_QUEUE') {
                    this.processQueue()
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Connectivity Detection
    // ═══════════════════════════════════════════════════════════

    get online() {
        return this.isOnline
    }

    onConnectivityChange(callback) {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    _handleOnline() {
        console.log('[Offline] Connection restored!')
        this.isOnline = true
        this.listeners.forEach(cb => cb(true))

        // Auto-sync queued items
        setTimeout(() => this.processQueue(), 1000)
    }

    _handleOffline() {
        console.log('[Offline] Connection lost!')
        this.isOnline = false
        this.listeners.forEach(cb => cb(false))
    }

    // ═══════════════════════════════════════════════════════════
    // Sync Queue Management
    // ═══════════════════════════════════════════════════════════

    getQueue() {
        try {
            return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]')
        } catch {
            return []
        }
    }

    addToQueue(item) {
        const queue = this.getQueue()
        queue.push({
            ...item,
            id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            queuedAt: new Date().toISOString(),
            retries: 0,
            maxRetries: 5
        })
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
        console.log(`[Offline] Queued request: ${item.method} ${item.url} (${queue.length} in queue)`)
    }

    async processQueue() {
        if (this.syncInProgress || !this.isOnline) return

        const queue = this.getQueue()
        if (queue.length === 0) return

        this.syncInProgress = true
        console.log(`[Offline] Processing ${queue.length} queued requests...`)

        const results = { success: 0, failed: 0 }
        const remaining = []

        // Use the CURRENT auth token at sync time. The token stored when the
        // request was queued may be missing or expired, which would 401 every
        // replayed request. Inject a fresh Authorization header here.
        const token = localStorage.getItem('kadai_token')

        for (const item of queue) {
            try {
                const headers = { ...(item.headers || {}) }
                if (token) headers['Authorization'] = `Bearer ${token}`

                const response = await fetch(item.url, {
                    method: item.method,
                    headers,
                    body: item.body
                })

                if (response.status === 401) {
                    // Not authenticated (logged out / token revoked) — keep the item
                    // queued so it can sync after the user logs back in.
                    remaining.push(item)
                    results.failed++
                    console.warn(`[Offline] 401 on ${item.url} — will retry after re-login`)
                    continue
                }

                if (response.ok) {
                    results.success++
                    console.log(`[Offline] Synced: ${item.method} ${item.url}`)
                } else if (response.status >= 500 && item.retries < item.maxRetries) {
                    // Server error - retry later
                    item.retries++
                    remaining.push(item)
                    results.failed++
                } else {
                    results.failed++
                    console.warn(`[Offline] Failed permanently: ${item.method} ${item.url}`)
                }
            } catch (error) {
                if (item.retries < item.maxRetries) {
                    item.retries++
                    remaining.push(item)
                }
                results.failed++
            }
        }

        // Update queue with remaining items
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining))

        this.syncInProgress = false
        console.log(`[Offline] Sync complete: ${results.success} synced, ${results.failed} failed, ${remaining.length} remaining`)

        return results
    }

    getPendingCount() {
        return this.getQueue().length
    }

    clearQueue() {
        localStorage.removeItem(SYNC_QUEUE_KEY)
    }

    // ═══════════════════════════════════════════════════════════
    // Offline Bill Queue (High-Priority for Kirana stores)
    // ═══════════════════════════════════════════════════════════

    /**
     * Queue a bill for later sync when offline
     * Saves the full bill data locally so it appears in the bills list
     */
    queueBill(billData) {
        const offlineBill = {
            ...billData,
            id: `offline_${Date.now()}`,
            bill_number: `OFF-${Date.now().toString(36).toUpperCase()}`,
            created_at: new Date().toISOString(),
            status: 'pending_sync',
            is_offline: true
        }

        // Save to offline bills list
        const bills = this.getOfflineBills()
        bills.push(offlineBill)
        localStorage.setItem('kadaigpt_offline_bills', JSON.stringify(bills))

        // Also queue the API call for sync
        this.addToQueue({
            method: 'POST',
            url: '/api/v1/bills/',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billData),
            type: 'bill',
            offlineBillId: offlineBill.id
        })

        console.log(`[Offline] Bill queued: ${offlineBill.bill_number}`)
        return offlineBill
    }

    /**
     * Get all bills saved while offline
     */
    getOfflineBills() {
        try {
            return JSON.parse(localStorage.getItem('kadaigpt_offline_bills') || '[]')
        } catch {
            return []
        }
    }

    /**
     * Remove a synced bill from offline storage
     */
    removeOfflineBill(offlineBillId) {
        const bills = this.getOfflineBills().filter(b => b.id !== offlineBillId)
        localStorage.setItem('kadaigpt_offline_bills', JSON.stringify(bills))
    }

    /**
     * Clear all offline bills (call after successful full sync)
     */
    clearOfflineBills() {
        localStorage.removeItem('kadaigpt_offline_bills')
    }

    // ═══════════════════════════════════════════════════════════
    // Offline Data Cache
    // ═══════════════════════════════════════════════════════════

    cacheData(key, data, ttlMinutes = 60) {
        try {
            const cache = this._getCache()
            cache[key] = {
                data,
                cachedAt: Date.now(),
                expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
            }
            localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(cache))
        } catch (e) {
            console.warn('[Offline] Cache storage full, clearing old entries')
            this._cleanExpiredCache()
        }
    }

    getCachedData(key) {
        const cache = this._getCache()
        const entry = cache[key]

        if (!entry) return null
        if (Date.now() > entry.expiresAt) {
            delete cache[key]
            localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(cache))
            return null
        }

        return entry.data
    }

    _getCache() {
        try {
            return JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}')
        } catch {
            return {}
        }
    }

    _cleanExpiredCache() {
        const cache = this._getCache()
        const now = Date.now()
        for (const key of Object.keys(cache)) {
            if (now > cache[key].expiresAt) {
                delete cache[key]
            }
        }
        localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(cache))
    }

    // ═══════════════════════════════════════════════════════════
    // Service Worker Registration
    // ═══════════════════════════════════════════════════════════   

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('[SW] Service workers not supported')
            return null
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            })
            console.log('[SW] Service Worker registered:', registration.scope)

            // Check for updates periodically
            setInterval(() => registration.update(), 60 * 60 * 1000) // Every hour

            return registration
        } catch (error) {
            console.error('[SW] Registration failed:', error)
            return null
        }
    }
}

const offlineSync = new OfflineSyncService()
export default offlineSync
