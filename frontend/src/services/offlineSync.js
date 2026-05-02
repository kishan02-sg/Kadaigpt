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

        for (const item of queue) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                })

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
