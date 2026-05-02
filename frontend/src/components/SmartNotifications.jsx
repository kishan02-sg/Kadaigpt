import { useState, useEffect, useCallback } from 'react'
import { Bell, X, AlertTriangle, TrendingUp, Package, Users, DollarSign, Calendar, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function SmartNotifications({ addToast }) {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastChecked, setLastChecked] = useState(null)

    const generateNotifications = useCallback(async () => {
        setLoading(true)
        try {
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const newNotifications = []
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

            // 1. Low Stock Alerts
            const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 5) && (p.stock || 0) > 0)
            if (lowStockProducts.length > 0) {
                newNotifications.push({
                    id: 'low_stock_' + now.getTime(),
                    type: 'warning',
                    icon: Package,
                    title: 'Low Stock Alert',
                    message: `${lowStockProducts.length} products running low: ${lowStockProducts.slice(0, 2).map(p => p.name).join(', ')}${lowStockProducts.length > 2 ? '...' : ''}`,
                    action: 'Restock Now',
                    actionPage: 'products',
                    timestamp: now,
                    priority: 'high'
                })
            }

            // 2. Out of Stock Alert
            const outOfStock = products.filter(p => (p.stock || 0) === 0)
            if (outOfStock.length > 0) {
                newNotifications.push({
                    id: 'out_stock_' + now.getTime(),
                    type: 'error',
                    icon: AlertTriangle,
                    title: 'Out of Stock!',
                    message: `${outOfStock.length} products out of stock. You're losing sales!`,
                    action: 'Fix Now',
                    actionPage: 'products',
                    timestamp: now,
                    priority: 'urgent'
                })
            }

            // 3. Today's Performance
            const todayBills = bills.filter(b => {
                const billDate = new Date(b.created_at || b.createdAt)
                return billDate >= today
            })
            const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0)

            if (todaySales > 0) {
                newNotifications.push({
                    id: 'today_sales_' + now.getTime(),
                    type: 'success',
                    icon: TrendingUp,
                    title: 'Today\'s Progress',
                    message: `₹${todaySales.toLocaleString()} earned from ${todayBills.length} bills today!`,
                    timestamp: now,
                    priority: 'info'
                })
            }

            // 4. VIP Customer Opportunity
            const vipCustomers = customers.filter(c => (c.loyalty_points || c.loyaltyPoints || 0) >= 5000)
            if (vipCustomers.length > 0) {
                newNotifications.push({
                    id: 'vip_' + now.getTime(),
                    type: 'info',
                    icon: Users,
                    title: 'VIP Customer Opportunity',
                    message: `${vipCustomers.length} VIP customers with high loyalty points. Send them exclusive offers!`,
                    action: 'View Customers',
                    actionPage: 'customers',
                    timestamp: now,
                    priority: 'medium'
                })
            }

            // 5. Credit Collection Reminder
            const customersWithCredit = customers.filter(c => (c.credit || 0) > 0)
            const totalCredit = customersWithCredit.reduce((sum, c) => sum + (c.credit || 0), 0)
            if (totalCredit > 1000) {
                newNotifications.push({
                    id: 'credit_' + now.getTime(),
                    type: 'warning',
                    icon: DollarSign,
                    title: 'Collect Pending Dues',
                    message: `₹${totalCredit.toLocaleString()} pending from ${customersWithCredit.length} customers`,
                    action: 'View Dues',
                    actionPage: 'customers',
                    timestamp: now,
                    priority: 'high'
                })
            }

            // 6. AI Business Insight
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            const weeklyBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= weekAgo)
            if (weeklyBills.length >= 10) {
                const avgBill = weeklyBills.reduce((sum, b) => sum + (b.total || 0), 0) / weeklyBills.length
                newNotifications.push({
                    id: 'ai_insight_' + now.getTime(),
                    type: 'ai',
                    icon: Sparkles,
                    title: 'AI Insight',
                    message: `Your average bill value is ₹${avgBill.toFixed(0)}. ${avgBill < 300 ? 'Promote combo deals to increase it!' : 'Great performance!'}`,
                    timestamp: now,
                    priority: 'info'
                })
            }

            // Sort by priority
            const priorityOrder = { urgent: 0, high: 1, medium: 2, info: 3 }
            newNotifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

            setNotifications(newNotifications)
            setLastChecked(now)
        } catch (error) {
            console.error('Failed to generate notifications:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        generateNotifications()
        // Refresh every 5 minutes
        const interval = setInterval(generateNotifications, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [generateNotifications])

    const dismissNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    const getTypeStyles = (type) => {
        switch (type) {
            case 'error': return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', color: '#ef4444' }
            case 'warning': return { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', color: '#f59e0b' }
            case 'success': return { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', color: '#22c55e' }
            case 'ai': return { bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))', border: '#7c3aed', color: '#7c3aed' }
            default: return { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', color: '#3b82f6' }
        }
    }

    const formatTime = (date) => {
        const now = new Date()
        const diff = now - date
        const minutes = Math.floor(diff / 60000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        return date.toLocaleDateString()
    }

    return { notifications, loading, dismissNotification, generateNotifications, getTypeStyles, formatTime }
}

// Notification Bell Component for Header
export function NotificationBell({ addToast, setCurrentPage }) {
    const { notifications, loading, dismissNotification, generateNotifications, getTypeStyles, formatTime } = SmartNotifications({ addToast })
    const [isOpen, setIsOpen] = useState(false)

    const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length

    return (
        <div className="notification-bell-wrapper">
            <style>{notificationStyles}</style>

            <button
                className="notification-bell"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell size={22} />
                {urgentCount > 0 && (
                    <span className="notification-badge">{urgentCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h4>Notifications</h4>
                        <button onClick={generateNotifications} className="refresh-btn">
                            <Clock size={14} /> Refresh
                        </button>
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div className="notification-loading">
                                <div className="spinner" />
                                <span>Analyzing your business...</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">
                                <CheckCircle2 size={32} />
                                <p>All caught up! No notifications.</p>
                            </div>
                        ) : (
                            notifications.map(notification => {
                                const styles = getTypeStyles(notification.type)
                                const Icon = notification.icon

                                return (
                                    <div
                                        key={notification.id}
                                        className="notification-item"
                                        style={{
                                            background: styles.bg,
                                            borderLeft: `3px solid ${styles.border}`
                                        }}
                                    >
                                        <div className="notification-icon" style={{ color: styles.color }}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="notification-content">
                                            <h5>{notification.title}</h5>
                                            <p>{notification.message}</p>
                                            <div className="notification-footer">
                                                <span className="notification-time">{formatTime(notification.timestamp)}</span>
                                                {notification.action && (
                                                    <button
                                                        className="notification-action"
                                                        onClick={() => {
                                                            setCurrentPage?.(notification.actionPage)
                                                            setIsOpen(false)
                                                        }}
                                                    >
                                                        {notification.action}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className="notification-dismiss"
                                            onClick={() => dismissNotification(notification.id)}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const notificationStyles = `
    .notification-bell-wrapper {
        position: relative;
    }

    .notification-bell {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .notification-bell:hover {
        background: var(--bg-secondary);
        color: var(--primary-500);
    }

    .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ef4444;
        color: white;
        font-size: 0.6875rem;
        font-weight: 700;
        border-radius: 100px;
        padding: 0 4px;
    }

    .notification-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 360px;
        max-height: 480px;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 16px;
        box-shadow: var(--shadow-xl);
        z-index: 1000;
        overflow: hidden;
    }

    .notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .notification-header h4 {
        margin: 0;
        font-size: 1rem;
    }

    .notification-header .refresh-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        font-size: 0.75rem;
        color: var(--text-secondary);
        cursor: pointer;
    }

    .notification-list {
        max-height: 400px;
        overflow-y: auto;
    }

    .notification-loading,
    .notification-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 40px;
        color: var(--text-secondary);
    }

    .notification-empty svg {
        color: var(--success);
    }

    .notification-item {
        display: flex;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-subtle);
        transition: all 0.2s;
    }

    .notification-item:hover {
        background: rgba(255, 255, 255, 0.02);
    }

    .notification-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        flex-shrink: 0;
    }

    .notification-content {
        flex: 1;
        min-width: 0;
    }

    .notification-content h5 {
        margin: 0 0 4px;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .notification-content p {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.4;
    }

    .notification-footer {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
    }

    .notification-time {
        font-size: 0.6875rem;
        color: var(--text-tertiary);
    }

    .notification-action {
        padding: 4px 10px;
        background: transparent;
        border: 1px solid currentColor;
        border-radius: 6px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--primary-500);
        cursor: pointer;
        transition: all 0.2s;
    }

    .notification-action:hover {
        background: var(--primary-500);
        color: white;
    }

    .notification-dismiss {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--text-tertiary);
        cursor: pointer;
        opacity: 0;
        transition: all 0.2s;
    }

    .notification-item:hover .notification-dismiss {
        opacity: 1;
    }

    .notification-dismiss:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    @media (max-width: 480px) {
        .notification-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-height: 70vh;
            border-radius: 20px 20px 0 0;
        }
    }
`
