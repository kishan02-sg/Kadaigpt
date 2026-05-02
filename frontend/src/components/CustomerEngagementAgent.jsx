import { useState, useEffect } from 'react'
import { MessageSquare, Users, Heart, Gift, Phone, Send, Sparkles, RefreshCw, CheckCircle2, Clock, Star, TrendingUp } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function CustomerEngagementAgent({ addToast }) {
    const [campaigns, setCampaigns] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCampaign, setSelectedCampaign] = useState(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        generateCampaigns()
    }, [])

    const generateCampaigns = async () => {
        setLoading(true)
        try {
            const [customers, bills] = await Promise.all([
                realDataService.getCustomers(),
                realDataService.getBills()
            ])

            const now = new Date()
            const campaigns = []

            // 1. Birthday Campaign - Find customers with birthdays this month
            const birthdayCustomers = customers.filter(c => {
                if (!c.birthday && !c.dob) return false
                const bday = new Date(c.birthday || c.dob)
                return bday.getMonth() === now.getMonth()
            })
            if (birthdayCustomers.length > 0) {
                campaigns.push({
                    id: 'birthday',
                    type: 'birthday',
                    name: 'Birthday Wishes',
                    icon: Gift,
                    color: '#ec4899',
                    targets: birthdayCustomers,
                    message: `🎂 Happy Birthday! As a valued customer, enjoy 20% OFF on your next purchase. Visit us today! - [Store Name]`,
                    expectedROI: '35%',
                    priority: 'high'
                })
            }

            // 2. Win-Back Campaign - Inactive customers (30+ days)
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            const inactiveCustomers = customers.filter(c => {
                const lastPurchase = bills
                    .filter(b => b.customer_id === c.id || b.customerId === c.id)
                    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))[0]

                if (!lastPurchase) return true
                return new Date(lastPurchase.created_at || lastPurchase.createdAt) < thirtyDaysAgo
            })
            if (inactiveCustomers.length > 0) {
                campaigns.push({
                    id: 'winback',
                    type: 'winback',
                    name: 'Win-Back Campaign',
                    icon: Heart,
                    color: '#ef4444',
                    targets: inactiveCustomers,
                    message: `We miss you! 💖 It's been a while since your last visit. Come back and get FLAT ₹100 OFF on orders above ₹500! - [Store Name]`,
                    expectedROI: '28%',
                    priority: 'high'
                })
            }

            // 3. VIP Appreciation - High spenders
            const vipCustomers = customers.filter(c => {
                const totalSpent = bills
                    .filter(b => b.customer_id === c.id || b.customerId === c.id)
                    .reduce((sum, b) => sum + (b.total || 0), 0)
                return totalSpent > 5000
            })
            if (vipCustomers.length > 0) {
                campaigns.push({
                    id: 'vip',
                    type: 'vip',
                    name: 'VIP Appreciation',
                    icon: Star,
                    color: '#f59e0b',
                    targets: vipCustomers,
                    message: `⭐ Exclusive VIP Offer! As our top customer, you get DOUBLE loyalty points on your next 3 purchases! Valid this week only. - [Store Name]`,
                    expectedROI: '45%',
                    priority: 'medium'
                })
            }

            // 4. New Customer Welcome
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            const newCustomers = customers.filter(c => {
                const createdAt = new Date(c.created_at || c.createdAt || now)
                return createdAt >= sevenDaysAgo
            })
            if (newCustomers.length > 0) {
                campaigns.push({
                    id: 'welcome',
                    type: 'welcome',
                    name: 'Welcome Message',
                    icon: Users,
                    color: '#22c55e',
                    targets: newCustomers,
                    message: `Welcome to [Store Name]! 🎉 Thank you for choosing us. Enjoy 10% OFF on your next purchase with code WELCOME10. See you soon!`,
                    expectedROI: '25%',
                    priority: 'medium'
                })
            }

            // 5. Loyalty Milestone
            const milestoneCustomers = customers.filter(c => {
                const points = c.loyalty_points || c.loyaltyPoints || 0
                return points >= 8000 && points < 10000
            })
            if (milestoneCustomers.length > 0) {
                campaigns.push({
                    id: 'milestone',
                    type: 'milestone',
                    name: 'Loyalty Milestone',
                    icon: TrendingUp,
                    color: '#7c3aed',
                    targets: milestoneCustomers,
                    message: `🏆 You're almost there! Just ${10000 - (milestoneCustomers[0]?.loyalty_points || 0)} more points to unlock ₹100 reward! Shop today and reach your goal! - [Store Name]`,
                    expectedROI: '40%',
                    priority: 'medium'
                })
            }

            // 6. Festive Campaign (always available)
            const festiveMonths = [0, 3, 9, 10] // Jan, Apr, Oct, Nov
            if (festiveMonths.includes(now.getMonth())) {
                const activeCustomers = customers.filter(c => {
                    const totalSpent = bills
                        .filter(b => b.customer_id === c.id || b.customerId === c.id)
                        .reduce((sum, b) => sum + (b.total || 0), 0)
                    return totalSpent > 0
                })
                if (activeCustomers.length > 0) {
                    campaigns.push({
                        id: 'festive',
                        type: 'festive',
                        name: 'Festive Blast',
                        icon: Sparkles,
                        color: '#3b82f6',
                        targets: activeCustomers,
                        message: `🎊 Festival Sale is HERE! Get up to 30% OFF on all products. Limited time offer. Visit us today! - [Store Name]`,
                        expectedROI: '50%',
                        priority: 'low'
                    })
                }
            }

            setCampaigns(campaigns)
        } catch (error) {
            console.error('Error generating campaigns:', error)
        } finally {
            setLoading(false)
        }
    }

    const sendCampaign = async (campaign) => {
        setSending(true)
        setSelectedCampaign(campaign.id)

        // Simulate sending (in real app, this would call WhatsApp/SMS API)
        await new Promise(resolve => setTimeout(resolve, 2000))

        addToast?.({
            type: 'success',
            message: `✅ Campaign "${campaign.name}" sent to ${campaign.targets.length} customers!`
        })

        setSending(false)
        setSelectedCampaign(null)
    }

    const totalReach = campaigns.reduce((sum, c) => sum + c.targets.length, 0)

    if (loading) {
        return (
            <div className="engagement-agent loading">
                <style>{engagementStyles}</style>
                <MessageSquare size={32} className="pulse" style={{ color: '#ec4899' }} />
                <p>AI Analyzing Customer Segments...</p>
            </div>
        )
    }

    return (
        <div className="engagement-agent">
            <style>{engagementStyles}</style>

            <div className="agent-header">
                <div className="agent-title">
                    <MessageSquare size={22} style={{ color: '#ec4899' }} />
                    <h3>Customer Engagement AI</h3>
                    <span className="ai-badge"><Sparkles size={12} /> Auto-Segment</span>
                </div>
                <button className="refresh-btn" onClick={generateCampaigns}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Quick Stats */}
            <div className="engagement-stats">
                <div className="stat">
                    <span className="stat-value">{campaigns.length}</span>
                    <span className="stat-label">AI Campaigns</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{totalReach}</span>
                    <span className="stat-label">Total Reach</span>
                </div>
                <div className="stat">
                    <span className="stat-value">~35%</span>
                    <span className="stat-label">Avg ROI</span>
                </div>
            </div>

            {campaigns.length === 0 ? (
                <div className="empty-state">
                    <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
                    <h4>No Campaigns Available</h4>
                    <p>Add more customers to unlock AI-powered campaigns.</p>
                </div>
            ) : (
                <div className="campaigns-list">
                    {campaigns.map(campaign => {
                        const Icon = campaign.icon
                        const isSending = sending && selectedCampaign === campaign.id

                        return (
                            <div
                                key={campaign.id}
                                className="campaign-card"
                                style={{ borderLeftColor: campaign.color }}
                            >
                                <div className="campaign-header">
                                    <div className="campaign-icon" style={{ backgroundColor: `${campaign.color}20`, color: campaign.color }}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="campaign-info">
                                        <h5>{campaign.name}</h5>
                                        <span className="campaign-meta">
                                            <Users size={12} />
                                            {campaign.targets.length} customers
                                        </span>
                                    </div>
                                    <div className="campaign-roi">
                                        <span className="roi-value">{campaign.expectedROI}</span>
                                        <span className="roi-label">Expected ROI</span>
                                    </div>
                                </div>

                                <p className="campaign-message">{campaign.message}</p>

                                <div className="campaign-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => sendCampaign(campaign)}
                                        disabled={isSending}
                                    >
                                        {isSending ? (
                                            <>
                                                <Clock size={14} className="spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={14} />
                                                Send via WhatsApp
                                            </>
                                        )}
                                    </button>
                                    <span className={`priority-badge ${campaign.priority}`}>
                                        {campaign.priority} priority
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const engagementStyles = `
    .engagement-agent {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .engagement-agent.loading {
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
        background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(236, 72, 153, 0.05));
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #ec4899;
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

    .engagement-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .engagement-stats .stat {
        text-align: center;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 12px;
    }

    .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: #ec4899;
    }

    .stat-label {
        font-size: 0.6875rem;
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

    .campaigns-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 400px;
        overflow-y: auto;
    }

    .campaign-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-left: 4px solid;
        border-radius: 12px;
        padding: 16px;
    }

    .campaign-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .campaign-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        flex-shrink: 0;
    }

    .campaign-info {
        flex: 1;
    }

    .campaign-info h5 {
        margin: 0 0 4px;
        font-size: 0.9375rem;
    }

    .campaign-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .campaign-roi {
        text-align: center;
    }

    .roi-value {
        display: block;
        font-size: 1.125rem;
        font-weight: 700;
        color: #22c55e;
    }

    .roi-label {
        font-size: 0.625rem;
        color: var(--text-tertiary);
    }

    .campaign-message {
        margin: 0 0 12px;
        padding: 12px;
        background: var(--bg-tertiary);
        border-radius: 8px;
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .campaign-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .priority-badge {
        padding: 4px 10px;
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: capitalize;
    }

    .priority-badge.high {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .priority-badge.medium {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
    }

    .priority-badge.low {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
    }

    .spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`
