import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Package, Sparkles, RefreshCw, ArrowUpRight, Target, PieChart } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function ProfitMarginAnalyzer({ addToast }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('overview') // overview, detailed

    useEffect(() => {
        loadMarginData()
    }, [])

    const loadMarginData = async () => {
        setLoading(true)
        try {
            const productsData = await realDataService.getProducts()

            // Calculate margin data for each product
            const productsWithMargin = productsData.map(product => {
                const costPrice = product.cost_price || product.costPrice || product.price * 0.7
                const sellingPrice = product.price || 0
                const profit = sellingPrice - costPrice
                const marginPercent = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0

                // Determine margin health
                let marginStatus, marginColor
                if (marginPercent >= 30) {
                    marginStatus = 'Excellent'
                    marginColor = '#22c55e'
                } else if (marginPercent >= 20) {
                    marginStatus = 'Good'
                    marginColor = '#84cc16'
                } else if (marginPercent >= 10) {
                    marginStatus = 'Low'
                    marginColor = '#f59e0b'
                } else {
                    marginStatus = 'Critical'
                    marginColor = '#ef4444'
                }

                // AI suggestion for pricing
                let suggestion = null
                if (marginPercent < 15) {
                    const suggestedPrice = Math.ceil(costPrice * 1.3) // Suggest 30% margin
                    suggestion = {
                        text: `Increase price to ₹${suggestedPrice} for healthy margin`,
                        suggestedPrice,
                        potentialIncrease: suggestedPrice - sellingPrice
                    }
                } else if (marginPercent > 50) {
                    suggestion = {
                        text: 'High margin! Consider promotional pricing to boost sales',
                        suggestedPrice: null
                    }
                }

                return {
                    ...product,
                    costPrice,
                    profit,
                    marginPercent,
                    marginStatus,
                    marginColor,
                    suggestion
                }
            })

            // Sort by margin (lowest first for attention)
            productsWithMargin.sort((a, b) => a.marginPercent - b.marginPercent)

            setProducts(productsWithMargin)
        } catch (error) {
            console.error('Failed to load margin data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Calculate overview stats
    const avgMargin = products.length > 0
        ? products.reduce((sum, p) => sum + p.marginPercent, 0) / products.length
        : 0
    const lowMarginCount = products.filter(p => p.marginPercent < 15).length
    const highMarginCount = products.filter(p => p.marginPercent >= 30).length
    const totalPotentialRevenue = products
        .filter(p => p.suggestion?.potentialIncrease > 0)
        .reduce((sum, p) => sum + (p.suggestion?.potentialIncrease || 0) * (p.stock || 10), 0)

    // Margin distribution for chart
    const marginDistribution = [
        { label: 'Critical (<10%)', count: products.filter(p => p.marginPercent < 10).length, color: '#ef4444' },
        { label: 'Low (10-20%)', count: products.filter(p => p.marginPercent >= 10 && p.marginPercent < 20).length, color: '#f59e0b' },
        { label: 'Good (20-30%)', count: products.filter(p => p.marginPercent >= 20 && p.marginPercent < 30).length, color: '#84cc16' },
        { label: 'Excellent (30%+)', count: products.filter(p => p.marginPercent >= 30).length, color: '#22c55e' }
    ]

    if (loading) {
        return (
            <div className="margin-panel loading">
                <DollarSign size={32} className="pulse" style={{ color: 'var(--primary-500)' }} />
                <style>{marginStyles}</style>
            </div>
        )
    }

    return (
        <div className="margin-panel">
            <style>{marginStyles}</style>

            <div className="margin-header">
                <div className="margin-title">
                    <DollarSign size={22} style={{ color: 'var(--success)' }} />
                    <h3>Profit Margin AI</h3>
                    <span className="ai-badge"><Sparkles size={12} /> Smart Pricing</span>
                </div>
                <div className="header-actions">
                    <div className="view-toggle">
                        <button
                            className={view === 'overview' ? 'active' : ''}
                            onClick={() => setView('overview')}
                        >Overview</button>
                        <button
                            className={view === 'detailed' ? 'active' : ''}
                            onClick={() => setView('detailed')}
                        >Detailed</button>
                    </div>
                    <button className="refresh-btn" onClick={loadMarginData}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {products.length === 0 ? (
                <div className="empty-state">
                    <Package size={48} />
                    <h4>No Products Yet</h4>
                    <p>Add products with cost prices to analyze margins</p>
                </div>
            ) : view === 'overview' ? (
                <>
                    {/* Overview Stats */}
                    <div className="margin-stats">
                        <div className="stat-card primary">
                            <PieChart size={24} />
                            <div>
                                <span className="value">{avgMargin.toFixed(1)}%</span>
                                <span className="label">Avg Margin</span>
                            </div>
                        </div>
                        <div className="stat-card danger">
                            <AlertTriangle size={24} />
                            <div>
                                <span className="value">{lowMarginCount}</span>
                                <span className="label">Low Margin Items</span>
                            </div>
                        </div>
                        <div className="stat-card success">
                            <TrendingUp size={24} />
                            <div>
                                <span className="value">{highMarginCount}</span>
                                <span className="label">High Margin Items</span>
                            </div>
                        </div>
                    </div>

                    {/* Margin Distribution Chart */}
                    <div className="distribution-section">
                        <h4>Margin Distribution</h4>
                        <div className="distribution-chart">
                            {marginDistribution.map((item, i) => (
                                <div key={i} className="distribution-bar-container">
                                    <div className="distribution-label">{item.label}</div>
                                    <div className="distribution-bar">
                                        <div
                                            className="distribution-fill"
                                            style={{
                                                width: `${products.length > 0 ? (item.count / products.length) * 100 : 0}%`,
                                                backgroundColor: item.color
                                            }}
                                        />
                                    </div>
                                    <span className="distribution-count">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Recommendation */}
                    {totalPotentialRevenue > 0 && (
                        <div className="ai-recommendation">
                            <div className="recommendation-icon">
                                <Sparkles size={20} />
                            </div>
                            <div className="recommendation-content">
                                <h5>💡 AI Pricing Opportunity</h5>
                                <p>
                                    Adjusting prices on {lowMarginCount} low-margin products could add
                                    <strong> ₹{totalPotentialRevenue.toLocaleString()}</strong> in potential revenue!
                                </p>
                                <button className="btn btn-primary btn-sm" onClick={() => setView('detailed')}>
                                    View Suggestions <ArrowUpRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Top Low Margin Products */}
                    {lowMarginCount > 0 && (
                        <div className="low-margin-section">
                            <h4><AlertTriangle size={16} /> Attention Needed</h4>
                            <div className="product-list">
                                {products.filter(p => p.marginPercent < 15).slice(0, 4).map(product => (
                                    <div key={product.id} className="product-row">
                                        <div className="product-info">
                                            <span className="product-name">{product.name}</span>
                                            <span className="product-prices">
                                                Cost: ₹{product.costPrice?.toFixed(0)} → Price: ₹{product.price?.toFixed(0)}
                                            </span>
                                        </div>
                                        <div className="margin-badge" style={{ backgroundColor: product.marginColor }}>
                                            {product.marginPercent.toFixed(0)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Detailed View */
                <div className="detailed-view">
                    <div className="products-table">
                        {products.map(product => (
                            <div key={product.id} className="product-card">
                                <div className="product-header">
                                    <h5>{product.name}</h5>
                                    <span
                                        className="margin-pill"
                                        style={{ backgroundColor: product.marginColor }}
                                    >
                                        {product.marginPercent.toFixed(1)}% margin
                                    </span>
                                </div>
                                <div className="price-breakdown">
                                    <div className="price-item">
                                        <span className="price-label">Cost</span>
                                        <span className="price-value">₹{product.costPrice?.toFixed(0)}</span>
                                    </div>
                                    <div className="price-arrow">→</div>
                                    <div className="price-item">
                                        <span className="price-label">Price</span>
                                        <span className="price-value">₹{product.price?.toFixed(0)}</span>
                                    </div>
                                    <div className="price-item profit">
                                        <span className="price-label">Profit</span>
                                        <span className="price-value">₹{product.profit?.toFixed(0)}</span>
                                    </div>
                                </div>
                                {product.suggestion && (
                                    <div className="suggestion-box">
                                        <Sparkles size={14} />
                                        <span>{product.suggestion.text}</span>
                                        {product.suggestion.suggestedPrice && (
                                            <button className="btn btn-ghost btn-sm">
                                                Apply ₹{product.suggestion.suggestedPrice}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const marginStyles = `
    .margin-panel {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .margin-panel.loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
    }

    .margin-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;
    }

    .margin-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .margin-title h3 {
        margin: 0;
        font-size: 1.125rem;
    }

    .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05));
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #22c55e;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .view-toggle {
        display: flex;
        background: var(--bg-tertiary);
        border-radius: 8px;
        padding: 3px;
    }

    .view-toggle button {
        padding: 6px 12px;
        border: none;
        background: transparent;
        border-radius: 6px;
        font-size: 0.75rem;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .view-toggle button.active {
        background: var(--bg-card);
        color: var(--primary-500);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
        color: var(--text-secondary);
    }

    .empty-state svg { margin-bottom: 16px; color: var(--text-tertiary); }
    .empty-state h4 { margin: 0 0 8px; color: var(--text-primary); }
    .empty-state p { margin: 0; font-size: 0.875rem; }

    .margin-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: 12px;
    }

    .stat-card.primary {
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.05));
        color: var(--primary-500);
    }

    .stat-card.danger {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .stat-card.success {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
    }

    .stat-card .value {
        font-size: 1.5rem;
        font-weight: 700;
        display: block;
    }

    .stat-card .label {
        font-size: 0.6875rem;
        opacity: 0.8;
    }

    .distribution-section {
        margin-bottom: 20px;
    }

    .distribution-section h4 {
        font-size: 0.875rem;
        margin: 0 0 12px;
        color: var(--text-secondary);
    }

    .distribution-chart {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .distribution-bar-container {
        display: grid;
        grid-template-columns: 120px 1fr 30px;
        align-items: center;
        gap: 12px;
    }

    .distribution-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .distribution-bar {
        height: 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        overflow: hidden;
    }

    .distribution-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;
    }

    .distribution-count {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .ai-recommendation {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02));
        border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 12px;
        margin-bottom: 20px;
    }

    .recommendation-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #22c55e;
        color: white;
        border-radius: 10px;
        flex-shrink: 0;
    }

    .recommendation-content h5 {
        margin: 0 0 6px;
        font-size: 0.9375rem;
    }

    .recommendation-content p {
        margin: 0 0 12px;
        font-size: 0.8125rem;
        color: var(--text-secondary);
    }

    .recommendation-content strong {
        color: #22c55e;
    }

    .low-margin-section h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        margin: 0 0 12px;
        color: #f59e0b;
    }

    .product-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .product-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 10px;
    }

    .product-name {
        font-weight: 500;
        display: block;
    }

    .product-prices {
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .margin-badge {
        padding: 4px 10px;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        color: white;
    }

    /* Detailed View */
    .products-table {
        display: grid;
        gap: 12px;
    }

    .product-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 16px;
    }

    .product-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .product-header h5 {
        margin: 0;
        font-size: 0.9375rem;
    }

    .margin-pill {
        padding: 4px 10px;
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: white;
    }

    .price-breakdown {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .price-item {
        text-align: center;
    }

    .price-label {
        display: block;
        font-size: 0.6875rem;
        color: var(--text-tertiary);
        margin-bottom: 2px;
    }

    .price-value {
        font-size: 1rem;
        font-weight: 600;
    }

    .price-item.profit .price-value {
        color: #22c55e;
    }

    .price-arrow {
        color: var(--text-tertiary);
    }

    .suggestion-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02));
        border-radius: 8px;
        font-size: 0.8125rem;
        color: var(--text-secondary);
    }

    .suggestion-box svg {
        color: #f59e0b;
        flex-shrink: 0;
    }

    .suggestion-box span {
        flex: 1;
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`
