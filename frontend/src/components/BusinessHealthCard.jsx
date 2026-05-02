import { useState, useEffect } from 'react'
import { Heart, TrendingUp, TrendingDown, Package, Users, DollarSign, Calendar, CreditCard, ShoppingBag, Activity, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function BusinessHealthCard({ addToast, onViewDetails }) {
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        loadHealth()
    }, [])

    const loadHealth = async () => {
        setLoading(true)
        try {
            const data = await realDataService.getBusinessHealthScore()
            setHealth(data)
        } catch (error) {
            console.error('Failed to load health score:', error)
        } finally {
            setLoading(false)
        }
    }

    const metricIcons = {
        growth: TrendingUp,
        inventory: Package,
        retention: Users,
        avgBill: DollarSign,
        frequency: Activity,
        collection: CreditCard,
        diversity: ShoppingBag,
        creditHealth: AlertTriangle,
        consistency: Calendar
    }

    const metricLabels = {
        growth: 'Sales Growth',
        inventory: 'Inventory Health',
        retention: 'Customer Retention',
        avgBill: 'Avg Bill Value',
        frequency: 'Transaction Frequency',
        collection: 'Payment Collection',
        diversity: 'Product Diversity',
        creditHealth: 'Credit Outstanding',
        consistency: 'Sales Consistency'
    }

    const statusColors = {
        excellent: '#22c55e',
        good: '#84cc16',
        needs_attention: '#f59e0b'
    }

    if (loading) {
        return (
            <div className="health-card loading">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                    <Heart size={32} className="pulse" style={{ color: 'var(--primary-500)' }} />
                </div>
                <style>{healthStyles}</style>
            </div>
        )
    }

    if (!health || health.dataPoints === 0) {
        return (
            <div className="health-card empty">
                <div style={{ textAlign: 'center', padding: '32px' }}>
                    <Heart size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }} />
                    <h3 style={{ margin: '0 0 8px' }}>Business Health Score</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Start creating bills to see your health score!
                    </p>
                </div>
                <style>{healthStyles}</style>
            </div>
        )
    }

    return (
        <div className="health-card">
            <style>{healthStyles}</style>

            <div className="health-header">
                <div className="health-title">
                    <Heart size={22} style={{ color: health.gradeColor }} />
                    <h3>Business Health</h3>
                </div>
                <button className="refresh-btn" onClick={loadHealth}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="health-score-section">
                <div className="score-circle" style={{ '--score-color': health.gradeColor }}>
                    <div className="score-inner">
                        <span className="grade">{health.grade}</span>
                        <span className="score">{health.score}%</span>
                    </div>
                    <svg className="score-ring" viewBox="0 0 100 100">
                        <circle className="ring-bg" cx="50" cy="50" r="45" />
                        <circle
                            className="ring-fill"
                            cx="50" cy="50" r="45"
                            style={{
                                stroke: health.gradeColor,
                                strokeDasharray: `${health.score * 2.83} 283`
                            }}
                        />
                    </svg>
                </div>
                <p className="recommendation">{health.recommendation}</p>
            </div>

            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Hide Details' : 'View Metrics'}
                <ChevronRight size={16} className={expanded ? 'rotated' : ''} />
            </button>

            {expanded && (
                <div className="metrics-grid">
                    {Object.entries(health.metrics).map(([key, metric]) => {
                        const Icon = metricIcons[key] || Activity
                        const StatusIcon = metric.status === 'excellent' ? CheckCircle2 : metric.status === 'good' ? CheckCircle2 : AlertCircle

                        return (
                            <div key={key} className="metric-item">
                                <div className="metric-header">
                                    <Icon size={16} />
                                    <span className="metric-label">{metricLabels[key] || key}</span>
                                </div>
                                <div className="metric-value">{metric.value}</div>
                                <div className="metric-bar">
                                    <div
                                        className="metric-fill"
                                        style={{
                                            width: `${(metric.score / metric.max) * 100}%`,
                                            backgroundColor: statusColors[metric.status]
                                        }}
                                    />
                                </div>
                                <div className="metric-status" style={{ color: statusColors[metric.status] }}>
                                    <StatusIcon size={12} />
                                    <span>{metric.status === 'needs_attention' ? 'Needs Work' : metric.status === 'excellent' ? 'Excellent' : 'Good'}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="health-footer">
                <span className="data-points">Based on {health.dataPoints} transactions</span>
            </div>
        </div>
    )
}

const healthStyles = `
    .health-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .health-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .health-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .health-title h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
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
        transition: all 0.2s;
    }

    .refresh-btn:hover {
        background: var(--bg-secondary);
        color: var(--primary-500);
    }

    .health-score-section {
        text-align: center;
        margin-bottom: 20px;
    }

    .score-circle {
        position: relative;
        width: 120px;
        height: 120px;
        margin: 0 auto 16px;
    }

    .score-inner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
    }

    .score-inner .grade {
        display: block;
        font-size: 2rem;
        font-weight: 800;
        color: var(--score-color);
        line-height: 1;
    }

    .score-inner .score {
        display: block;
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-top: 4px;
    }

    .score-ring {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
    }

    .ring-bg {
        fill: none;
        stroke: var(--bg-tertiary);
        stroke-width: 8;
    }

    .ring-fill {
        fill: none;
        stroke-width: 8;
        stroke-linecap: round;
        transition: stroke-dasharray 0.5s ease;
    }

    .recommendation {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin: 0;
        max-width: 280px;
        margin: 0 auto;
        line-height: 1.5;
    }

    .expand-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        color: var(--text-secondary);
        font-size: 0.8125rem;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 16px;
    }

    .expand-btn:hover {
        background: var(--bg-secondary);
        color: var(--primary-500);
    }

    .expand-btn svg {
        transition: transform 0.2s;
    }

    .expand-btn svg.rotated {
        transform: rotate(90deg);
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
    }

    .metric-item {
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 10px;
    }

    .metric-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        color: var(--text-secondary);
    }

    .metric-label {
        font-size: 0.75rem;
        font-weight: 500;
    }

    .metric-value {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 8px;
    }

    .metric-bar {
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 6px;
    }

    .metric-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
    }

    .metric-status {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.6875rem;
        font-weight: 500;
    }

    .health-footer {
        text-align: center;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
    }

    .data-points {
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.1); }
    }
`
