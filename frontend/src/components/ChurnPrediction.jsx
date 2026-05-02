import { useState, useEffect } from 'react'
import { Users, AlertTriangle, TrendingDown, Phone, MessageCircle, Gift, Calendar, RefreshCw, ChevronRight, UserX, Star, Clock } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function ChurnPrediction({ addToast }) {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCustomer, setSelectedCustomer] = useState(null)

    useEffect(() => {
        loadChurnPredictions()
    }, [])

    const loadChurnPredictions = async () => {
        setLoading(true)
        try {
            const allCustomers = await realDataService.getCustomers()
            const bills = await realDataService.getBills()

            // Calculate churn risk for each customer
            const customersWithRisk = allCustomers.map(customer => {
                const customerBills = bills.filter(b =>
                    b.customer_phone === customer.phone ||
                    b.customer_id === customer.id
                )

                const riskData = calculateChurnRisk(customer, customerBills)
                return { ...customer, ...riskData }
            })

            // Sort by risk score (highest first)
            customersWithRisk.sort((a, b) => b.riskScore - a.riskScore)

            setCustomers(customersWithRisk)
        } catch (error) {
            console.error('Failed to load churn data:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateChurnRisk = (customer, bills) => {
        const now = new Date()
        let riskScore = 0
        let riskFactors = []

        // Factor 1: Days since last purchase (0-30 points)
        let daysSinceLastPurchase = 999
        if (bills.length > 0) {
            const lastBill = bills.sort((a, b) =>
                new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
            )[0]
            daysSinceLastPurchase = Math.floor(
                (now - new Date(lastBill.created_at || lastBill.createdAt)) / (1000 * 60 * 60 * 24)
            )
        }

        if (daysSinceLastPurchase > 60) {
            riskScore += 30
            riskFactors.push({ text: `No purchase in ${daysSinceLastPurchase} days`, severity: 'high' })
        } else if (daysSinceLastPurchase > 30) {
            riskScore += 20
            riskFactors.push({ text: `Last purchase ${daysSinceLastPurchase} days ago`, severity: 'medium' })
        } else if (daysSinceLastPurchase > 14) {
            riskScore += 10
            riskFactors.push({ text: `${daysSinceLastPurchase} days since last visit`, severity: 'low' })
        }

        // Factor 2: Declining frequency (0-25 points)
        if (bills.length >= 4) {
            const recentBills = bills.slice(0, Math.ceil(bills.length / 2))
            const olderBills = bills.slice(Math.ceil(bills.length / 2))

            const recentFreq = recentBills.length
            const olderFreq = olderBills.length

            if (recentFreq < olderFreq * 0.5) {
                riskScore += 25
                riskFactors.push({ text: 'Visit frequency dropped significantly', severity: 'high' })
            } else if (recentFreq < olderFreq * 0.75) {
                riskScore += 15
                riskFactors.push({ text: 'Declining visit frequency', severity: 'medium' })
            }
        }

        // Factor 3: Declining spend (0-25 points)
        if (bills.length >= 4) {
            const recentBills = bills.slice(0, Math.ceil(bills.length / 2))
            const olderBills = bills.slice(Math.ceil(bills.length / 2))

            const recentAvg = recentBills.reduce((s, b) => s + (b.total || 0), 0) / recentBills.length
            const olderAvg = olderBills.reduce((s, b) => s + (b.total || 0), 0) / olderBills.length

            if (recentAvg < olderAvg * 0.5) {
                riskScore += 25
                riskFactors.push({ text: 'Average spend dropped 50%+', severity: 'high' })
            } else if (recentAvg < olderAvg * 0.75) {
                riskScore += 15
                riskFactors.push({ text: 'Average bill value declining', severity: 'medium' })
            }
        }

        // Factor 4: Low engagement (0-20 points)
        const totalPurchases = customer.total_purchases || customer.totalPurchases || 0
        const visitCount = customer.visit_count || customer.visits || bills.length

        if (visitCount < 3 && daysSinceLastPurchase > 14) {
            riskScore += 20
            riskFactors.push({ text: 'Low engagement (few visits)', severity: 'medium' })
        }

        // Factor 5: No loyalty program (0-10 points)
        const loyaltyPoints = customer.loyalty_points || customer.loyaltyPoints || 0
        if (loyaltyPoints === 0 && visitCount > 0) {
            riskScore += 10
            riskFactors.push({ text: 'Not on loyalty program', severity: 'low' })
        }

        // Determine risk level
        let riskLevel, riskColor
        if (riskScore >= 60) {
            riskLevel = 'High Risk'
            riskColor = '#ef4444'
        } else if (riskScore >= 35) {
            riskLevel = 'Medium Risk'
            riskColor = '#f59e0b'
        } else if (riskScore >= 15) {
            riskLevel = 'Low Risk'
            riskColor = '#84cc16'
        } else {
            riskLevel = 'Healthy'
            riskColor = '#22c55e'
        }

        // Generate retention actions
        const retentionActions = generateRetentionActions(riskScore, riskFactors, customer)

        return {
            riskScore: Math.min(100, riskScore),
            riskLevel,
            riskColor,
            riskFactors,
            retentionActions,
            daysSinceLastPurchase,
            totalPurchases,
            visitCount
        }
    }

    const generateRetentionActions = (riskScore, factors, customer) => {
        const actions = []

        if (riskScore >= 60) {
            actions.push({
                icon: Phone,
                text: 'Personal call from owner',
                priority: 'urgent'
            })
            actions.push({
                icon: Gift,
                text: 'Send 20% discount offer',
                priority: 'urgent'
            })
        }

        if (riskScore >= 35) {
            actions.push({
                icon: MessageCircle,
                text: 'WhatsApp with special offer',
                priority: 'high'
            })
        }

        const hasLoyaltyIssue = factors.some(f => f.text.includes('loyalty'))
        if (hasLoyaltyIssue) {
            actions.push({
                icon: Star,
                text: 'Enroll in loyalty program',
                priority: 'medium'
            })
        }

        if (actions.length === 0) {
            actions.push({
                icon: Calendar,
                text: 'Schedule follow-up reminder',
                priority: 'low'
            })
        }

        return actions
    }

    const handleSendWhatsApp = (customer) => {
        const message = encodeURIComponent(
            `Hi ${customer.name}! 🙏\n\nWe miss you at our store! Here's a special 15% discount just for you on your next visit.\n\nUse code: COMEBACK15\n\nValid for 7 days. See you soon! 🎁`
        )
        window.open(`https://wa.me/91${customer.phone}?text=${message}`, '_blank')
        addToast(`WhatsApp opened for ${customer.name}`, 'success')
    }

    // Get at-risk customers
    const atRiskCustomers = customers.filter(c => c.riskScore >= 35)
    const highRiskCount = customers.filter(c => c.riskScore >= 60).length
    const mediumRiskCount = customers.filter(c => c.riskScore >= 35 && c.riskScore < 60).length

    if (loading) {
        return (
            <div className="churn-panel loading">
                <UserX size={32} className="pulse" style={{ color: 'var(--error)' }} />
                <style>{churnStyles}</style>
            </div>
        )
    }

    return (
        <div className="churn-panel">
            <style>{churnStyles}</style>

            <div className="churn-header">
                <div className="churn-title">
                    <AlertTriangle size={22} style={{ color: '#f59e0b' }} />
                    <h3>Churn Prediction</h3>
                    <span className="ai-badge">🤖 AI Analysis</span>
                </div>
                <button className="refresh-btn" onClick={loadChurnPredictions}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Summary Stats */}
            <div className="churn-stats">
                <div className="churn-stat danger">
                    <UserX size={20} />
                    <div>
                        <span className="value">{highRiskCount}</span>
                        <span className="label">High Risk</span>
                    </div>
                </div>
                <div className="churn-stat warning">
                    <AlertTriangle size={20} />
                    <div>
                        <span className="value">{mediumRiskCount}</span>
                        <span className="label">Medium Risk</span>
                    </div>
                </div>
                <div className="churn-stat success">
                    <Users size={20} />
                    <div>
                        <span className="value">{customers.length - atRiskCustomers.length}</span>
                        <span className="label">Healthy</span>
                    </div>
                </div>
            </div>

            {/* At-Risk Customers List */}
            {atRiskCustomers.length === 0 ? (
                <div className="no-risk">
                    <Star size={48} style={{ color: '#22c55e' }} />
                    <h4>All Customers Healthy! 🎉</h4>
                    <p>No customers are at risk of churning</p>
                </div>
            ) : (
                <div className="at-risk-list">
                    <h4><AlertTriangle size={16} /> Customers Needing Attention ({atRiskCustomers.length})</h4>

                    {atRiskCustomers.slice(0, 5).map(customer => (
                        <div
                            key={customer.id}
                            className={`risk-card ${selectedCustomer?.id === customer.id ? 'expanded' : ''}`}
                            onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
                        >
                            <div className="risk-card-header">
                                <div className="customer-avatar" style={{ backgroundColor: customer.riskColor }}>
                                    {customer.name?.charAt(0) || '?'}
                                </div>
                                <div className="customer-info">
                                    <h5>{customer.name || 'Unknown'}</h5>
                                    <span className="customer-phone">{customer.phone}</span>
                                </div>
                                <div className="risk-badge" style={{ backgroundColor: customer.riskColor }}>
                                    {customer.riskLevel}
                                </div>
                                <ChevronRight size={16} className={`chevron ${selectedCustomer?.id === customer.id ? 'rotated' : ''}`} />
                            </div>

                            {selectedCustomer?.id === customer.id && (
                                <div className="risk-details">
                                    <div className="risk-factors">
                                        <h6>Risk Factors:</h6>
                                        {customer.riskFactors.map((factor, i) => (
                                            <div key={i} className={`factor-item ${factor.severity}`}>
                                                <span className="factor-dot"></span>
                                                {factor.text}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="retention-actions">
                                        <h6>Recommended Actions:</h6>
                                        {customer.retentionActions.map((action, i) => (
                                            <div key={i} className={`action-item ${action.priority}`}>
                                                <action.icon size={14} />
                                                <span>{action.text}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="quick-actions">
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(customer); }}
                                        >
                                            <MessageCircle size={14} /> Send Offer
                                        </button>
                                        <a
                                            href={`tel:${customer.phone}`}
                                            className="btn btn-primary btn-sm"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Phone size={14} /> Call Now
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {atRiskCustomers.length > 5 && (
                        <div className="show-more">+ {atRiskCustomers.length - 5} more customers at risk</div>
                    )}
                </div>
            )}
        </div>
    )
}

const churnStyles = `
    .churn-panel {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .churn-panel.loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
    }

    .churn-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .churn-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .churn-title h3 {
        margin: 0;
        font-size: 1.125rem;
    }

    .ai-badge {
        font-size: 0.6875rem;
        padding: 4px 8px;
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        border-radius: 100px;
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
    }

    .churn-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .churn-stat {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 10px;
    }

    .churn-stat.danger {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .churn-stat.warning {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
    }

    .churn-stat.success {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
    }

    .churn-stat .value {
        font-size: 1.25rem;
        font-weight: 700;
        display: block;
    }

    .churn-stat .label {
        font-size: 0.6875rem;
        opacity: 0.8;
    }

    .no-risk {
        text-align: center;
        padding: 32px;
    }

    .no-risk h4 { margin: 16px 0 8px; }
    .no-risk p { color: var(--text-secondary); margin: 0; font-size: 0.875rem; }

    .at-risk-list h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin: 0 0 12px;
    }

    .risk-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.2s;
        overflow: hidden;
    }

    .risk-card:hover {
        border-color: var(--primary-400);
    }

    .risk-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
    }

    .customer-avatar {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 1.125rem;
    }

    .customer-info {
        flex: 1;
    }

    .customer-info h5 {
        margin: 0 0 2px;
        font-size: 0.9375rem;
    }

    .customer-phone {
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .risk-badge {
        padding: 4px 10px;
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: white;
    }

    .chevron {
        color: var(--text-tertiary);
        transition: transform 0.2s;
    }

    .chevron.rotated {
        transform: rotate(90deg);
    }

    .risk-details {
        padding: 0 14px 14px;
        border-top: 1px solid var(--border-subtle);
    }

    .risk-factors, .retention-actions {
        margin-top: 12px;
    }

    .risk-factors h6, .retention-actions h6 {
        font-size: 0.75rem;
        color: var(--text-tertiary);
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .factor-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin-bottom: 6px;
    }

    .factor-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    .factor-item.high .factor-dot { background: #ef4444; }
    .factor-item.medium .factor-dot { background: #f59e0b; }
    .factor-item.low .factor-dot { background: #84cc16; }

    .action-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8125rem;
        color: var(--text-primary);
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border-radius: 8px;
        margin-bottom: 6px;
    }

    .action-item.urgent { border-left: 3px solid #ef4444; }
    .action-item.high { border-left: 3px solid #f59e0b; }
    .action-item.medium { border-left: 3px solid #3b82f6; }
    .action-item.low { border-left: 3px solid #6b7280; }

    .quick-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
    }

    .quick-actions .btn {
        flex: 1;
    }

    .show-more {
        text-align: center;
        padding: 12px;
        color: var(--text-tertiary);
        font-size: 0.8125rem;
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`
