/**
 * KadaiGPT - Error Tracking Service
 * Lightweight production error monitoring
 * Captures: JS errors, unhandled rejections, component errors, API failures
 * 
 * Reports to backend /api/error-reports endpoint (when available)
 * Falls back to localStorage queue for offline error capture
 */

class ErrorTracker {
    constructor() {
        this.errors = []
        this.maxErrors = 100
        this.isInitialized = false
        this.reportEndpoint = '/api/error-reports'
    }

    init() {
        if (this.isInitialized) return
        this.isInitialized = true

        // Capture unhandled JS errors
        window.addEventListener('error', (event) => {
            this.capture({
                type: 'runtime_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
            })
        })

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.capture({
                type: 'unhandled_rejection',
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
            })
        })

        // Load queued errors from offline storage
        this._loadQueue()

        console.log('[ErrorTracker] Initialized — production error monitoring active')
    }

    /**
     * Capture an error event
     */
    capture(errorData) {
        const entry = {
            id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            language: document.documentElement.lang || navigator.language,
            online: navigator.onLine,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            ...errorData,
        }

        this.errors.push(entry)
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors)
        }

        // Persist to localStorage for offline resilience
        this._saveQueue()

        // Try to report immediately if online
        if (navigator.onLine) {
            this._report(entry)
        }

        // Log in dev for visibility
        if (import.meta.env.DEV) {
            console.warn('[ErrorTracker] Captured:', entry.type, entry.message)
        }
    }

    /**
     * Capture a React component error (from ErrorBoundary)
     */
    captureComponentError(error, errorInfo) {
        this.capture({
            type: 'component_error',
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
        })
    }

    /**
     * Capture an API error
     */
    captureApiError(endpoint, status, responseBody) {
        this.capture({
            type: 'api_error',
            message: `API ${endpoint} returned ${status}`,
            endpoint,
            status,
            responseBody: typeof responseBody === 'string' ? responseBody.slice(0, 500) : JSON.stringify(responseBody).slice(0, 500),
        })
    }

    /**
     * Get error summary for admin dashboard
     */
    getSummary() {
        const now = Date.now()
        const last24h = this.errors.filter(e => (now - new Date(e.timestamp).getTime()) < 86400000)
        const byType = {}
        last24h.forEach(e => {
            byType[e.type] = (byType[e.type] || 0) + 1
        })
        return {
            total: this.errors.length,
            last24h: last24h.length,
            byType,
            recentErrors: this.errors.slice(-10).reverse(),
        }
    }

    /**
     * Clear all captured errors
     */
    clear() {
        this.errors = []
        localStorage.removeItem('kadaigpt_error_queue')
    }

    // --- Private methods ---

    async _report(entry) {
        try {
            const baseUrl = import.meta.env.VITE_API_URL || ''
            await fetch(`${baseUrl}${this.reportEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
            })
        } catch {
            // Silently fail — error reporting should never crash the app
        }
    }

    _saveQueue() {
        try {
            localStorage.setItem('kadaigpt_error_queue', JSON.stringify(this.errors.slice(-50)))
        } catch {
            // localStorage full — silently fail
        }
    }

    _loadQueue() {
        try {
            const queued = localStorage.getItem('kadaigpt_error_queue')
            if (queued) {
                this.errors = JSON.parse(queued)
            }
        } catch {
            // Corrupt data — ignore
        }
    }
}

const errorTracker = new ErrorTracker()
export default errorTracker
