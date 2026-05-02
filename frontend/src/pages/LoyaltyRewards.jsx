import { useState, useEffect } from 'react'
import { Gift, Star, Users, Trophy, ArrowUpRight, Plus, X, Check, Award, Zap, CreditCard, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import realDataService from '../services/realDataService'

// Loyalty tier definitions - NOT demo data, just configuration
const loyaltyTiers = [
    { name: "Bronze", minPoints: 0, color: "#cd7f32", discount: 0, icon: "🥉" },
    { name: "Silver", minPoints: 500, color: "#c0c0c0", discount: 2, icon: "🥈" },
    { name: "Gold", minPoints: 1000, color: "#ffd700", discount: 5, icon: "🥇" },
    { name: "Platinum", minPoints: 2000, color: "#e5e4e2", discount: 10, icon: "💎" },
]

// Static rewards options - NOT demo data, just configuration for what rewards are available
const rewardOptions = [
    { id: 1, name: "₹50 Off", points: 100, type: "discount" },
    { id: 2, name: "₹100 Off", points: 200, type: "discount" },
    { id: 3, name: "Free Delivery", points: 150, type: "service" },
    { id: 4, name: "Free Item", points: 300, type: "product" },
    { id: 5, name: "₹500 Voucher", points: 500, type: "discount" },
]

export default function LoyaltyRewards({ addToast }) {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [showAddPointsModal, setShowAddPointsModal] = useState(false)
    const [selectedCustomerForPoints, setSelectedCustomerForPoints] = useState(null)
    const [pointsToAdd, setPointsToAdd] = useState('')
    const [pointsReason, setPointsReason] = useState('purchase')

    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        setLoading(true)
        try {
            // Always fetch from REAL API - no demo data
            const data = await realDataService.getCustomers()
            const customerList = Array.isArray(data) ? data : []

            if (customerList.length === 0) {
                // Real user with no customers - show empty state
                setCustomers([])
            } else {
                const customersWithPoints = customerList.map(c => ({
                    ...c,
                    // Use actual loyalty_points from DB, or calculate from purchases
                    points: c.loyalty_points || c.loyaltyPoints || Math.floor((c.totalPurchases || c.total_purchases || 0) / 100),
                    tier: getTierFromPoints(c.loyalty_points || c.loyaltyPoints || Math.floor((c.totalPurchases || c.total_purchases || 0) / 100)),
                    totalSpent: c.totalPurchases || c.total_purchases || 0,
                    visits: c.visit_count || c.visits || 0
                }))
                setCustomers(customersWithPoints)
            }
        } catch (error) {
            console.error('Error loading loyalty customers:', error)
            // On error, show empty - NO demo data for real users
            setCustomers([])
            addToast('Could not load customers. Try again.', 'error')
        } finally {
            setLoading(false)
        }
    }

    const getTierFromPoints = (points) => {
        if (points >= 2000) return "Platinum"
        if (points >= 1000) return "Gold"
        if (points >= 500) return "Silver"
        return "Bronze"
    }

    const totalPoints = customers.reduce((sum, c) => sum + (c.points || 0), 0)
    const avgPointsPerCustomer = customers.length > 0 ? Math.round(totalPoints / customers.length) : 0

    const getTierInfo = (tierName) => loyaltyTiers.find(t => t.name === tierName)
    const getNextTier = (currentPoints) => {
        return loyaltyTiers.find(t => t.minPoints > currentPoints) || loyaltyTiers[loyaltyTiers.length - 1]
    }

    const handleRedeem = async (reward) => {
        if (selectedCustomer && selectedCustomer.points >= reward.points) {
            try {
                const newPoints = selectedCustomer.points - reward.points

                // Update in database
                await api.updateCustomer?.(selectedCustomer.id, {
                    loyalty_points: newPoints
                })

                setCustomers(customers.map(c => {
                    if (c.id === selectedCustomer.id) {
                        return { ...c, points: newPoints, tier: getTierFromPoints(newPoints) }
                    }
                    return c
                }))
                setShowRedeemModal(false)
                setSelectedCustomer(null)
                addToast(`${reward.name} redeemed for ${selectedCustomer.name}!`, 'success')
            } catch (error) {
                addToast('Failed to redeem reward', 'error')
            }
        }
    }

    const handleAddPoints = async () => {
        if (!selectedCustomerForPoints) {
            addToast('Please select a customer', 'error')
            return
        }
        if (!pointsToAdd || parseInt(pointsToAdd) <= 0) {
            addToast('Please enter valid points', 'error')
            return
        }

        const points = parseInt(pointsToAdd)

        try {
            const newPoints = (selectedCustomerForPoints.points || 0) + points

            // Update in database
            await api.updateCustomer?.(selectedCustomerForPoints.id, {
                loyalty_points: newPoints
            })

            setCustomers(customers.map(c => {
                if (c.id === selectedCustomerForPoints.id) {
                    return {
                        ...c,
                        points: newPoints,
                        tier: getTierFromPoints(newPoints)
                    }
                }
                return c
            }))

            addToast(`Added ${points} points to ${selectedCustomerForPoints.name}!`, 'success')
            setShowAddPointsModal(false)
            setSelectedCustomerForPoints(null)
            setPointsToAdd('')
            setPointsReason('purchase')
        } catch (error) {
            addToast('Failed to add points', 'error')
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="loyalty-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={32} className="spin" style={{ color: 'var(--primary-500)', marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading loyalty data...</p>
                </div>
            </div>
        )
    }

    // Empty state for new users
    if (customers.length === 0) {
        return (
            <div className="loyalty-page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">🎁 Loyalty & Rewards</h1>
                        <p className="page-subtitle">Retain customers with points and rewards</p>
                    </div>
                </div>

                <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <Gift size={64} style={{ color: 'var(--primary-400)', marginBottom: '24px' }} />
                    <h2 style={{ marginBottom: '12px' }}>No Customers Yet</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px' }}>
                        Start creating bills with customer phone numbers to automatically build your loyalty program.
                        Customers earn 10 points per ₹100 spent!
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={() => window.location.hash = '#create-bill'}>
                            <Plus size={18} /> Create First Bill
                        </button>
                        <button className="btn btn-secondary" onClick={loadCustomers}>
                            <RefreshCw size={18} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Tier Info - Always show */}
                <div className="card tier-info-card" style={{ marginTop: '24px' }}>
                    <h3>How Loyalty Tiers Work</h3>
                    <div className="tiers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '16px' }}>
                        {loyaltyTiers.map(tier => (
                            <div key={tier.name} style={{
                                textAlign: 'center',
                                padding: '20px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                                border: `2px solid ${tier.color}`
                            }}>
                                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>{tier.icon}</span>
                                <span style={{ fontWeight: '700', display: 'block', marginBottom: '4px' }}>{tier.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '8px' }}>{tier.minPoints}+ pts</span>
                                <span style={{ fontWeight: '600', color: 'var(--success)' }}>{tier.discount}% off</span>
                            </div>
                        ))}
                    </div>
                </div>
                <style>{loyaltyStyles}</style>
            </div>
        )
    }

    return (
        <div className="loyalty-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🎁 Loyalty & Rewards</h1>
                    <p className="page-subtitle">Retain customers with points and rewards</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" onClick={loadCustomers}>
                        <RefreshCw size={18} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAddPointsModal(true)}>
                        <Plus size={18} /> Add Points
                    </button>
                </div>
            </div>

            {/* Stats - calculated from real customer data */}
            <div className="loyalty-stats">
                <div className="stat-card">
                    <Gift size={24} />
                    <div>
                        <span className="value">{totalPoints.toLocaleString()}</span>
                        <span className="label">Total Points Issued</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Users size={24} />
                    <div>
                        <span className="value">{customers.length}</span>
                        <span className="label">Loyalty Members</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Star size={24} />
                    <div>
                        <span className="value">{avgPointsPerCustomer}</span>
                        <span className="label">Avg Points/Customer</span>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <Trophy size={24} />
                    <div>
                        <span className="value">{customers.filter(c => c.tier === 'Gold' || c.tier === 'Platinum').length}</span>
                        <span className="label">Premium Members</span>
                    </div>
                </div>
            </div>

            {/* Tier Info */}
            <div className="card tier-info-card">
                <h3>Loyalty Tiers</h3>
                <div className="tiers-grid">
                    {loyaltyTiers.map(tier => (
                        <div key={tier.name} className="tier-item" style={{ borderColor: tier.color }}>
                            <span className="tier-icon">{tier.icon}</span>
                            <span className="tier-name">{tier.name}</span>
                            <span className="tier-requirement">{tier.minPoints}+ pts</span>
                            <span className="tier-benefit">{tier.discount}% off</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Customer List - REAL DATA */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Star size={20} /> Loyalty Members</h3>
                </div>
                <div className="loyalty-customers">
                    {customers.map(customer => {
                        const tierInfo = getTierInfo(customer.tier)
                        const nextTier = getNextTier(customer.points)
                        const progress = nextTier ? (customer.points / nextTier.minPoints) * 100 : 100

                        return (
                            <div key={customer.id} className="loyalty-customer-card">
                                <div className="customer-header">
                                    <div className="customer-avatar" style={{ background: tierInfo?.color }}>
                                        {tierInfo?.icon}
                                    </div>
                                    <div className="customer-info">
                                        <h4>{customer.name}</h4>
                                        <span className="customer-phone">{customer.phone}</span>
                                    </div>
                                    <div className="tier-badge" style={{ backgroundColor: tierInfo?.color }}>
                                        {customer.tier}
                                    </div>
                                </div>

                                <div className="points-section">
                                    <div className="points-info">
                                        <span className="current-points">{(customer.points || 0).toLocaleString()}</span>
                                        <span className="points-label">Points</span>
                                    </div>
                                    {nextTier && customer.tier !== 'Platinum' && (
                                        <div className="next-tier-progress">
                                            <span className="progress-text">{nextTier.minPoints - customer.points} pts to {nextTier.name}</span>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="customer-stats">
                                    <div className="stat">
                                        <span className="stat-value">₹{(customer.totalSpent || 0).toLocaleString()}</span>
                                        <span className="stat-label">Total Spent</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-value">{customer.visits || 0}</span>
                                        <span className="stat-label">Visits</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-value">{tierInfo?.discount || 0}%</span>
                                        <span className="stat-label">Discount</span>
                                    </div>
                                </div>

                                <div className="customer-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => { setSelectedCustomer(customer); setShowRedeemModal(true); }}
                                        disabled={(customer.points || 0) < 100}
                                    >
                                        <Gift size={14} /> Redeem
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => { setSelectedCustomerForPoints(customer); setShowAddPointsModal(true); }}
                                    >
                                        <Plus size={14} /> Add Points
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Redeem Modal */}
            {showRedeemModal && selectedCustomer && (
                <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Redeem Rewards</h3>
                            <button className="modal-close" onClick={() => setShowRedeemModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="redeem-customer">
                                <span className="name">{selectedCustomer.name}</span>
                                <span className="points">{selectedCustomer.points || 0} points available</span>
                            </div>
                            <div className="rewards-grid">
                                {rewardOptions.map(reward => (
                                    <div
                                        key={reward.id}
                                        className={`reward-card ${(selectedCustomer.points || 0) < reward.points ? 'disabled' : ''}`}
                                        onClick={() => (selectedCustomer.points || 0) >= reward.points && handleRedeem(reward)}
                                    >
                                        <span className="reward-icon">
                                            {reward.type === 'discount' ? '💰' : reward.type === 'product' ? '🎁' : '🚚'}
                                        </span>
                                        <span className="reward-name">{reward.name}</span>
                                        <span className="reward-points">{reward.points} pts</span>
                                        {(selectedCustomer.points || 0) < reward.points && (
                                            <span className="insufficient">Need {reward.points - (selectedCustomer.points || 0)} more</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Points Modal */}
            {showAddPointsModal && (
                <div className="modal-overlay" onClick={() => setShowAddPointsModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Loyalty Points</h3>
                            <button className="modal-close" onClick={() => setShowAddPointsModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Select Customer *</label>
                                <select
                                    className="form-input"
                                    value={selectedCustomerForPoints?.id || ''}
                                    onChange={(e) => {
                                        const cust = customers.find(c => c.id === parseInt(e.target.value))
                                        setSelectedCustomerForPoints(cust)
                                    }}
                                >
                                    <option value="">Choose a customer...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.phone} ({c.points || 0} pts)</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Points to Add *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g., 100"
                                    value={pointsToAdd}
                                    onChange={(e) => setPointsToAdd(e.target.value)}
                                    min="1"
                                />
                                <span className="form-hint">10 points = ₹100 spent</span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason</label>
                                <select
                                    className="form-input"
                                    value={pointsReason}
                                    onChange={(e) => setPointsReason(e.target.value)}
                                >
                                    <option value="purchase">Purchase</option>
                                    <option value="bonus">Bonus Points</option>
                                    <option value="referral">Referral Bonus</option>
                                    <option value="birthday">Birthday Bonus</option>
                                    <option value="festival">Festival Bonus</option>
                                    <option value="adjustment">Manual Adjustment</option>
                                </select>
                            </div>
                            {selectedCustomerForPoints && pointsToAdd && (
                                <div className="points-preview">
                                    <span>New Balance: </span>
                                    <strong>{(selectedCustomerForPoints.points || 0) + parseInt(pointsToAdd || 0)} points</strong>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddPointsModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddPoints}>
                                <Plus size={16} /> Add Points
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{loyaltyStyles}</style>
        </div>
    )
}

const loyaltyStyles = `
    .loyalty-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 1024px) { .loyalty-stats { grid-template-columns: repeat(2, 1fr); } }
    .stat-card {
      display: flex; align-items: center; gap: 16px;
      padding: 20px; background: var(--bg-card);
      border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
    }
    .stat-card svg { color: var(--primary-400); }
    .stat-card.highlight { background: var(--gradient-primary); color: white; border: none; }
    .stat-card.highlight svg { color: white; }
    .stat-card .value { font-size: 1.5rem; font-weight: 700; display: block; }
    .stat-card .label { font-size: 0.8125rem; opacity: 0.8; }

    .tier-info-card { margin-bottom: 24px; }
    .tier-info-card h3 { margin-bottom: 16px; }
    .tiers-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 900px) { .tiers-grid { grid-template-columns: repeat(2, 1fr); } }
    .tier-item { 
      text-align: center; padding: 20px; 
      background: var(--bg-tertiary); border-radius: var(--radius-lg);
      border: 2px solid; transition: transform var(--transition-fast);
    }
    .tier-item:hover { transform: translateY(-2px); }
    .tier-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
    .tier-name { font-weight: 700; display: block; margin-bottom: 4px; }
    .tier-requirement { font-size: 0.75rem; color: var(--text-tertiary); display: block; margin-bottom: 8px; }
    .tier-benefit { font-weight: 600; color: var(--success); }

    .loyalty-customers { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .loyalty-customer-card {
      background: var(--bg-tertiary); border-radius: var(--radius-xl);
      padding: 20px; transition: all var(--transition-fast);
    }
    .loyalty-customer-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

    .customer-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .customer-avatar { width: 48px; height: 48px; border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
    .customer-info h4 { margin: 0 0 2px; }
    .customer-phone { font-size: 0.75rem; color: var(--text-tertiary); }
    .tier-badge { margin-left: auto; padding: 4px 12px; border-radius: var(--radius-md); font-size: 0.75rem; font-weight: 600; color: #1a1a2e; }

    .points-section { margin-bottom: 16px; }
    .points-info { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .current-points { font-size: 1.75rem; font-weight: 800; color: var(--primary-400); }
    .points-label { font-size: 0.875rem; color: var(--text-secondary); }
    .next-tier-progress { }
    .progress-text { font-size: 0.75rem; color: var(--text-tertiary); display: block; margin-bottom: 4px; }
    .progress-bar { height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--gradient-primary); border-radius: 3px; }

    .customer-stats { display: flex; gap: 16px; margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md); }
    .stat { text-align: center; flex: 1; }
    .stat-value { font-weight: 600; display: block; }
    .stat-label { font-size: 0.6875rem; color: var(--text-tertiary); }

    .customer-actions { display: flex; gap: 8px; }
    .customer-actions .btn { flex: 1; }

    .redeem-customer { padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); margin-bottom: 20px; text-align: center; }
    .redeem-customer .name { font-weight: 600; display: block; margin-bottom: 4px; }
    .redeem-customer .points { color: var(--primary-400); font-weight: 700; }

    .rewards-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .reward-card {
      padding: 20px; text-align: center; background: var(--bg-tertiary);
      border: 2px solid var(--border-subtle); border-radius: var(--radius-lg);
      cursor: pointer; transition: all var(--transition-fast);
    }
    .reward-card:hover:not(.disabled) { border-color: var(--primary-400); transform: translateY(-2px); }
    .reward-card.disabled { opacity: 0.5; cursor: not-allowed; }
    .reward-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
    .reward-name { font-weight: 600; display: block; margin-bottom: 4px; }
    .reward-points { font-size: 0.875rem; color: var(--primary-400); font-weight: 600; display: block; }
    .insufficient { font-size: 0.6875rem; color: var(--error); margin-top: 4px; display: block; }

    .points-preview { padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md); text-align: center; margin-top: 12px; }
    .points-preview strong { color: var(--primary-500); }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`
