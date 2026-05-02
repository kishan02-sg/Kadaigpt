import { useState, useEffect } from 'react'
import { Package, TrendingUp, AlertTriangle, Sparkles, RefreshCw, ShoppingCart, Calendar, ArrowRight, Clock, Zap, CheckCircle2 } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function AutoRestockAgent({ addToast }) {
    const [recommendations, setRecommendations] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedItems, setSelectedItems] = useState([])

    useEffect(() => {
        analyzeInventory()
    }, [])

    const analyzeInventory = async () => {
        setLoading(true)
        try {
            const [products, bills] = await Promise.all([
                realDataService.getProducts(),
                realDataService.getBills()
            ])

            const now = new Date()
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

            // Analyze sales velocity for each product
            const productAnalysis = products.map(product => {
                // Count sales in last week
                let weekSales = 0
                let monthSales = 0

                bills.forEach(bill => {
                    const billDate = new Date(bill.created_at || bill.createdAt)
                    const items = bill.items || []

                    items.forEach(item => {
                        if (item.product_id === product.id || item.productId === product.id || item.name === product.name) {
                            const qty = item.quantity || 1
                            if (billDate >= weekAgo) weekSales += qty
                            if (billDate >= monthAgo) monthSales += qty
                        }
                    })
                })

                const dailySalesVelocity = weekSales > 0 ? weekSales / 7 : monthSales / 30
                const currentStock = product.stock || 0
                const minStock = product.minStock || product.min_stock || 5

                // Calculate days until stockout
                const daysUntilStockout = dailySalesVelocity > 0
                    ? Math.floor(currentStock / dailySalesVelocity)
                    : currentStock > 0 ? 999 : 0

                // Calculate recommended order quantity (2 weeks supply + safety stock)
                const recommendedOrder = Math.max(0, Math.ceil(dailySalesVelocity * 14) + minStock - currentStock)

                // Determine urgency level
                let urgency, urgencyColor
                if (currentStock === 0) {
                    urgency = 'CRITICAL'
                    urgencyColor = '#ef4444'
                } else if (daysUntilStockout <= 3) {
                    urgency = 'URGENT'
                    urgencyColor = '#f59e0b'
                } else if (daysUntilStockout <= 7) {
                    urgency = 'SOON'
                    urgencyColor = '#3b82f6'
                } else {
                    urgency = 'HEALTHY'
                    urgencyColor = '#22c55e'
                }

                return {
                    ...product,
                    weekSales,
                    monthSales,
                    dailySalesVelocity,
                    daysUntilStockout,
                    recommendedOrder,
                    urgency,
                    urgencyColor,
                    estimatedCost: (product.cost_price || product.costPrice || product.price * 0.7) * recommendedOrder
                }
            })

            // Filter to only show items that need restocking
            const needsRestock = productAnalysis
                .filter(p => p.urgency !== 'HEALTHY' || p.recommendedOrder > 0)
                .sort((a, b) => {
                    const urgencyOrder = { CRITICAL: 0, URGENT: 1, SOON: 2, HEALTHY: 3 }
                    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
                })

            setRecommendations(needsRestock)
        } catch (error) {
            console.error('Error analyzing inventory:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleSelect = (id) => {
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const generatePurchaseOrder = () => {
        const selected = recommendations.filter(r => selectedItems.includes(r.id))
        const total = selected.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)

        addToast?.({
            type: 'success',
            message: `Purchase order generated for ${selected.length} items (₹${total.toLocaleString()})`
        })
    }

    const totalEstimatedCost = recommendations
        .filter(r => selectedItems.includes(r.id))
        .reduce((sum, r) => sum + (r.estimatedCost || 0), 0)

    if (loading) {
        return (
            <div className="restock-agent loading">
                <style>{restockStyles}</style>
                <Package size={32} className="pulse" style={{ color: 'var(--primary-500)' }} />
                <p>AI Analyzing Inventory...</p>
            </div>
        )
    }

    return (
        <div className="restock-agent">
            <style>{restockStyles}</style>

            <div className="agent-header">
                <div className="agent-title">
                    <Package size={22} style={{ color: 'var(--primary-500)' }} />
                    <h3>Auto-Restock Agent</h3>
                    <span className="ai-badge"><Sparkles size={12} /> AI Powered</span>
                </div>
                <button className="refresh-btn" onClick={analyzeInventory}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {recommendations.length === 0 ? (
                <div className="empty-state">
                    <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
                    <h4>All Stock Levels Healthy!</h4>
                    <p>No restocking needed at this time.</p>
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="restock-stats">
                        <div className="stat critical">
                            <span className="stat-value">{recommendations.filter(r => r.urgency === 'CRITICAL').length}</span>
                            <span className="stat-label">Critical</span>
                        </div>
                        <div className="stat urgent">
                            <span className="stat-value">{recommendations.filter(r => r.urgency === 'URGENT').length}</span>
                            <span className="stat-label">Urgent</span>
                        </div>
                        <div className="stat soon">
                            <span className="stat-value">{recommendations.filter(r => r.urgency === 'SOON').length}</span>
                            <span className="stat-label">Soon</span>
                        </div>
                    </div>

                    {/* Recommendations List */}
                    <div className="recommendations-list">
                        {recommendations.slice(0, 6).map(item => (
                            <div
                                key={item.id}
                                className={`recommendation-item ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                                onClick={() => toggleSelect(item.id)}
                            >
                                <div className="item-checkbox">
                                    {selectedItems.includes(item.id) && <CheckCircle2 size={16} />}
                                </div>
                                <div className="item-info">
                                    <h5>{item.name}</h5>
                                    <div className="item-meta">
                                        <span className="stock">Stock: {item.stock || 0}</span>
                                        <span className="velocity">
                                            <TrendingUp size={12} />
                                            {item.dailySalesVelocity.toFixed(1)}/day
                                        </span>
                                    </div>
                                </div>
                                <div className="item-action">
                                    <span
                                        className="urgency-badge"
                                        style={{ backgroundColor: item.urgencyColor }}
                                    >
                                        {item.urgency}
                                    </span>
                                    <div className="order-qty">
                                        <span className="qty-label">Order</span>
                                        <span className="qty-value">{item.recommendedOrder}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Action Button */}
                    {selectedItems.length > 0 && (
                        <div className="action-footer">
                            <div className="selected-info">
                                <span>{selectedItems.length} items selected</span>
                                <span className="total-cost">₹{totalEstimatedCost.toLocaleString()}</span>
                            </div>
                            <button className="btn btn-primary" onClick={generatePurchaseOrder}>
                                <ShoppingCart size={16} />
                                Generate PO
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

const restockStyles = `
    .restock-agent {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .restock-agent.loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        min-height: 200px;
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
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(99, 102, 241, 0.1));
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #7c3aed;
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

    .restock-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .restock-stats .stat {
        text-align: center;
        padding: 12px;
        border-radius: 12px;
    }

    .stat.critical { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .stat.urgent { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .stat.soon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

    .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
    }

    .stat-label {
        font-size: 0.6875rem;
        opacity: 0.8;
    }

    .recommendations-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 320px;
        overflow-y: auto;
    }

    .recommendation-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .recommendation-item:hover {
        border-color: var(--primary-500);
    }

    .recommendation-item.selected {
        background: rgba(124, 58, 237, 0.1);
        border-color: #7c3aed;
    }

    .item-checkbox {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--border-default);
        border-radius: 6px;
        color: #7c3aed;
    }

    .recommendation-item.selected .item-checkbox {
        background: #7c3aed;
        border-color: #7c3aed;
        color: white;
    }

    .item-info {
        flex: 1;
        min-width: 0;
    }

    .item-info h5 {
        margin: 0 0 4px;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .item-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .velocity {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--success);
    }

    .item-action {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .urgency-badge {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.625rem;
        font-weight: 700;
        color: white;
    }

    .order-qty {
        text-align: center;
    }

    .qty-label {
        display: block;
        font-size: 0.625rem;
        color: var(--text-tertiary);
    }

    .qty-value {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--primary-500);
    }

    .action-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 16px;
        margin-top: 16px;
        border-top: 1px solid var(--border-subtle);
    }

    .selected-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .selected-info span:first-child {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .total-cost {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--text-primary);
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`
