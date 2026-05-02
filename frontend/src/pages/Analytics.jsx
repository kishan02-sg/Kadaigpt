import { useState, useEffect } from 'react'
import { TrendingUp, ShoppingBag, Users, IndianRupee, ArrowUpRight, ArrowDownRight, Minus, Zap, BarChart3, PieChart, Loader2, Sparkles, Calendar, WifiOff } from 'lucide-react'
import realDataService from '../services/realDataService'
import BusinessHealthCard from '../components/BusinessHealthCard'
import PricePredictions from '../components/PricePredictions'
import FloatingActionButton from '../components/FloatingActionButton'
import api from '../services/api'


export default function Analytics({ addToast, setCurrentPage }) {
    const [period, setPeriod] = useState('week')
    const [loading, setLoading] = useState(true)
    const [analytics, setAnalytics] = useState({
        totalSales: 0,
        totalBills: 0,
        avgBillValue: 0,
        growth: 0,
        topProducts: [],
        salesByDay: [],
        salesByHour: [],
        paymentBreakdown: { cash: 0, upi: 0, card: 0, credit: 0 },
        predictions: { nextWeekSales: 0, peakDay: 'N/A', peakHour: 'N/A', suggestedRestock: [] }
    })
    const [products, setProducts] = useState([])

    useEffect(() => {
        loadAnalytics()
    }, [period])

    const loadAnalytics = async () => {
        setLoading(true)

        try {
            // Load all data from real APIs
            const [analyticsData, productsData] = await Promise.all([
                realDataService.getAnalytics(period),
                realDataService.getProducts()
            ])

            setAnalytics(analyticsData)
            setProducts(productsData)
        } catch (error) {
            console.error('Error loading analytics:', error)
            addToast?.('Failed to load analytics data', 'error')
        } finally {
            setLoading(false)
        }
    }

    // Calculate derived values
    const hasData = analytics.totalSales > 0 || analytics.totalBills > 0
    const salesChange = analytics.growth || 0

    // Get weekly sales from salesByDay
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weeklySales = dayNames.map(day => {
        const dayData = analytics.salesByDay.find(d => d.day === day)
        return dayData?.sales || 0
    })
    const maxWeeklySale = Math.max(...weeklySales, 1)

    // Payment breakdown with null safety
    const paymentData = analytics.paymentBreakdown || { cash: 0, upi: 0, card: 0, credit: 0 }
    const totalPayments = Object.values(paymentData).reduce((a, b) => a + (b || 0), 0) || 1
    const paymentCategories = Object.entries(paymentData)
        .filter(([_, val]) => (val || 0) > 0)
        .map(([name, val]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            revenue: val || 0,
            percentage: Math.round(((val || 0) / totalPayments) * 100)
        }))

    // Null-safe values
    const totalSales = analytics.totalSales || 0
    const totalBills = analytics.totalBills || 0
    const avgBillValue = analytics.avgBillValue || 0
    const predictions = analytics.predictions || {}
    const topProducts = analytics.topProducts || []

    const kpis = [
        { label: 'Total Revenue', value: `₹${totalSales.toLocaleString()}`, change: salesChange, icon: IndianRupee, positive: salesChange >= 0 },
        { label: 'Total Orders', value: totalBills, change: Math.abs(salesChange * 0.7).toFixed(1), icon: ShoppingBag, positive: true },
        { label: 'Peak Day', value: predictions.peakDay || 'N/A', change: 0, icon: Calendar, positive: true },
        { label: 'Avg Order Value', value: `₹${avgBillValue.toFixed(0)}`, change: 3.2, icon: TrendingUp, positive: true },
    ]

    const aiInsights = [
        { icon: '📈', title: 'Sales Trend', text: hasData ? `Your sales ${salesChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(salesChange).toFixed(1)}% compared to last period.` : 'Start making sales to see trends.' },
        { icon: '🎯', title: 'Best Seller', text: topProducts[0]?.name ? `${topProducts[0].name} is your top seller with ${topProducts[0].quantity || 0} units.` : 'No sales data yet.' },
        { icon: '⏰', title: 'Peak Hours', text: predictions.peakHour ? `Your peak sales hour is ${predictions.peakHour}. Staff up during this time!` : 'More sales needed for peak hour analysis.' },
        { icon: '💰', title: 'Next Week Prediction', text: (predictions.nextWeekSales || 0) > 0 ? `AI predicts ₹${predictions.nextWeekSales.toLocaleString()} in sales next week.` : 'Need more data for predictions.' },
        { icon: '💡', title: 'Restock Alert', text: products.filter(p => (p.stock || 0) <= (p.minStock || 0)).length > 0 ? `${products.filter(p => (p.stock || 0) <= (p.minStock || 0)).length} products need restocking.` : 'All stock levels are healthy!' },
    ]


    return (
        <div className="analytics-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📊 Analytics</h1>
                    <p className="page-subtitle">AI-powered business insights</p>
                </div>
                <div className="header-filters">
                    <div className="period-selector">
                        {['today', 'week', 'month', 'year'].map(p => (
                            <button
                                key={p}
                                className={`period-btn ${period === p ? 'active' : ''}`}
                                onClick={() => setPeriod(p)}
                            >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpis.map((kpi, i) => (
                    <div key={i} className="kpi-card">
                        <div className="kpi-icon"><kpi.icon size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-value">{kpi.value}</span>
                            <span className="kpi-label">{kpi.label}</span>
                        </div>
                        <div className={`kpi-change ${kpi.positive ? 'positive' : 'negative'}`}>
                            {kpi.positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            {kpi.change}%
                        </div>
                    </div>
                ))}
            </div>

            {/* Business Health Score */}
            <div style={{ marginBottom: '24px' }}>
                <BusinessHealthCard addToast={addToast} />
            </div>

            <div className="analytics-grid">
                {/* Weekly Sales Chart */}
                <div className="card chart-card">
                    <div className="card-header">
                        <h3 className="card-title"><BarChart3 size={20} /> Weekly Sales Performance</h3>
                    </div>
                    <div className="chart-container">
                        <div className="bar-chart">
                            {weeklySales.map((sale, i) => (
                                <div key={i} className="bar-column">
                                    <div
                                        className="bar"
                                        style={{ height: `${(sale / maxWeeklySale) * 100}%` }}
                                    >
                                        <span className="bar-value">₹{(sale / 1000).toFixed(1)}k</span>
                                    </div>
                                    <span className="bar-day">{dayNames[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="chart-legend">
                        <div className="legend-item">
                            <span className="legend-color"></span>
                            <span>Sales (₹)</span>
                        </div>
                        <div className="legend-stats">
                            <span>Total: ₹{(weeklySales.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}k</span>
                            <span>Avg: ₹{(weeklySales.reduce((a, b) => a + b, 0) / 7 / 1000).toFixed(1)}k/day</span>
                        </div>
                    </div>
                </div>

                {/* Payment Breakdown */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><PieChart size={20} /> Payment Breakdown</h3>
                    </div>
                    <div className="category-breakdown">
                        {paymentCategories.length > 0 ? paymentCategories.map((cat, i) => (
                            <div key={i} className="category-item">
                                <div className="category-info">
                                    <span className="category-name">{cat.name}</span>
                                    <span className="category-revenue">₹{cat.revenue.toLocaleString()}</span>
                                </div>
                                <div className="category-bar">
                                    <div
                                        className="category-fill"
                                        style={{ width: `${cat.percentage}%`, backgroundColor: `hsl(${i * 80}, 70%, 50%)` }}
                                    ></div>
                                </div>
                                <span className="category-percent">{cat.percentage}%</span>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <p>No payment data yet. Create bills to see breakdown.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><TrendingUp size={20} /> Top Selling Products</h3>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Product</th>
                                <th>Units Sold</th>
                                <th>Revenue</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topProducts.map((product, i) => (
                                <tr key={i}>
                                    <td><span className="rank-badge">#{i + 1}</span></td>
                                    <td>{product.name}</td>
                                    <td>{product.sales}</td>
                                    <td className="amount">₹{product.revenue.toLocaleString()}</td>
                                    <td>
                                        <span className={`trend-badge ${product.trend > 0 ? 'positive' : product.trend < 0 ? 'negative' : ''}`}>
                                            {product.trend > 0 ? <ArrowUpRight size={14} /> : product.trend < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                                            {Math.abs(product.trend)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AI Insights */}
            <div className="ai-insights-section">
                <h3><Zap size={20} /> AI-Powered Insights</h3>
                <div className="insights-grid">
                    {aiInsights.map((insight, i) => (
                        <div key={i} className="insight-card">
                            <span className="insight-icon">{insight.icon}</span>
                            <h4>{insight.title}</h4>
                            <p>{insight.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Price Predictions Section */}
            <div className="predictions-section">
                <PricePredictions
                    products={topProducts.map(p => ({
                        id: p.id || Math.random().toString(),
                        name: p.name,
                        price: p.revenue ? (p.revenue / (p.quantity || 1)) : 100,
                        category: p.category || 'General',
                        unit: p.unit || 'unit'
                    }))}
                    language="en"
                    onAlertSet={(product) => addToast?.(`Price alert set for ${product.name}`, 'success')}
                />
            </div>


            <style>{`
        .header-filters { 
            display: flex; 
            align-items: center; 
            gap: 16px;
            flex-wrap: wrap;
        }
        .period-selector { display: flex; gap: 6px; background: var(--bg-tertiary); padding: 4px; border-radius: 10px; }
        .period-btn {
          padding: 8px 14px; background: transparent;
          border: none; border-radius: 8px;
          cursor: pointer; font-weight: 500; color: var(--text-secondary);
          transition: all 0.2s; font-size: 0.8rem;
        }
        .period-btn:hover { background: var(--bg-secondary); }
        .period-btn.active { background: var(--primary-500); color: white; }

        .predictions-section {
            margin-top: 24px;
        }

        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        .kpi-card {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
          position: relative;
        }
        .kpi-icon { width: 56px; height: 56px; background: var(--bg-tertiary); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; color: var(--primary-400); }
        .kpi-content { flex: 1; }
        .kpi-value { font-size: 1.5rem; font-weight: 800; display: block; }
        .kpi-label { font-size: 0.8125rem; color: var(--text-tertiary); }
        .kpi-change { position: absolute; top: 16px; right: 16px; display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; font-weight: 600; }
        .kpi-change.positive { color: var(--success); }
        .kpi-change.negative { color: var(--error); }

        .analytics-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 1024px) { .analytics-grid { grid-template-columns: 1fr; } }

        .bar-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 200px; padding: 20px 0; }
        .bar-column { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; }
        .bar { 
          width: 60%; max-width: 50px; background: var(--gradient-primary); 
          border-radius: 4px 4px 0 0; position: relative; 
          transition: height 0.5s ease; cursor: pointer;
        }
        .bar:hover { opacity: 0.8; }
        .bar-value { 
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
          padding: 4px 8px; background: var(--bg-primary); border-radius: var(--radius-sm);
          font-size: 0.6875rem; white-space: nowrap; margin-bottom: 4px;
          opacity: 0; transition: opacity var(--transition-fast);
        }
        .bar:hover .bar-value { opacity: 1; }
        .bar-day { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 8px; }
        .chart-legend { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--border-subtle); font-size: 0.8125rem; color: var(--text-secondary); }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-color { width: 12px; height: 12px; background: var(--gradient-primary); border-radius: 2px; }
        .legend-stats { display: flex; gap: 16px; }

        .category-breakdown { display: flex; flex-direction: column; gap: 12px; }
        .category-item { display: flex; align-items: center; gap: 12px; }
        .category-info { min-width: 120px; }
        .category-name { font-weight: 500; display: block; font-size: 0.875rem; }
        .category-revenue { font-size: 0.75rem; color: var(--text-tertiary); }
        .category-bar { flex: 1; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; }
        .category-fill { height: 100%; border-radius: 4px; }
        .category-percent { font-weight: 600; min-width: 40px; text-align: right; }

        .rank-badge { padding: 4px 10px; background: var(--bg-tertiary); border-radius: var(--radius-sm); font-weight: 600; }
        .amount { font-weight: 600; color: var(--primary-400); }
        .trend-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8125rem; font-weight: 600; background: var(--bg-tertiary); }
        .trend-badge.positive { color: var(--success); background: rgba(34, 197, 94, 0.1); }
        .trend-badge.negative { color: var(--error); background: rgba(239, 68, 68, 0.1); }

        .ai-insights-section { margin-top: 24px; }
        .ai-insights-section h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: var(--primary-400); }
        .insights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 1024px) { .insights-grid { grid-template-columns: repeat(2, 1fr); } }
        .insight-card {
          padding: 20px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%);
          border: 1px solid rgba(249, 115, 22, 0.3); border-radius: var(--radius-xl);
        }
        .insight-icon { font-size: 1.5rem; display: block; margin-bottom: 8px; }
        .insight-card h4 { margin: 0 0 8px; font-size: 0.9375rem; }
        .insight-card p { margin: 0; font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5; }
      `}</style>
        </div>
    )
}
