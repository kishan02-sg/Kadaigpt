/**
 * KadaiGPT - Service Worker
 * Offline-first PWA support for Indian kirana stores
 * 
 * Strategy:
 *   - App Shell: Cache-First (instant load)
 *   - API GET:   Network-First with cache fallback 
 *   - API POST:  Queue for sync when offline
 *   - Images:    Cache-First with network fallback
 */

const CACHE_NAME = 'kadaigpt-v2.0';
const API_CACHE = 'kadaigpt-api-v2.0';
const IMAGE_CACHE = 'kadaigpt-images-v2.0';

// App shell files - cached for instant load
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
];

// ═══════════════════════════════════════════════════════════
// Install - Pre-cache app shell
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
    console.log('[SW] Installing KadaiGPT Service Worker v2.0');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// ═══════════════════════════════════════════════════════════
// Activate - Clean old caches
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating KadaiGPT Service Worker');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME && key !== API_CACHE && key !== IMAGE_CACHE)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ═══════════════════════════════════════════════════════════
// Fetch - Smart caching strategies
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests for caching (but queue POST for offline sync)
    if (event.request.method !== 'GET') {
        // Queue offline mutations
        if (!navigator.onLine && event.request.method === 'POST') {
            event.respondWith(queueOfflineRequest(event.request));
            return;
        }
        return;
    }

    // API requests: Network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstWithCache(event.request));
        return;
    }

    // Static assets (JS, CSS): Cache-first
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirstWithNetwork(event.request));
        return;
    }

    // Images: Cache-first
    if (event.request.destination === 'image') {
        event.respondWith(cacheFirstWithNetwork(event.request, IMAGE_CACHE));
        return;
    }

    // Everything else (HTML pages): Network-first (for SPA routing)
    event.respondWith(networkFirstWithCache(event.request, CACHE_NAME));
});

// ═══════════════════════════════════════════════════════════
// Caching Strategies
// ═══════════════════════════════════════════════════════════

async function networkFirstWithCache(request, cacheName = API_CACHE) {
    try {
        const response = await fetch(request);
        // Cache successful GET responses
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Offline - return cached version
        const cached = await caches.match(request);
        if (cached) {
            console.log('[SW] Serving from cache:', request.url);
            return cached;
        }

        // For HTML requests, return the cached index.html (SPA)
        if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
        }

        // Return offline response for API
        return new Response(JSON.stringify({
            error: true,
            offline: true,
            message: 'You are offline. Data will sync when connection is restored.'
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
        });
    }
}

async function cacheFirstWithNetwork(request, cacheName = CACHE_NAME) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('', { status: 503 });
    }
}

// ═══════════════════════════════════════════════════════════
// Offline Sync Queue
// ═══════════════════════════════════════════════════════════
const SYNC_QUEUE_KEY = 'kadaigpt-sync-queue';

async function queueOfflineRequest(request) {
    const body = await request.text();
    const queueItem = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: body,
        timestamp: Date.now()
    };

    // Store in IndexedDB via message to client
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'QUEUE_OFFLINE_REQUEST',
            data: queueItem
        });
    });

    return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Saved offline. Will sync when back online.',
        queued_at: new Date().toISOString()
    }), {
        headers: { 'Content-Type': 'application/json' },
        status: 202
    });
}

// ═══════════════════════════════════════════════════════════
// Background Sync
// ═══════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
    if (event.tag === 'kadaigpt-sync') {
        console.log('[SW] Background sync triggered');
        event.waitUntil(processOfflineQueue());
    }
});

async function processOfflineQueue() {
    // Notify clients to process their queued requests
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'PROCESS_SYNC_QUEUE' });
    });
}

// ═══════════════════════════════════════════════════════════
// Push Notifications
// ═══════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
    let data = { title: 'KadaiGPT', body: 'You have a new notification' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            vibrate: [200, 100, 200],
            tag: data.tag || 'kadaigpt-notification',
            data: data.url || '/'
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(event.notification.data || '/')
    );
});

console.log('[SW] KadaiGPT Service Worker loaded');
