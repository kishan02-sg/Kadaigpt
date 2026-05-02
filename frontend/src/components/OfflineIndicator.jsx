import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw, Upload } from 'lucide-react'
import offlineSync from '../services/offlineSync'

/**
 * OfflineIndicator - Shows connectivity status and sync queue info
 * Prominent but non-intrusive — slides in when offline, collapses when online
 */
export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [pendingCount, setPendingCount] = useState(0)
    const [syncing, setSyncing] = useState(false)
    const [showBanner, setShowBanner] = useState(false)

    useEffect(() => {
        const unsubscribe = offlineSync.onConnectivityChange((online) => {
            setIsOnline(online)
            setShowBanner(!online)
        })

        // Check pending count periodically
        const interval = setInterval(() => {
            setPendingCount(offlineSync.getPendingCount())
        }, 5000)

        // Show banner if offline on mount
        if (!navigator.onLine) setShowBanner(true)
        setPendingCount(offlineSync.getPendingCount())

        return () => {
            unsubscribe()
            clearInterval(interval)
        }
    }, [])

    const handleSync = async () => {
        if (!isOnline || syncing) return
        setSyncing(true)
        try {
            await offlineSync.processQueue()
            setPendingCount(offlineSync.getPendingCount())
        } finally {
            setSyncing(false)
        }
    }

    // Don't render anything if online and no pending items
    if (isOnline && pendingCount === 0 && !showBanner) return null

    return (
        <>
            {/* Offline Banner */}
            {!isOnline && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    animation: 'slideDown 0.3s ease-out',
                    boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)'
                }}>
                    <WifiOff size={16} />
                    <span>You're offline — Changes will be saved locally and synced when you're back online</span>
                </div>
            )}

            {/* Sync Button (when online with pending items) */}
            {isOnline && pendingCount > 0 && (
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    style={{
                        position: 'fixed',
                        bottom: '80px',
                        right: '20px',
                        zIndex: 9998,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    {syncing ? (
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <Upload size={16} />
                    )}
                    <span>{syncing ? 'Syncing...' : `Sync ${pendingCount} items`}</span>
                </button>
            )}

            <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </>
    )
}
