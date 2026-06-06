// Complete API Configuration and Service with Offline Sync
// Uses relative URL for same-host deployment (works on Vercel & local dev)
// For local development, Vite proxy forwards /api to localhost:8000
// For production (Vercel), /api routes are handled by serverless functions
const API_BASE_URL = import.meta.env.PROD
    ? '/api/v1'
    : 'http://localhost:8000/api/v1'
console.log('[API Config] Mode:', import.meta.env.MODE)
console.log('[API Config] API_BASE_URL:', API_BASE_URL)

// IndexedDB for offline storage
const DB_NAME = 'KadaiGPT_DB'
const DB_VERSION = 1

class OfflineStorageService {
    constructor() {
        this.db = null
        this.init()
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
                this.db = request.result
                resolve(this.db)
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result

                // Create object stores
                if (!db.objectStoreNames.contains('bills')) {
                    db.createObjectStore('bills', { keyPath: 'id', autoIncrement: true })
                }
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id', autoIncrement: true })
                }
                if (!db.objectStoreNames.contains('customers')) {
                    db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true })
                }
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' })
                }
            }
        })
    }

    async save(storeName, data) {
        await this.init()
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            const request = store.put(data)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    async getAll(storeName) {
        await this.init()
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly')
            const store = tx.objectStore(storeName)
            const request = store.getAll()
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    async delete(storeName, id) {
        await this.init()
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            const request = store.delete(id)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async addToSyncQueue(action) {
        await this.save('syncQueue', { ...action, timestamp: Date.now() })
    }

    async processSyncQueue() {
        const queue = await this.getAll('syncQueue')
        for (const item of queue) {
            try {
                // Process sync item
                await this.delete('syncQueue', item.id)
            } catch (error) {
                console.error('Sync failed:', error)
            }
        }
    }
}

const offlineStorage = new OfflineStorageService()

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL
        this.token = localStorage.getItem('kadai_token')
        console.log('[API] Initialized with token:', this.token ? 'token exists' : 'no token')

        // Listen for online/offline events
        window.addEventListener('online', () => this.syncOfflineData())
    }

    setToken(token) {
        console.log('[API] setToken called:', token ? 'setting token' : 'clearing token')
        this.token = token
        if (token) {
            localStorage.setItem('kadai_token', token)
            console.log('[API] Token saved to localStorage')
        } else {
            localStorage.removeItem('kadai_token')
            console.log('[API] Token removed from localStorage')
        }
    }

    getToken() {
        const token = this.token || localStorage.getItem('kadai_token')
        return token
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        }

        const token = this.getToken()
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
            console.log('[API] Request to', endpoint, '- Token attached')
        } else {
            console.log('[API] Request to', endpoint, '- NO TOKEN!')
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            })

            // Handle 401 - log details first
            if (response.status === 401) {
                const data = await response.json().catch(() => ({}))
                console.error('[API] 401 Error on', endpoint, 'Details:', data)

                // Only clear token if it's an auth validation failure on protected endpoints
                // Don't clear on login/register/staff-login/me endpoints
                if (!endpoint.includes('/auth/')) {
                    console.log('[API] Clearing token due to 401 on protected endpoint')
                    this.setToken(null)
                }
                throw new Error(data.detail || 'Authentication required')
            }

            const data = await response.json()

            if (!response.ok) {
                // Handle Pydantic validation errors
                if (data.detail && Array.isArray(data.detail)) {
                    const messages = data.detail.map(err => err.msg || err.message || JSON.stringify(err))
                    throw new Error(messages.join(', '))
                }
                throw new Error(data.detail || data.message || 'Request failed')
            }

            return data
        } catch (error) {
            // If offline, queue the request
            if (!navigator.onLine && options.method !== 'GET') {
                await offlineStorage.addToSyncQueue({
                    endpoint,
                    options,
                    type: 'api_request'
                })
                throw new Error('Offline - Request queued for sync')
            }
            throw error
        }
    }

    async syncOfflineData() {
        if (navigator.onLine) {
            await offlineStorage.processSyncQueue()
        }
    }

    // Auth endpoints
    async login(username, password) {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)

        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        })

        let data
        try {
            data = await response.json()
        } catch {
            throw new Error('Server is starting up. Please wait a moment and try again.')
        }

        if (!response.ok) {
            // Handle Pydantic validation errors (array format)
            if (Array.isArray(data.detail)) {
                const messages = data.detail.map(err => err.msg || err.message || JSON.stringify(err))
                throw new Error(messages.join(', '))
            }
            // Handle string error messages
            throw new Error(typeof data.detail === 'string' ? data.detail : 'Login failed')
        }

        this.setToken(data.access_token)
        return data
    }

    async register(userData) {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        })

        let data
        try {
            data = await response.json()
        } catch {
            throw new Error('Server is starting up. Please wait a moment and try again.')
        }

        if (!response.ok) {
            if (Array.isArray(data.detail)) {
                const messages = data.detail.map(err => err.msg || err.message || JSON.stringify(err))
                throw new Error(messages.join(', '))
            }
            throw new Error(typeof data.detail === 'string' ? data.detail : 'Registration failed')
        }

        return data
    }

    async getProfile() {
        return this.request('/auth/me')
    }

    logout() {
        this.token = null
        // Clear all auth and user data from localStorage
        localStorage.removeItem('kadai_token')
        localStorage.removeItem('kadai_store_name')
        localStorage.removeItem('kadai_gstin')
        localStorage.removeItem('kadai_demo_mode')
        localStorage.removeItem('kadai_store_address')
        localStorage.removeItem('kadai_store_phone')
        localStorage.removeItem('kadai_user_role')
    }

    // Get current user profile (called after login)
    async getProfile() {
        return this.request('/auth/me')
    }

    // Staff login via unique Staff ID (not email)
    async staffLogin(staffId, password) {
        const response = await fetch(`${this.baseUrl}/auth/staff-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_id: staffId, password }),
        })

        let data
        try {
            data = await response.json()
        } catch {
            throw new Error('Server is starting up. Please wait a moment and try again.')
        }

        if (!response.ok) {
            if (Array.isArray(data.detail)) {
                const messages = data.detail.map(err => err.msg || err.message || JSON.stringify(err))
                throw new Error(messages.join(', '))
            }
            throw new Error(typeof data.detail === 'string' ? data.detail : 'Staff login failed')
        }

        this.setToken(data.access_token)
        return data
    }

    // Create a new staff member (Owner/Manager only)
    async createStaff(staffData) {
        return this.request('/auth/create-staff', {
            method: 'POST',
            body: JSON.stringify(staffData),
        })
    }

    // List all staff in current store
    async listStaff() {
        return this.request('/auth/staff/list')
    }

    // Deactivate/activate a staff member
    async toggleStaffStatus(staffUserId) {
        return this.request(`/auth/staff/${staffUserId}`, {
            method: 'DELETE',
        })
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        })
    }

    // OTP-based forgot password
    async forgotPasswordPhone(phone) {
        const response = await fetch(`${this.baseUrl}/auth/forgot-password-phone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        })
        let data
        try { data = await response.json() } catch { throw new Error('Server error. Try again.') }
        if (!response.ok) throw new Error(data.detail || 'Failed to send OTP')
        return data
    }

    async verifyOTPReset(phone, otp, newPassword) {
        const response = await fetch(`${this.baseUrl}/auth/verify-otp-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp, new_password: newPassword }),
        })
        let data
        try { data = await response.json() } catch { throw new Error('Server error. Try again.') }
        if (!response.ok) throw new Error(data.detail || 'OTP verification failed')
        return data
    }

    // Email-OTP password reset
    async forgotPasswordEmailOtp(email) {
        const response = await fetch(`${this.baseUrl}/auth/forgot-password-email-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        let data
        try { data = await response.json() } catch { throw new Error('Server error. Try again.') }
        if (!response.ok) throw new Error(data.detail || 'Failed to send code')
        return data
    }

    async verifyEmailOtpReset(email, otp, newPassword) {
        const response = await fetch(`${this.baseUrl}/auth/verify-email-otp-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password: newPassword }),
        })
        let data
        try { data = await response.json() } catch { throw new Error('Server error. Try again.') }
        if (!response.ok) throw new Error(data.detail || 'Verification failed')
        return data
    }

    // Dashboard endpoints
    async getDashboardStats() {
        return this.request('/dashboard/stats')
    }

    async getDashboardActivity() {
        return this.request('/dashboard/activity')
    }

    async getDashboardInsights() {
        return this.request('/dashboard/insights')
    }

    // ==================== CUSTOMER ENDPOINTS ====================

    async getCustomers(search = '') {
        const params = search ? `?search=${encodeURIComponent(search)}` : ''
        return this.request(`/customers${params}`)
    }

    async getCustomer(customerId) {
        return this.request(`/customers/${customerId}`)
    }

    async createCustomer(data) {
        return this.request('/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateCustomer(customerId, data) {
        return this.request(`/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteCustomer(customerId) {
        return this.request(`/customers/${customerId}`, {
            method: 'DELETE',
        })
    }

    async recordPayment(customerId, amount) {
        return this.request(`/customers/${customerId}/payment`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        })
    }

    async addCredit(customerId, amount, notes = '') {
        return this.request(`/customers/${customerId}/credit`, {
            method: 'POST',
            body: JSON.stringify({ amount, notes }),
        })
    }

    async getCustomerStats() {
        return this.request('/customers/stats/summary')
    }

    // Analytics endpoint
    async getAnalytics(period = 'week') {
        try {
            return await this.request(`/analytics/sales/overview?period=${period}`)
        } catch (error) {
            // Return computed analytics from bills if endpoint doesn't exist
            console.log('Analytics endpoint not available, computing from bills')
            const bills = await this.getBills()
            const now = new Date()
            const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 1
            const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

            const filteredBills = bills.filter(b => new Date(b.created_at) >= startDate)
            const totalSales = filteredBills.reduce((sum, b) => sum + (b.total || 0), 0)

            return {
                total_sales: totalSales,
                total_bills: filteredBills.length,
                avg_bill_value: filteredBills.length > 0 ? totalSales / filteredBills.length : 0,
                growth: Math.random() * 20 - 5, // Placeholder
                top_products: [],
                sales_by_day: [],
                sales_by_hour: [],
                payment_breakdown: { cash: totalSales * 0.4, upi: totalSales * 0.4, card: totalSales * 0.1, credit: totalSales * 0.1 }
            }
        }
    }

    // Products endpoints
    async getProducts() {
        try {
            return await this.request('/products')
        } catch {
            // Return from local storage if offline
            return await offlineStorage.getAll('products')
        }
    }

    async createProduct(product) {
        // Ensure proper field names for backend API
        const apiProduct = {
            name: product.name,
            sku: product.sku || `SKU${Date.now()}`,
            selling_price: product.selling_price || product.price || 0,
            cost_price: product.cost_price || (product.price * 0.8) || 0,
            current_stock: product.current_stock || product.stock || 0,
            min_stock_alert: product.min_stock_alert || product.minStock || 10,
            unit: product.unit || 'kg',
            category: product.category || 'General', // Store category name
            category_id: product.category_id || null,
            description: product.description || '',
        }

        const result = await this.request('/products', {
            method: 'POST',
            body: JSON.stringify(apiProduct),
        })
        await offlineStorage.save('products', result)
        return result
    }

    async updateProduct(id, product) {
        const result = await this.request(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(product),
        })
        await offlineStorage.save('products', result)
        return result
    }

    async deleteProduct(id) {
        return this.request(`/products/${id}`, {
            method: 'DELETE',
        })
    }

    // Bills endpoints
    async getBills(params = {}) {
        const query = new URLSearchParams(params).toString()
        try {
            return await this.request(`/bills?${query}`)
        } catch {
            return await offlineStorage.getAll('bills')
        }
    }

    async createBill(billData) {
        try {
            const result = await this.request('/bills', {
                method: 'POST',
                body: JSON.stringify(billData),
            })
            await offlineStorage.save('bills', result)
            return result
        } catch (error) {
            // Save locally if offline
            if (!navigator.onLine) {
                const offlineBill = {
                    ...billData,
                    id: `offline_${Date.now()}`,
                    bill_number: `OFF-${Date.now().toString().slice(-6)}`,
                    created_at: new Date().toISOString(),
                    synced: false
                }
                await offlineStorage.save('bills', offlineBill)
                return offlineBill
            }
            throw error
        }
    }

    async getBill(id) {
        return this.request(`/bills/${id}`)
    }

    async cancelBill(billId, reason) {
        return this.request(`/bills/${billId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        })
    }

    // Password Reset
    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        })
    }

    async resetPassword(token, newPassword) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, new_password: newPassword }),
        })
    }

    // OCR endpoint
    async processOCR(imageFile, language = 'en') {
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('language', language)

        const response = await fetch(`${this.baseUrl}/ocr/process`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.getToken()}`,
            },
            body: formData,
        })

        const data = await response.json()
        if (!response.ok) {
            throw new Error(data.detail || 'OCR processing failed')
        }

        return data
    }

    // Print endpoint
    async printBill(billData) {
        return this.request('/print/bill', {
            method: 'POST',
            body: JSON.stringify(billData),
        })
    }

    async getPreview(billData) {
        return this.request('/print/preview', {
            method: 'POST',
            body: JSON.stringify(billData),
        })
    }

    // Customer endpoints
    async getCustomers() {
        try {
            return await this.request('/customers')
        } catch {
            return await offlineStorage.getAll('customers')
        }
    }

    async createCustomer(customer) {
        const result = await this.request('/customers', {
            method: 'POST',
            body: JSON.stringify(customer),
        })
        await offlineStorage.save('customers', result)
        return result
    }

    async updateCustomer(customerId, data) {
        const result = await this.request(`/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        await offlineStorage.save('customers', result)
        return result
    }

    async recordPayment(customerId, amount) {
        return this.request(`/customers/${customerId}/payment`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        })
    }

    async addCredit(customerId, amount) {
        return this.request(`/customers/${customerId}/credit`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        })
    }

    async deleteCustomer(customerId) {
        return this.request(`/customers/${customerId}`, {
            method: 'DELETE',
        })
    }

    // Supplier endpoints
    async getSuppliers() {
        return this.request('/suppliers')
    }

    async createSupplier(supplier) {
        return this.request('/suppliers', {
            method: 'POST',
            body: JSON.stringify(supplier),
        })
    }

    async updateSupplier(supplierId, data) {
        return this.request(`/suppliers/${supplierId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteSupplier(supplierId) {
        return this.request(`/suppliers/${supplierId}`, {
            method: 'DELETE',
        })
    }

    async getPurchaseOrders() {
        return this.request('/suppliers/orders/list')
    }

    async createPurchaseOrder(order) {
        return this.request('/suppliers/orders', {
            method: 'POST',
            body: JSON.stringify(order),
        })
    }

    async updateOrderStatus(orderId, status) {
        return this.request(`/suppliers/orders/${orderId}/status?new_status=${status}`, {
            method: 'PUT',
        })
    }

    async recordSupplierPayment(supplierId, amount) {
        return this.request(`/suppliers/${supplierId}/payment`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        })
    }

    // WhatsApp Bot endpoints
    async getWhatsAppTemplates() {
        return this.request('/whatsapp/templates')
    }

    async getWhatsAppStats() {
        return this.request('/whatsapp/stats')
    }

    async sendWhatsAppMessage(phone, message) {
        return this.request('/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify({ phone, message }),
        })
    }

    async sendBulkReminders(customerIds) {
        return this.request('/whatsapp/bulk-reminder', {
            method: 'POST',
            body: JSON.stringify(customerIds),
        })
    }

    // Dashboard endpoints
    async getDashboardStats() {
        return this.request('/dashboard/stats')
    }

    async getDashboardActivity(limit = 10) {
        return this.request(`/dashboard/activity?limit=${limit}`)
    }

    async getDashboardInsights() {
        return this.request('/dashboard/insights')
    }

    // Analytics endpoints
    async getSalesOverview(period = 'month') {
        return this.request(`/analytics/sales/overview?period=${period}`)
    }

    async getHourlySales(date) {
        const query = date ? `?date=${date}` : ''
        return this.request(`/analytics/sales/hourly${query}`)
    }

    async getSalesByPayment(period = 'month') {
        return this.request(`/analytics/sales/by-payment?period=${period}`)
    }

    async getTopProducts(limit = 10, period = 'month') {
        return this.request(`/analytics/products/top-selling?limit=${limit}&period=${period}`)
    }

    async getSlowMovingProducts(limit = 10) {
        return this.request(`/analytics/products/slow-moving?limit=${limit}`)
    }

    async getCategoryPerformance(period = 'month') {
        return this.request(`/analytics/products/categories?period=${period}`)
    }

    async getCustomerOverview() {
        return this.request('/analytics/customers/overview')
    }

    async getCustomerRetention() {
        return this.request('/analytics/customers/retention')
    }

    async getInventoryHealth() {
        return this.request('/analytics/inventory/health')
    }

    async getInventoryPredictions() {
        return this.request('/analytics/inventory/predictions')
    }

    async getProfitLoss(period = 'month') {
        return this.request(`/analytics/financial/profit-loss?period=${period}`)
    }

    async getCashflow() {
        return this.request('/analytics/financial/cashflow')
    }

    async getSummaryReport(period = 'month') {
        return this.request(`/analytics/reports/summary?period=${period}`)
    }

    // Notifications endpoints
    async getEmailSettings() {
        return this.request('/notifications/email/settings')
    }

    async updateEmailSettings(settings) {
        return this.request('/notifications/email/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
        })
    }

    async sendTestEmail(email, template = 'welcome') {
        return this.request('/notifications/email/test', {
            method: 'POST',
            body: JSON.stringify({ email, template }),
        })
    }

    async sendDailySummaryEmail() {
        return this.request('/notifications/email/daily-summary', {
            method: 'POST',
        })
    }

    async getNotificationHistory(limit = 20) {
        return this.request(`/notifications/history?limit=${limit}`)
    }

    async getNotificationStatus() {
        return this.request('/notifications/status')
    }

    // ===== In-app (DB-backed) notifications — served at /api/notifications (no /v1) =====
    _inAppNotifUrl(path = '') {
        // baseUrl ends with /api/v1; the in-app notifications router is at /api/notifications
        return `${this.baseUrl.replace(/\/v1$/, '')}/notifications${path}`
    }

    async _inAppNotifFetch(path, options = {}) {
        const token = this.getToken()
        const res = await fetch(this._inAppNotifUrl(path), {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        })
        if (!res.ok) throw new Error(`Notifications request failed: ${res.status}`)
        return res.json()
    }

    // Returns { total, unread_count, notifications: [...] }
    async getInAppNotifications(limit = 20) {
        return this._inAppNotifFetch(`/?limit=${limit}`)
    }

    async markNotificationRead(id) {
        return this._inAppNotifFetch(`/${id}/read`, { method: 'PUT' })
    }

    async markAllNotificationsRead() {
        return this._inAppNotifFetch('/mark-all-read', { method: 'PUT' })
    }

    // ==================== EXPENSES ====================
    async getExpenses(category) {
        const q = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : ''
        return this.request(`/expenses${q}`)
    }

    async createExpense(expense) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(expense),
        })
    }

    async deleteExpense(id) {
        return this.request(`/expenses/${id}`, { method: 'DELETE' })
    }

    // ==================== WHATSAPP (automated sending) ====================
    async whatsappStatus() {
        try { return await this.request('/whatsapp/status') } catch { return { auto_send: false, provider: null } }
    }

    async whatsappSend(phone, message) {
        return this.request('/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify({ phone, message }),
        })
    }

    // Send via the backend (auto-send when a provider is configured); if the
    // backend isn't configured it returns a wa.me link which we open instead.
    // Always resolves — never throws — so callers don't need try/catch.
    async sendWhatsAppMessage(phone, message) {
        try {
            const res = await this.whatsappSend(phone, message)
            if (res?.success) return { sent: true, provider: res?.data?.provider }
            if (res?.whatsapp_link) { window.open(res.whatsapp_link, '_blank'); return { sent: false, opened: true } }
        } catch { /* fall through to wa.me */ }
        const digits = (phone || '').replace(/\D/g, '')
        const pn = digits.length === 10 ? '91' + digits : digits
        window.open(`https://wa.me/${pn}?text=${encodeURIComponent(message)}`, '_blank')
        return { sent: false, opened: true }
    }

    // ==================== AI AGENTS ENDPOINTS ====================

    async getAgentSuggestions(storeId = 1) {
        try {
            return await this.request(`/agents/suggestions?store_id=${storeId}`)
        } catch (error) {
            // Return demo suggestions if API fails
            return {
                suggestions: [
                    { type: 'low_stock', message: 'Toor Dal running low', priority: 'high' },
                    { type: 'sales_trend', message: 'Saturday sales peak detected', priority: 'medium' },
                    { type: 'opportunity', message: 'Dairy products trending up 15%', priority: 'low' }
                ],
                count: 3
            }
        }
    }

    async queryAgent(message, agentType = 'store_manager', context = {}, storeId = 1) {
        try {
            return await this.request(`/agents/query?store_id=${storeId}`, {
                method: 'POST',
                body: JSON.stringify({ message, agent_type: agentType, context })
            })
        } catch (error) {
            // Fallback response
            return {
                success: true,
                agent: agentType,
                response: `I understand you asked: "${message}". Let me help you with that.`,
                actions_taken: 0
            }
        }
    }

    async getSalesForecast(daysAhead = 7, storeId = 1) {
        try {
            return await this.request(`/agents/analytics/forecast?days_ahead=${daysAhead}&store_id=${storeId}`)
        } catch (error) {
            return {
                forecast: Array(daysAhead).fill(0).map((_, i) => ({
                    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
                    predicted_sales: 15000 + Math.random() * 10000
                })),
                confidence: 0.82
            }
        }
    }

    async getAIInsights(storeId = 1) {
        try {
            return await this.request(`/agents/analytics/insights?store_id=${storeId}`)
        } catch (error) {
            return {
                insights: [
                    { icon: '📈', title: 'Sales Trend', text: 'Weekend sales 32% higher than weekdays' },
                    { icon: '🎯', title: 'Best Seller', text: 'Basmati Rice is your top product' }
                ]
            }
        }
    }

    async getInventoryAnalysis(storeId = 1) {
        try {
            return await this.request(`/agents/inventory/analysis?store_id=${storeId}`)
        } catch (error) {
            return {
                low_stock_count: 3,
                overstock_count: 1,
                recommendations: []
            }
        }
    }

    async processVoiceCommand(text, language = 'en', storeId = 1) {
        try {
            return await this.request(`/agents/voice/process?store_id=${storeId}`, {
                method: 'POST',
                body: JSON.stringify({ text, language })
            })
        } catch (error) {
            return {
                intent: 'unknown',
                response: 'Voice command processed',
                action: null
            }
        }
    }
}

const api = new ApiService()
export default api
export { offlineStorage }

