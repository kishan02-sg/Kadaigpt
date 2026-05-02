import { useState, useEffect } from 'react'
import { Bell, X, Check, AlertTriangle, Info, Package, TrendingDown, Users, Gift, Sparkles } from 'lucide-react'
import realDataService from '../services/realDataService'

const notificationIcons = {
    'low-stock': Package,
    'sales-drop': TrendingDown,
    'new-customer': Users,
    'reward': Gift,
    'alert': AlertTriangle,
    'info': Info,
    'ai': Sparkles
}

// Get dynamic notifications based on real data
const getInitialNotifications = async () => {
    const notifications = []

    try {
        // Get low stock products
        const lowStock = await realDataService.getLowStockProducts()
        if (lowStock.length > 0) {
            notifications.push({
                id: 1,
                type: 'low-stock',
                title: 'Low Stock Alert',
                message: `${lowStock[0].name} is running low (${lowStock[0].stock} remaining)`,
                time: 'Just now',
                read: false,
                priority: 'high'
            })
        }

        // Add AI tip
        notifications.push({
            id: 2,
            type: 'ai',
            title: 'AI Insight',
            message: 'Peak sales hour is 11 AM - 1 PM. Stock high-demand items!',
            time: '1 hour ago',
            read: false,
            priority: 'medium'
        })

        // Add welcome message if no other notifications
        if (notifications.length < 2) {
            notifications.push({
                id: 3,
                type: 'info',
                title: 'Welcome to KadaiGPT',
                message: 'Add products and create bills to see real-time insights!',
                time: 'Now',
                read: false,
                priority: 'low'
            })
        }
    } catch (error) {
        console.log('Could not fetch real notifications')
    }

    return notifications
}

export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false)
    const [items, setItems] = useState([])

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        const notifications = await getInitialNotifications()
        setItems(notifications)
    }

    const unreadCount = items.filter(n => !n.read).length

    const markAsRead = (id) => {
        setItems(prev => prev.map(n =>
            n.id === id ? { ...n, read: true } : n
        ))
    }

    const markAllAsRead = () => {
        setItems(prev => prev.map(n => ({ ...n, read: true })))
    }

    const dismissNotification = (id) => {
        setItems(prev => prev.filter(n => n.id !== id))
    }

    return (
        <>
            <button
                className="notification-bell"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="notification-backdrop" onClick={() => setIsOpen(false)} />
                    <div className="notification-panel">
                        <div className="notification-header">
                            <h3>Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    className="mark-all-read"
                                    onClick={markAllAsRead}
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        <div className="notification-list">
                            {items.length === 0 ? (
                                <div className="notification-empty">
                                    <Bell size={32} />
                                    <p>No notifications</p>
                                </div>
                            ) : (
                                items.map(notification => {
                                    const Icon = notificationIcons[notification.type] || Info
                                    return (
                                        <div
                                            key={notification.id}
                                            className={`notification-item ${notification.read ? 'read' : ''} priority-${notification.priority}`}
                                            onClick={() => markAsRead(notification.id)}
                                        >
                                            <div className={`notification-icon ${notification.type}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="notification-content">
                                                <div className="notification-title">{notification.title}</div>
                                                <div className="notification-message">{notification.message}</div>
                                                <div className="notification-time">{notification.time}</div>
                                            </div>
                                            <button
                                                className="notification-dismiss"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    dismissNotification(notification.id)
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            <style>{`
                .notification-bell {
                    position: relative;
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: var(--radius-md);
                    padding: 10px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .notification-bell:hover {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }
                
                .notification-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    background: var(--error);
                    color: white;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 2s infinite;
                }
                
                .notification-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 999;
                    background: transparent;
                }
                
                .notification-panel {
                    position: fixed;
                    top: 60px;
                    right: 16px;
                    width: 360px;
                    max-width: calc(100vw - 32px);
                    max-height: calc(100vh - 100px);
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
                    z-index: 1000;
                    overflow: hidden;
                    animation: slideDown 0.25s ease-out;
                }
                
                @keyframes slideDown {
                    from { 
                        transform: translateY(-10px) scale(0.98); 
                        opacity: 0; 
                    }
                    to { 
                        transform: translateY(0) scale(1); 
                        opacity: 1; 
                    }
                }
                
                .notification-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 20px;
                    border-bottom: 1px solid var(--border-subtle);
                    background: var(--bg-tertiary);
                }
                .notification-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    margin: 0;
                    color: var(--text-primary);
                }
                .mark-all-read {
                    background: none;
                    border: none;
                    color: var(--primary-400);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .mark-all-read:hover { 
                    background: rgba(249, 115, 22, 0.1);
                }
                
                .notification-list {
                    max-height: 400px;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }
                
                .notification-list::-webkit-scrollbar {
                    width: 6px;
                }
                
                .notification-list::-webkit-scrollbar-thumb {
                    background: var(--border-subtle);
                    border-radius: 3px;
                }
                
                .notification-empty {
                    padding: 60px 20px;
                    text-align: center;
                    color: var(--text-tertiary);
                }
                .notification-empty svg {
                    margin-bottom: 16px;
                    opacity: 0.4;
                }
                .notification-empty p {
                    margin: 0;
                    font-size: 0.9rem;
                }
                
                .notification-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    padding: 16px 20px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    border-left: 4px solid transparent;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .notification-item:last-child {
                    border-bottom: none;
                }
                .notification-item:hover {
                    background: var(--bg-tertiary);
                }
                .notification-item:not(.read) {
                    background: rgba(249, 115, 22, 0.05);
                }
                .notification-item.priority-high {
                    border-left-color: var(--error);
                }
                .notification-item.priority-medium {
                    border-left-color: var(--warning);
                }
                .notification-item.priority-low {
                    border-left-color: var(--success);
                }
                .notification-item.read {
                    opacity: 0.7;
                }
                
                .notification-icon {
                    width: 40px;
                    height: 40px;
                    min-width: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .notification-icon.low-stock {
                    background: rgba(239, 68, 68, 0.15);
                    color: var(--error);
                }
                .notification-icon.sales-drop {
                    background: rgba(234, 179, 8, 0.15);
                    color: var(--warning);
                }
                .notification-icon.new-customer {
                    background: rgba(34, 197, 94, 0.15);
                    color: var(--success);
                }
                .notification-icon.reward {
                    background: rgba(124, 58, 237, 0.15);
                    color: var(--primary-400);
                }
                .notification-icon.info {
                    background: rgba(59, 130, 246, 0.15);
                    color: var(--info);
                }
                
                .notification-content {
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                }
                .notification-title {
                    font-weight: 600;
                    font-size: 0.9rem;
                    margin-bottom: 4px;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .notification-message {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .notification-time {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    margin-top: 6px;
                }
                
                .notification-dismiss {
                    background: none;
                    border: none;
                    color: var(--text-tertiary);
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    opacity: 0;
                    transition: all 0.15s;
                    flex-shrink: 0;
                    margin-top: 2px;
                }
                .notification-item:hover .notification-dismiss {
                    opacity: 1;
                }
                .notification-dismiss:hover {
                    color: var(--error);
                    background: rgba(239, 68, 68, 0.1);
                }
                
                /* Mobile responsive */
                @media (max-width: 480px) {
                    .notification-panel {
                        top: 56px;
                        left: 8px;
                        right: 8px;
                        width: auto;
                        max-height: 70vh;
                        border-radius: 12px;
                    }
                    
                    .notification-item {
                        padding: 14px 16px;
                        gap: 12px;
                    }
                    
                    .notification-icon {
                        width: 36px;
                        height: 36px;
                        min-width: 36px;
                    }
                    
                    .notification-title {
                        font-size: 0.85rem;
                    }
                    
                    .notification-message {
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </>
    )
}
