import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Eye, Sparkles, RefreshCw, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Clock, Zap } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function AnomalyDetectionAgent({ addToast }) {
    const [anomalies, setAnomalies] = useState([])
    const [loading, setLoading] = useState(true)
    const [systemHealth, setSystemHealth] = useState('healthy')

    useEffect(() => {
        detectAnomalies()
    }, [])

    const detectAnomalies = async () => {
        setLoading(true)
        try {
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

            const detectedAnomalies = []

            // Filter bills by date
            const todayBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= today)
            const yesterdayBills = bills.filter(b => {
                const date = new Date(b.created_at || b.createdAt)
                return date >= yesterday && date < today
            })
            const weeklyBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= weekAgo)

            // Calculate averages
            const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0)
            const yesterdaySales = yesterdayBills.reduce((sum, b) => sum + (b.total || 0), 0)
            const avgDailySales = weeklyBills.length > 1
                ? weeklyBills.reduce((sum, b) => sum + (b.total || 0), 0) / 7
                : todaySales

            // 1. SALES SPIKE DETECTION
            if (todaySales > avgDailySales * 1.5 && avgDailySales > 0) {
                const percentIncrease = ((todaySales - avgDailySales) / avgDailySales * 100).toFixed(0)
                detectedAnomalies.push({
                    id: 'sales_spike',
                    type: 'positive',
                    severity: 'info',
                    title: 'Sales Spike Detected! 📈',
                    description: `Today's sales are ${percentIncrease}% above average. Great performance!`,
                    metric: `₹${todaySales.toLocaleString()}`,
                    metricLabel: 'Today vs ₹' + avgDailySales.toFixed(0) + ' avg',
                    icon: TrendingUp,
                    color: '#22c55e',
                    suggestion: 'Maintain stock levels for high-demand products'
                })
            }

            // 2. SALES DROP ALERT
            if (todaySales < avgDailySales * 0.5 && avgDailySales > 0 && now.getHours() > 14) {
                const percentDrop = ((avgDailySales - todaySales) / avgDailySales * 100).toFixed(0)
                detectedAnomalies.push({
                    id: 'sales_drop',
                    type: 'negative',
                    severity: 'warning',
                    title: 'Unusual Sales Drop ⚠️',
                    description: `Today's sales are ${percentDrop}% below average. Check if there's an issue.`,
                    metric: `₹${todaySales.toLocaleString()}`,
                    metricLabel: 'Expected: ₹' + avgDailySales.toFixed(0),
                    icon: TrendingDown,
                    color: '#f59e0b',
                    suggestion: 'Consider running a flash sale or promotion'
                })
            }

            // 3. UNUSUAL BILL SIZE
            const avgBillSize = weeklyBills.length > 0
                ? weeklyBills.reduce((sum, b) => sum + (b.total || 0), 0) / weeklyBills.length
                : 0

            const unusualBills = todayBills.filter(b => (b.total || 0) > avgBillSize * 3)
            if (unusualBills.length > 0) {
                const maxBill = Math.max(...unusualBills.map(b => b.total || 0))
                detectedAnomalies.push({
                    id: 'large_bill',
                    type: 'positive',
                    severity: 'info',
                    title: 'Large Transaction Alert 💰',
                    description: `${unusualBills.length} bills today are 3x larger than average.`,
                    metric: `₹${maxBill.toLocaleString()}`,
                    metricLabel: 'Largest bill',
                    icon: Zap,
                    color: '#7c3aed',
                    suggestion: 'Identify and nurture these VIP customers'
                })
            }

            // 4. STOCK DISCREPANCY
            const negativeStock = products.filter(p => (p.stock || 0) < 0)
            if (negativeStock.length > 0) {
                detectedAnomalies.push({
                    id: 'negative_stock',
                    type: 'negative',
                    severity: 'critical',
                    title: 'Stock Discrepancy Detected! 🚨',
                    description: `${negativeStock.length} products show negative stock. Data integrity issue!`,
                    metric: negativeStock.length,
                    metricLabel: 'products affected',
                    icon: XCircle,
                    color: '#ef4444',
                    suggestion: 'Audit stock counts and update inventory immediately'
                })
            }

            // 5. SUDDEN CUSTOMER SURGE
            const newCustomersToday = customers.filter(c => {
                const created = new Date(c.created_at || c.createdAt || 0)
                return created >= today
            })
            const avgNewCustomersPerDay = customers.length / 30 // rough estimate

            if (newCustomersToday.length > avgNewCustomersPerDay * 2 && avgNewCustomersPerDay > 0) {
                detectedAnomalies.push({
                    id: 'customer_surge',
                    type: 'positive',
                    severity: 'info',
                    title: 'Customer Surge! 🎉',
                    description: `${newCustomersToday.length} new customers today - 2x above average!`,
                    metric: newCustomersToday.length,
                    metricLabel: 'new customers',
                    icon: TrendingUp,
                    color: '#22c55e',
                    suggestion: 'Send welcome messages to new customers'
                })
            }

            // 6. NO TRANSACTIONS ALERT (during business hours)
            const hour = now.getHours()
            if (hour >= 10 && hour <= 20 && todayBills.length === 0) {
                detectedAnomalies.push({
                    id: 'no_sales',
                    type: 'negative',
                    severity: 'warning',
                    title: 'No Sales Today',
                    description: 'No transactions recorded yet during business hours.',
                    metric: '0',
                    metricLabel: 'transactions',
                    icon: Clock,
                    color: '#f59e0b',
                    suggestion: 'Check if system is working, consider promotions'
                })
            }

            // 7. PRICE ANOMALY (products with 0 or negative price)
            const priceIssues = products.filter(p => (p.price || 0) <= 0)
            if (priceIssues.length > 0) {
                detectedAnomalies.push({
                    id: 'price_issue',
                    type: 'negative',
                    severity: 'warning',
                    title: 'Pricing Issue Detected',
                    description: `${priceIssues.length} products have invalid pricing (₹0 or less).`,
                    metric: priceIssues.length,
                    metricLabel: 'products',
                    icon: AlertTriangle,
                    color: '#f59e0b',
                    suggestion: 'Update product prices immediately'
                })
            }

            // Determine system health
            const criticalCount = detectedAnomalies.filter(a => a.severity === 'critical').length
            const warningCount = detectedAnomalies.filter(a => a.severity === 'warning').length

            if (criticalCount > 0) {
                setSystemHealth('critical')
            } else if (warningCount > 0) {
                setSystemHealth('warning')
            } else {
                setSystemHealth('healthy')
            }

            setAnomalies(detectedAnomalies)
        } catch (error) {
            console.error('Anomaly detection error:', error)
        } finally {
            setLoading(false)
        }
    }

    const getHealthStyles = () => {
        switch (systemHealth) {
            case 'critical': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle }
            case 'warning': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: AlertTriangle }
            default: return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: CheckCircle2 }
        }
    }

    const healthStyles = getHealthStyles()
    const HealthIcon = healthStyles.icon

    if (loading) {
        return (
            <div className="anomaly-agent loading">
                <style>{anomalyStyles}</style>
                <Shield size={32} className="pulse" style={{ color: '#ef4444' }} />
                <p>AI Scanning for Anomalies...</p>
            </div>
        )
    }

    return (
        <div className="anomaly-agent">
            <style>{anomalyStyles}</style>

            <div className="agent-header">
                <div className="agent-title">
                    <Shield size={22} style={{ color: '#ef4444' }} />
                    <h3>Anomaly Detection AI</h3>
                    <span className="ai-badge"><Eye size={12} /> Real-time</span>
                </div>
                <button className="refresh-btn" onClick={detectAnomalies}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* System Health */}
            <div
                className="health-status"
                style={{ background: healthStyles.bg }}
            >
                <HealthIcon size={24} style={{ color: healthStyles.color }} />
                <div className="health-info">
                    <span className="health-label" style={{ color: healthStyles.color }}>
                        System: {systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1)}
                    </span>
                    <span className="health-detail">
                        {anomalies.length === 0 ? 'No anomalies detected' : `${anomalies.length} patterns detected`}
                    </span>
                </div>
            </div>

            {/* Anomalies List */}
            {anomalies.length === 0 ? (
                <div className="empty-state">
                    <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
                    <h4>All Systems Normal</h4>
                    <p>No unusual patterns detected in your business data.</p>
                </div>
            ) : (
                <div className="anomalies-list">
                    {anomalies.map(anomaly => {
                        const Icon = anomaly.icon

                        return (
                            <div
                                key={anomaly.id}
                                className={`anomaly-card ${anomaly.type}`}
                                style={{ borderLeftColor: anomaly.color }}
                            >
                                <div className="anomaly-header">
                                    <div
                                        className="anomaly-icon"
                                        style={{ backgroundColor: `${anomaly.color}20`, color: anomaly.color }}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <div className="anomaly-info">
                                        <h5>{anomaly.title}</h5>
                                        <p>{anomaly.description}</p>
                                    </div>
                                    <div className="anomaly-metric">
                                        <span className="metric-value">{anomaly.metric}</span>
                                        <span className="metric-label">{anomaly.metricLabel}</span>
                                    </div>
                                </div>
                                <div className="anomaly-suggestion">
                                    <Sparkles size={12} />
                                    <span>AI Suggestion: {anomaly.suggestion}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const anomalyStyles = `
    .anomaly-agent {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .anomaly-agent.loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        min-height: 300px;
        color: var(--text-secondary);
    }

    .agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .agent-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .agent-title h3 {
        margin: 0;
        font-size: 1.125rem;
    }

    .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #ef4444;
    }

    .refresh-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        color: var(--text-secondary);
        cursor: pointer;
    }

    .health-status {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 20px;
    }

    .health-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .health-label {
        font-weight: 600;
        font-size: 0.9375rem;
    }

    .health-detail {
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .empty-state {
        text-align: center;
        padding: 40px;
    }

    .empty-state h4 {
        margin: 16px 0 8px;
        color: var(--text-primary);
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }

    .anomalies-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 350px;
        overflow-y: auto;
    }

    .anomaly-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-left: 4px solid;
        border-radius: 12px;
        padding: 14px;
    }

    .anomaly-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }

    .anomaly-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        flex-shrink: 0;
    }

    .anomaly-info {
        flex: 1;
    }

    .anomaly-info h5 {
        margin: 0 0 4px;
        font-size: 0.875rem;
    }

    .anomaly-info p {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-secondary);
        line-height: 1.4;
    }

    .anomaly-metric {
        text-align: right;
        flex-shrink: 0;
    }

    .metric-value {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .metric-label {
        font-size: 0.625rem;
        color: var(--text-tertiary);
    }

    .anomaly-suggestion {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border-radius: 8px;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .anomaly-suggestion svg {
        color: #7c3aed;
        flex-shrink: 0;
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`
