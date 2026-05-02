import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Clock, Sparkles, RefreshCw, Zap, TrendingUp, Package, Users, DollarSign, Calendar, ArrowRight, Star, Target } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function DailyActionPlanner({ addToast, setCurrentPage }) {
    const [actions, setActions] = useState([])
    const [completedActions, setCompletedActions] = useState([])
    const [loading, setLoading] = useState(true)
    const [greeting, setGreeting] = useState('')

    useEffect(() => {
        generateDailyActions()
        const hour = new Date().getHours()
        if (hour >= 5 && hour < 12) setGreeting('Good Morning ☀️')
        else if (hour >= 12 && hour < 17) setGreeting('Good Afternoon 🌤️')
        else if (hour >= 17 && hour < 21) setGreeting('Good Evening 🌅')
        else setGreeting('Working Late 🌙')
    }, [])

    const generateDailyActions = async () => {
        setLoading(true)
        try {
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const hour = now.getHours()
            const dayOfWeek = now.getDay()

            const todayBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= today)
            const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0)

            const dailyActions = []
            let priority = 1

            // MORNING ACTIONS (6 AM - 12 PM)
            if (hour >= 6 && hour < 12) {
                // Check stock levels first thing
                const criticalStock = products.filter(p => (p.stock || 0) === 0)
                const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 5))

                if (criticalStock.length > 0) {
                    dailyActions.push({
                        id: 'restock_critical',
                        priority: priority++,
                        title: `Restock ${criticalStock.length} out-of-stock items`,
                        description: `${criticalStock.slice(0, 3).map(p => p.name).join(', ')}${criticalStock.length > 3 ? '...' : ''}`,
                        icon: Package,
                        color: '#ef4444',
                        action: 'products',
                        duration: '30 min',
                        impact: 'High'
                    })
                }

                if (lowStock.length > 0) {
                    dailyActions.push({
                        id: 'restock_low',
                        priority: priority++,
                        title: `Review ${lowStock.length} low stock items`,
                        description: 'Check if reorder is needed',
                        icon: Package,
                        color: '#f59e0b',
                        action: 'products',
                        duration: '15 min',
                        impact: 'Medium'
                    })
                }

                // Daily target setting
                const avgDailySales = bills.length > 7
                    ? bills.reduce((sum, b) => sum + (b.total || 0), 0) / 30
                    : 5000

                dailyActions.push({
                    id: 'set_target',
                    priority: priority++,
                    title: `Today's target: ₹${Math.round(avgDailySales * 1.1).toLocaleString()}`,
                    description: '10% above average for growth',
                    icon: Target,
                    color: '#7c3aed',
                    duration: '5 min',
                    impact: 'High'
                })
            }

            // ALL DAY ACTIONS
            // Credit collection reminder
            const customersWithCredit = customers.filter(c => (c.credit_amount || c.creditAmount || 0) > 0)
            if (customersWithCredit.length > 0) {
                const totalCredit = customersWithCredit.reduce((sum, c) => sum + (c.credit_amount || c.creditAmount || 0), 0)
                dailyActions.push({
                    id: 'collect_credit',
                    priority: priority++,
                    title: `Collect ₹${totalCredit.toLocaleString()} pending`,
                    description: `${customersWithCredit.length} customers have dues`,
                    icon: DollarSign,
                    color: '#22c55e',
                    action: 'customers',
                    duration: '20 min',
                    impact: 'High'
                })
            }

            // Inactive customer outreach
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            const inactiveCustomers = customers.filter(c => {
                const lastPurchase = bills
                    .filter(b => b.customer_id === c.id || b.customerId === c.id)
                    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))[0]

                if (!lastPurchase) return true
                return new Date(lastPurchase.created_at || lastPurchase.createdAt) < thirtyDaysAgo
            })

            if (inactiveCustomers.length > 3) {
                dailyActions.push({
                    id: 'customer_outreach',
                    priority: priority++,
                    title: `Reach out to ${Math.min(5, inactiveCustomers.length)} inactive customers`,
                    description: 'Send WhatsApp message or call',
                    icon: Users,
                    color: '#ec4899',
                    action: 'customers',
                    duration: '25 min',
                    impact: 'Medium'
                })
            }

            // AFTERNOON/EVENING ACTIONS (after 2 PM)
            if (hour >= 14) {
                // Check today's progress
                if (todayBills.length > 0) {
                    dailyActions.push({
                        id: 'check_progress',
                        priority: priority++,
                        title: 'Review today\'s performance',
                        description: `${todayBills.length} bills, ₹${todaySales.toLocaleString()} sales so far`,
                        icon: TrendingUp,
                        color: '#3b82f6',
                        action: 'analytics',
                        duration: '10 min',
                        impact: 'Low'
                    })
                }

                // End of day GST preparation (Friday or month end)
                const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate()
                if (dayOfWeek === 5 || isLastDayOfMonth) {
                    dailyActions.push({
                        id: 'gst_prep',
                        priority: priority++,
                        title: 'Review GST summary',
                        description: isLastDayOfMonth ? 'Month end - verify tax calculations' : 'Weekly GST check',
                        icon: Calendar,
                        color: '#6366f1',
                        action: 'gst',
                        duration: '15 min',
                        impact: 'High'
                    })
                }
            }

            // EVENING CLOSING ACTIONS (after 6 PM)
            if (hour >= 18) {
                dailyActions.push({
                    id: 'daily_summary',
                    priority: priority++,
                    title: 'Generate daily summary',
                    description: 'Export today\'s data for records',
                    icon: Star,
                    color: '#f59e0b',
                    action: 'daily-summary',
                    duration: '5 min',
                    impact: 'Medium'
                })
            }

            // Always add analytics review if not too many actions
            if (dailyActions.length < 5) {
                dailyActions.push({
                    id: 'review_analytics',
                    priority: priority++,
                    title: 'Check AI insights',
                    description: 'Review predictions and recommendations',
                    icon: Sparkles,
                    color: '#7c3aed',
                    action: 'ai-insights',
                    duration: '10 min',
                    impact: 'Medium'
                })
            }

            setActions(dailyActions.slice(0, 6)) // Max 6 actions
        } catch (error) {
            console.error('Error generating daily actions:', error)
        } finally {
            setLoading(false)
        }
    }

    const completeAction = (actionId) => {
        setCompletedActions(prev => [...prev, actionId])
        addToast?.({
            type: 'success',
            message: '✅ Action completed!'
        })
    }

    const navigateToAction = (action) => {
        if (action.action && setCurrentPage) {
            setCurrentPage(action.action)
        }
    }

    const completionRate = actions.length > 0
        ? Math.round((completedActions.length / actions.length) * 100)
        : 0

    if (loading) {
        return (
            <div className="action-planner loading">
                <style>{plannerStyles}</style>
                <Zap size={32} className="pulse" style={{ color: '#7c3aed' }} />
                <p>AI Planning Your Day...</p>
            </div>
        )
    }

    return (
        <div className="action-planner">
            <style>{plannerStyles}</style>

            <div className="planner-header">
                <div className="greeting-section">
                    <h3>{greeting}</h3>
                    <p>Here's your AI-optimized action plan</p>
                </div>
                <div className="progress-ring" style={{ '--progress': completionRate }}>
                    <span>{completionRate}%</span>
                </div>
            </div>

            <div className="actions-list">
                {actions.map((action, index) => {
                    const Icon = action.icon
                    const isCompleted = completedActions.includes(action.id)

                    return (
                        <div
                            key={action.id}
                            className={`action-item ${isCompleted ? 'completed' : ''}`}
                        >
                            <button
                                className="action-checkbox"
                                onClick={() => completeAction(action.id)}
                                disabled={isCompleted}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
                                ) : (
                                    <Circle size={20} />
                                )}
                            </button>

                            <div
                                className="action-content"
                                onClick={() => navigateToAction(action)}
                            >
                                <div className="action-icon" style={{ backgroundColor: `${action.color}20`, color: action.color }}>
                                    <Icon size={16} />
                                </div>
                                <div className="action-text">
                                    <h5>{action.title}</h5>
                                    <p>{action.description}</p>
                                </div>
                            </div>

                            <div className="action-meta">
                                <span className="duration">
                                    <Clock size={10} />
                                    {action.duration}
                                </span>
                                <span className={`impact ${action.impact.toLowerCase()}`}>
                                    {action.impact}
                                </span>
                            </div>

                            {action.action && (
                                <button
                                    className="action-go"
                                    onClick={() => navigateToAction(action)}
                                >
                                    <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {completedActions.length === actions.length && actions.length > 0 && (
                <div className="all-done">
                    <Star size={24} style={{ color: '#f59e0b' }} />
                    <span>All tasks completed! Great work! 🎉</span>
                </div>
            )}
        </div>
    )
}

const plannerStyles = `
    .action-planner {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .action-planner.loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        min-height: 300px;
        color: var(--text-secondary);
    }

    .planner-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .greeting-section h3 {
        margin: 0 0 4px;
        font-size: 1.25rem;
    }

    .greeting-section p {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-secondary);
    }

    .progress-ring {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: conic-gradient(
            #7c3aed calc(var(--progress) * 1%),
            var(--bg-tertiary) 0
        );
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .progress-ring::before {
        content: '';
        position: absolute;
        width: 44px;
        height: 44px;
        background: var(--bg-card);
        border-radius: 50%;
    }

    .progress-ring span {
        position: relative;
        font-size: 0.75rem;
        font-weight: 700;
        color: #7c3aed;
    }

    .actions-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .action-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        transition: all 0.2s;
    }

    .action-item:hover:not(.completed) {
        border-color: var(--primary-500);
    }

    .action-item.completed {
        opacity: 0.6;
    }

    .action-item.completed .action-text h5 {
        text-decoration: line-through;
    }

    .action-checkbox {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-tertiary);
        flex-shrink: 0;
    }

    .action-checkbox:hover {
        color: #22c55e;
    }

    .action-content {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        cursor: pointer;
        min-width: 0;
    }

    .action-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        flex-shrink: 0;
    }

    .action-text {
        flex: 1;
        min-width: 0;
    }

    .action-text h5 {
        margin: 0;
        font-size: 0.8125rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .action-text p {
        margin: 2px 0 0;
        font-size: 0.6875rem;
        color: var(--text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .action-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        flex-shrink: 0;
    }

    .duration {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 0.625rem;
        color: var(--text-tertiary);
    }

    .impact {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.5625rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .impact.high {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .impact.medium {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
    }

    .impact.low {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
    }

    .action-go {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(124, 58, 237, 0.1);
        border: none;
        border-radius: 8px;
        color: #7c3aed;
        cursor: pointer;
        flex-shrink: 0;
    }

    .action-go:hover {
        background: rgba(124, 58, 237, 0.2);
    }

    .all-done {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 16px;
        margin-top: 16px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02));
        border-radius: 12px;
        font-weight: 600;
        color: #f59e0b;
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    @media (max-width: 600px) {
        .action-meta {
            display: none;
        }
    }
`
