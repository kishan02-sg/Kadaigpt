/**
 * KadaiGPT - Offline Engine
 * IndexedDB-powered offline-first data layer with sync queue
 * 
 * Enables full billing functionality without internet.
 * Uses Dexie.js patterns for IndexedDB management.
 */

const DB_NAME = 'kadaigpt_offline';
const DB_VERSION = 1;

// ── IndexedDB Wrapper ──

class OfflineEngine {
    constructor() {
        this.db = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.listeners = new Map();

        // Monitor connectivity
        window.addEventListener('online', () => this._handleOnline());
        window.addEventListener('offline', () => this._handleOffline());
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[Offline] Database initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Products store - full catalog cached locally
                if (!db.objectStoreNames.contains('products')) {
                    const products = db.createObjectStore('products', { keyPath: 'id' });
                    products.createIndex('name', 'name', { unique: false });
                    products.createIndex('barcode', 'barcode', { unique: false });
                    products.createIndex('category_id', 'category_id', { unique: false });
                }

                // Bills store - locally created bills
                if (!db.objectStoreNames.contains('bills')) {
                    const bills = db.createObjectStore('bills', { keyPath: 'local_id' });
                    bills.createIndex('bill_number', 'bill_number', { unique: false });
                    bills.createIndex('synced', 'synced', { unique: false });
                    bills.createIndex('created_at', 'created_at', { unique: false });
                }

                // Customers store - customer data
                if (!db.objectStoreNames.contains('customers')) {
                    const customers = db.createObjectStore('customers', { keyPath: 'id' });
                    customers.createIndex('name', 'name', { unique: false });
                    customers.createIndex('phone', 'phone', { unique: false });
                }

                // Sync queue - operations waiting to be synced
                if (!db.objectStoreNames.contains('sync_queue')) {
                    const queue = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
                    queue.createIndex('type', 'type', { unique: false });
                    queue.createIndex('timestamp', 'timestamp', { unique: false });
                    queue.createIndex('status', 'status', { unique: false });
                }

                // Settings & metadata
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }

                console.log('[Offline] Database schema created');
            };
        });
    }

    // ── Product Cache ──

    async cacheProducts(products) {
        const tx = this.db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');

        for (const product of products) {
            store.put(product);
        }

        await this._waitForTransaction(tx);
        await this._setMetadata('products_last_sync', new Date().toISOString());
        console.log(`[Offline] Cached ${products.length} products`);
    }

    async getProducts() {
        return this._getAll('products');
    }

    async searchProducts(query) {
        const products = await this.getProducts();
        const q = query.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        );
    }

    async getProductByBarcode(barcode) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('products', 'readonly');
            const store = tx.objectStore('products');
            const index = store.index('barcode');
            const request = index.get(barcode);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ── Offline Bill Creation ──

    async createBillOffline(billData) {
        const localId = this._generateUUID();
        const bill = {
            ...billData,
            local_id: localId,
            bill_number: `OFF-${Date.now().toString(36).toUpperCase()}`,
            synced: false,
            created_at: new Date().toISOString(),
            created_offline: true,
        };

        const tx = this.db.transaction('bills', 'readwrite');
        tx.objectStore('bills').put(bill);
        await this._waitForTransaction(tx);

        // Update product stock locally
        if (bill.items) {
            await this._updateLocalStock(bill.items);
        }

        // Add to sync queue
        await this._addToSyncQueue('create_bill', bill);

        console.log(`[Offline] Bill ${bill.bill_number} created locally`);
        this._emit('billCreated', bill);

        return bill;
    }

    async getOfflineBills() {
        return this._getAll('bills');
    }

    async getUnsyncedBills() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('bills', 'readonly');
            const store = tx.objectStore('bills');
            const index = store.index('synced');
            const request = index.getAll(false);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ── Customer Cache ──

    async cacheCustomers(customers) {
        const tx = this.db.transaction('customers', 'readwrite');
        const store = tx.objectStore('customers');
        for (const c of customers) {
            store.put(c);
        }
        await this._waitForTransaction(tx);
        console.log(`[Offline] Cached ${customers.length} customers`);
    }

    async getCustomers() {
        return this._getAll('customers');
    }

    async searchCustomers(query) {
        const customers = await this.getCustomers();
        const q = query.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q))
        );
    }

    // ── Sync Engine ──

    async syncWhenOnline() {
        if (this.syncInProgress || !navigator.onLine) return;

        this.syncInProgress = true;
        this._emit('syncStarted');

        try {
            const queue = await this._getSyncQueue();
            let synced = 0;
            let failed = 0;

            for (const item of queue) {
                if (item.status === 'synced') continue;

                try {
                    await this._processSyncItem(item);
                    await this._updateSyncItemStatus(item.id, 'synced');
                    synced++;
                } catch (error) {
                    console.error(`[Offline] Sync failed for item ${item.id}:`, error);
                    await this._updateSyncItemStatus(item.id, 'failed', error.message);
                    failed++;
                }
            }

            // Pull latest data from server
            await this._pullLatestData();

            this._emit('syncCompleted', { synced, failed });
            console.log(`[Offline] Sync complete: ${synced} synced, ${failed} failed`);
        } catch (error) {
            console.error('[Offline] Sync error:', error);
            this._emit('syncError', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async _processSyncItem(item) {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No auth token');

        const baseUrl = import.meta.env.VITE_API_URL || '';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };

        switch (item.type) {
            case 'create_bill': {
                const response = await fetch(`${baseUrl}/api/v1/bills/`, {
                    method: 'POST', headers,
                    body: JSON.stringify(item.data),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                // Mark local bill as synced
                const tx = this.db.transaction('bills', 'readwrite');
                const bill = await new Promise((resolve) => {
                    const req = tx.objectStore('bills').get(item.data.local_id);
                    req.onsuccess = () => resolve(req.result);
                });
                if (bill) {
                    bill.synced = true;
                    bill.server_id = (await response.json()).id;
                    tx.objectStore('bills').put(bill);
                }
                break;
            }
            default:
                console.warn(`[Offline] Unknown sync type: ${item.type}`);
        }
    }

    async _pullLatestData() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const baseUrl = import.meta.env.VITE_API_URL || '';
            const headers = { 'Authorization': `Bearer ${token}` };

            // Pull products
            const prodRes = await fetch(`${baseUrl}/api/v1/products/`, { headers });
            if (prodRes.ok) {
                const products = await prodRes.json();
                if (Array.isArray(products)) await this.cacheProducts(products);
            }

            // Pull customers
            const custRes = await fetch(`${baseUrl}/api/v1/customers/`, { headers });
            if (custRes.ok) {
                const customers = await custRes.json();
                if (Array.isArray(customers)) await this.cacheCustomers(customers);
            }
        } catch (error) {
            console.error('[Offline] Pull data error:', error);
        }
    }

    // ── Status ──

    getStatus() {
        return {
            isOnline: navigator.onLine,
            syncInProgress: this.syncInProgress,
            dbInitialized: !!this.db,
        };
    }

    async getStats() {
        const products = await this.getProducts();
        const bills = await this.getOfflineBills();
        const unsynced = await this.getUnsyncedBills();
        const lastSync = await this._getMetadata('products_last_sync');

        return {
            products_cached: products.length,
            total_offline_bills: bills.length,
            unsynced_bills: unsynced.length,
            last_sync: lastSync,
            is_online: navigator.onLine,
        };
    }

    // ── Event System ──

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const cbs = this.listeners.get(event);
        if (cbs) this.listeners.set(event, cbs.filter(cb => cb !== callback));
    }

    _emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        cbs.forEach(cb => cb(data));
    }

    // ── Private Helpers ──

    _handleOnline() {
        this.isOnline = true;
        console.log('[Offline] Back online - starting sync');
        this._emit('online');
        this.syncWhenOnline();
    }

    _handleOffline() {
        this.isOnline = false;
        console.log('[Offline] Gone offline - local mode active');
        this._emit('offline');
    }

    async _updateLocalStock(items) {
        const tx = this.db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');

        for (const item of items) {
            if (!item.product_id) continue;
            const req = store.get(item.product_id);
            req.onsuccess = () => {
                const product = req.result;
                if (product) {
                    product.current_stock = Math.max(0, (product.current_stock || 0) - (item.quantity || 0));
                    store.put(product);
                }
            };
        }

        await this._waitForTransaction(tx);
    }

    async _addToSyncQueue(type, data) {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        tx.objectStore('sync_queue').put({
            type,
            data,
            timestamp: new Date().toISOString(),
            status: 'pending',
            retries: 0,
        });
        await this._waitForTransaction(tx);
    }

    async _getSyncQueue() {
        return this._getAll('sync_queue');
    }

    async _updateSyncItemStatus(id, status, error = null) {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.get(id);
        req.onsuccess = () => {
            const item = req.result;
            if (item) {
                item.status = status;
                if (error) item.error = error;
                item.last_attempt = new Date().toISOString();
                store.put(item);
            }
        };
        await this._waitForTransaction(tx);
    }

    async _getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async _setMetadata(key, value) {
        const tx = this.db.transaction('metadata', 'readwrite');
        tx.objectStore('metadata').put({ key, value });
        await this._waitForTransaction(tx);
    }

    async _getMetadata(key) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('metadata', 'readonly');
            const req = tx.objectStore('metadata').get(key);
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => resolve(null);
        });
    }

    _waitForTransaction(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error('Transaction aborted'));
        });
    }

    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}

// Singleton instance
const offlineEngine = new OfflineEngine();
export default offlineEngine;
