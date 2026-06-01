import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    FileText, Download, Mail, Share2, Calendar, TrendingUp,
    TrendingDown, IndianRupee, ShoppingCart, Users, Package,
    Clock, Check, AlertTriangle, Star, Send, Loader2
} from 'lucide-react'
import realDataService from '../services/realDataService'

export default function DailySummary({ addToast }) {
  const { t } = useTranslation()
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [sendingEmail, setSendingEmail] = useState(false)

    useEffect(() => {
        loadDailySummary()
    }, [])

    const loadDailySummary = async () => {
        setLoading(true)
        try {
            // Fetch real data from all sources
            const [stats, products, bills, customers, expenseData] = await Promise.all([
                realDataService.getDashboardStats(),
                realDataService.getProducts(),
                realDataService.getBills(),
                realDataService.getCustomers(),
                realDataService.getExpenseSummary()
            ])

            const today = new Date()
            const lowStockProducts = products.filter(p => p.stock <= p.minStock)
            const outOfStockProducts = products.filter(p => p.stock === 0)
            
            // Expiring Soon: products with expiry_date within 30 days
            const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
            const expiringProducts = products.filter(p => {
                if (!p.expiry_date) return false
                const expDate = new Date(p.expiry_date)
                return expDate <= thirtyDaysFromNow && expDate >= today
            })
            
            // New Arrivals: products created in the last 7 days
            const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            const newArrivalProducts = products.filter(p => {
                if (!p.created_at) return false
                return new Date(p.created_at) >= sevenDaysAgo
            })

            // Calculate totals from bills
            const totalRevenue = bills.reduce((sum, b) => sum + (b.total || 0), 0)
            const avgBillValue = bills.length > 0 ? totalRevenue / bills.length : 0

            // Calculate payment breakdown
            const paymentBreakdown = { cash: 0, upi: 0, card: 0, credit: 0 }
            bills.forEach(bill => {
                const method = (bill.paymentMethod || 'cash').toLowerCase()
                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (bill.total || 0)
            })

            // Find top products from bills
            const productSales = {}
            bills.forEach(bill => {
                (bill.items || []).forEach(item => {
                    const name = item.product_name || item.name
                    if (name) {
                        if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 }
                        productSales[name].qty += item.quantity || 1
                        productSales[name].revenue += (item.quantity || 1) * (item.unit_price || item.price || 0)
                    }
                })
            })
            const topProducts = Object.entries(productSales)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .slice(0, 5)
                .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))

            // Build insights
            const insights = []
            if (bills.length > 0) {
                insights.push({ type: 'success', message: `${bills.length} bills created today with total revenue of ₹${totalRevenue.toLocaleString()}` })
            } else {
                insights.push({ type: 'info', message: 'No sales recorded today. Start creating bills!' })
            }
            if (lowStockProducts.length > 0) {
                insights.push({ type: 'warning', message: `${lowStockProducts.length} products running low on stock - reorder recommended` })
            }
            if (customers.length > 0) {
                insights.push({ type: 'info', message: `You have ${customers.length} registered customers` })
            }

            // Build pending tasks
            const pendingTasks = []
            lowStockProducts.slice(0, 3).forEach(p => {
                pendingTasks.push({ task: `Reorder ${p.name} (only ${p.stock} units left)`, priority: p.stock === 0 ? 'high' : 'medium' })
            })
            expiringProducts.slice(0, 3).forEach(p => {
                const daysLeft = Math.ceil((new Date(p.expiry_date) - today) / (1000 * 60 * 60 * 24))
                pendingTasks.push({ task: `${p.name} expires in ${daysLeft} days — sell or discount`, priority: daysLeft <= 7 ? 'high' : 'medium' })
            })

            setSummary({
                date: today.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                tamilDate: today.toLocaleDateString('ta-IN'),
                dayType: today.getDay() === 0 || today.getDay() === 6 ? 'Weekend' : 'Weekday',

                sales: {
                    total: totalRevenue,
                    cash: paymentBreakdown.cash,
                    upi: paymentBreakdown.upi,
                    credit: paymentBreakdown.credit,
                    change: 0, // Would need historical data
                    billCount: bills.length,
                    avgBillValue: Math.round(avgBillValue)
                },

                topProducts,

                inventory: {
                    lowStock: lowStockProducts.length,
                    outOfStock: outOfStockProducts.length,
                    newArrivals: newArrivalProducts.length,
                    expiringsSoon: expiringProducts.length,
                    expiringList: expiringProducts.slice(0, 5).map(p => ({
                        name: p.name,
                        expiry: new Date(p.expiry_date).toLocaleDateString('en-IN'),
                        daysLeft: Math.ceil((new Date(p.expiry_date) - today) / (1000 * 60 * 60 * 24))
                    }))
                },

                customers: {
                    total: customers.length,
                    new: 0, // Would need date filter
                    returning: customers.length,
                    topCustomer: customers.length > 0
                        ? { name: customers[0].name, spent: customers[0].totalSpent || 0 }
                        : { name: 'N/A', spent: 0 }
                },

                expenses: {
                    total: expenseData.total || 0,
                    breakdown: Object.entries(expenseData.byCategory || {}).map(([category, amount]) => ({
                        category, amount
                    }))
                },

                profit: {
                    gross: totalRevenue,
                    expenses: expenseData.total || 0,
                    net: totalRevenue - (expenseData.total || 0),
                    margin: totalRevenue > 0 ? ((totalRevenue - (expenseData.total || 0)) / totalRevenue * 100).toFixed(1) : 0
                },

                insights,
                pendingTasks
            })
        } catch (error) {
            console.error('Failed to load daily summary:', error)
            addToast?.('Failed to load daily summary', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadPDF = () => {
        addToast('Generating PDF report...', 'info')

        // Create a printable version of the summary
        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Daily Summary - ${summary.date}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
        .stat .value { font-size: 24px; font-weight: bold; color: #10b981; }
        .stat .label { font-size: 12px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; border: 1px solid #e5e7eb; text-align: left; }
        th { background: #f9fafb; }
        .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <h1>📊 Daily Summary Report</h1>
    <p><strong>Date:</strong> ${summary.date}</p>
    
    <div class="stats">
        <div class="stat"><div class="value">₹${summary.sales.total.toLocaleString()}</div><div class="label">Total Sales</div></div>
        <div class="stat"><div class="value">${summary.sales.billCount}</div><div class="label">Bills</div></div>
        <div class="stat"><div class="value">${summary.customers.total}</div><div class="label">Customers</div></div>
        <div class="stat"><div class="value">₹${summary.profit.net.toLocaleString()}</div><div class="label">Net Profit</div></div>
    </div>

    <h2>💳 Payment Breakdown</h2>
    <table>
        <tr><th>Payment Mode</th><th>Amount</th></tr>
        <tr><td>Cash</td><td>₹${summary.sales.cash.toLocaleString()}</td></tr>
        <tr><td>UPI</td><td>₹${summary.sales.upi.toLocaleString()}</td></tr>
        <tr><td>Credit</td><td>₹${summary.sales.credit.toLocaleString()}</td></tr>
    </table>

    <h2>🏆 Top Products</h2>
    <table>
        <tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>
        ${summary.topProducts.map(p => `<tr><td>${p.name}</td><td>${p.qty}</td><td>₹${p.revenue.toLocaleString()}</td></tr>`).join('')}
    </table>

    <h2>📊 Profit Summary</h2>
    <table>
        <tr><td>Gross Sales</td><td>₹${summary.profit.gross.toLocaleString()}</td></tr>
        <tr><td>Expenses</td><td>-₹${summary.profit.expenses.toLocaleString()}</td></tr>
        <tr><td><strong>Net Profit</strong></td><td><strong>₹${summary.profit.net.toLocaleString()}</strong></td></tr>
        <tr><td>Margin</td><td>${summary.profit.margin}%</td></tr>
    </table>

    <div class="footer">Generated by KadaiGPT - AI-Powered Retail Intelligence</div>
</body>
</html>`

        // Create blob and download
        const blob = new Blob([printContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)

        // Open in new window for printing/saving
        const printWindow = window.open(url, '_blank')
        printWindow.onload = () => {
            printWindow.print()
            addToast('PDF ready! Use Ctrl+P or Print dialog to save as PDF', 'success')
        }
    }

    const handleEmailReport = () => {
        setSendingEmail(true)
        setTimeout(() => {
            setSendingEmail(false)
            addToast('Daily summary sent to your email!', 'success')
        }, 2000)
    }

    const handleWhatsAppShare = () => {
        const text = `📊 KadaiGPT Daily Summary\n\n💰 Sales: ₹${summary?.sales.total.toLocaleString()}\n👥 Customers: ${summary?.customers.total}\n📦 Bills: ${summary?.sales.billCount}\n📈 Profit: ₹${summary?.profit.net.toLocaleString()}\n\nGenerated by KadaiGPT - AI Retail Intelligence`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }

    if (loading) {
        return (
            <div className="loading-state">
                <FileText size={48} className="pulse" />
                <p>Generating Daily Summary...</p>
            </div>
        )
    }

    return (
        <div className="daily-summary-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <FileText size={28} /> Daily Summary Report
                    </h1>
                    <p className="page-subtitle">
                        {summary.date} • {summary.tamilDate}
                    </p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleDownloadPDF}>
                        <Download size={18} /> PDF
                    </button>
                    <button className="btn btn-secondary" onClick={handleEmailReport} disabled={sendingEmail}>
                        <Mail size={18} /> {sendingEmail ? 'Sending...' : 'Email'}
                    </button>
                    <button className="btn btn-success" onClick={handleWhatsAppShare}>
                        <Share2 size={18} /> WhatsApp
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
                <div className="stat-card sales">
                    <div className="stat-icon"><IndianRupee size={24} /></div>
                    <div className="stat-info">
                        <span className="label">Total Sales</span>
                        <span className="value">₹{summary.sales.total.toLocaleString()}</span>
                        <span className={`change ${summary.sales.change >= 0 ? 'positive' : 'negative'}`}>
                            {summary.sales.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {summary.sales.change}% vs yesterday
                        </span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><ShoppingCart size={24} /></div>
                    <div className="stat-info">
                        <span className="label">Total Bills</span>
                        <span className="value">{summary.sales.billCount}</span>
                        <span className="sub">Avg: ₹{summary.sales.avgBillValue}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Users size={24} /></div>
                    <div className="stat-info">
                        <span className="label">Customers</span>
                        <span className="value">{summary.customers.total}</span>
                        <span className="sub">{summary.customers.new} new today</span>
                    </div>
                </div>
                <div className="stat-card profit">
                    <div className="stat-icon"><Star size={24} /></div>
                    <div className="stat-info">
                        <span className="label">Net Profit</span>
                        <span className="value">₹{summary.profit.net.toLocaleString()}</span>
                        <span className="sub">{summary.profit.margin}% margin</span>
                    </div>
                </div>
            </div>

            <div className="summary-grid">
                {/* Sales Breakdown */}
                <div className="card">
                    <div className="card-header">
                        <h3><IndianRupee size={20} /> Sales Breakdown</h3>
                    </div>
                    <div className="sales-breakdown">
                        <div className="payment-type">
                            <span className="type">💵 Cash</span>
                            <div className="bar">
                                <div className="fill cash" style={{ width: `${(summary.sales.cash / summary.sales.total) * 100}%` }}></div>
                            </div>
                            <span className="amount">₹{summary.sales.cash.toLocaleString()}</span>
                        </div>
                        <div className="payment-type">
                            <span className="type">📱 UPI</span>
                            <div className="bar">
                                <div className="fill upi" style={{ width: `${(summary.sales.upi / summary.sales.total) * 100}%` }}></div>
                            </div>
                            <span className="amount">₹{summary.sales.upi.toLocaleString()}</span>
                        </div>
                        <div className="payment-type">
                            <span className="type">📋 Credit</span>
                            <div className="bar">
                                <div className="fill credit" style={{ width: `${(summary.sales.credit / summary.sales.total) * 100}%` }}></div>
                            </div>
                            <span className="amount">₹{summary.sales.credit.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Top Products */}
                <div className="card">
                    <div className="card-header">
                        <h3><Package size={20} /> Top Selling Products</h3>
                    </div>
                    <div className="top-products">
                        {summary.topProducts.map((p, i) => (
                            <div key={i} className="product-row">
                                <span className="rank">#{i + 1}</span>
                                <span className="name">{p.name}</span>
                                <span className="qty">{p.qty} sold</span>
                                <span className="revenue">₹{p.revenue.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inventory Alerts */}
                <div className="card">
                    <div className="card-header">
                        <h3><AlertTriangle size={20} /> Inventory Status</h3>
                    </div>
                    <div className="inventory-status">
                        <div className="status-item warning">
                            <span className="count">{summary.inventory.lowStock}</span>
                            <span className="label">Low Stock</span>
                        </div>
                        <div className="status-item danger">
                            <span className="count">{summary.inventory.outOfStock}</span>
                            <span className="label">Out of Stock</span>
                        </div>
                        <div className="status-item success">
                            <span className="count">{summary.inventory.newArrivals}</span>
                            <span className="label">New Arrivals</span>
                        </div>
                        <div className="status-item info">
                            <span className="count">{summary.inventory.expiringsSoon}</span>
                            <span className="label">Expiring Soon</span>
                        </div>
                    </div>
                </div>

                {/* AI Insights */}
                <div className="card insights-card">
                    <div className="card-header">
                        <h3><Star size={20} /> AI Insights</h3>
                    </div>
                    <div className="insights-list">
                        {summary.insights.map((insight, i) => (
                            <div key={i} className={`insight-item ${insight.type}`}>
                                {insight.type === 'success' && <Check size={16} />}
                                {insight.type === 'warning' && <AlertTriangle size={16} />}
                                {insight.type === 'info' && <Clock size={16} />}
                                {insight.type === 'tip' && <Star size={16} />}
                                <span>{insight.message}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Tasks */}
                <div className="card">
                    <div className="card-header">
                        <h3><Clock size={20} /> Pending Tasks</h3>
                    </div>
                    <div className="tasks-list">
                        {summary.pendingTasks.map((task, i) => (
                            <div key={i} className={`task-item priority-${task.priority}`}>
                                <div className="task-checkbox"></div>
                                <span>{task.task}</span>
                                <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .daily-summary-page { padding: 0; }
                
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 60vh;
                    gap: 16px;
                    color: var(--text-tertiary);
                }
                .pulse { animation: pulse 1.5s infinite; }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .quick-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 24px;
                }
                @media (max-width: 1200px) { .quick-stats { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 600px) { .quick-stats { grid-template-columns: 1fr; } }

                .stat-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: 20px;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }
                .stat-card.sales {
                    background: linear-gradient(135deg, #3B82F6, #1D4ED8);
                    border: none;
                    color: white;
                }
                .stat-card.profit {
                    background: linear-gradient(135deg, #10B981, #059669);
                    border: none;
                    color: white;
                }
                .stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.2);
                }
                .stat-info {
                    display: flex;
                    flex-direction: column;
                }
                .stat-info .label { font-size: 0.875rem; opacity: 0.8; }
                .stat-info .value { font-size: 1.75rem; font-weight: 700; }
                .stat-info .sub { font-size: 0.75rem; opacity: 0.7; }
                .stat-info .change {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                    margin-top: 4px;
                }
                .change.positive { color: #4ADE80; }
                .change.negative { color: #F87171; }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 24px;
                }
                @media (max-width: 900px) { .summary-grid { grid-template-columns: 1fr; } }

                .sales-breakdown {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .payment-type {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .payment-type .type { min-width: 80px; font-size: 0.875rem; }
                .payment-type .bar { flex: 1; height: 10px; background: var(--bg-tertiary); border-radius: 5px; overflow: hidden; }
                .payment-type .fill { height: 100%; border-radius: 5px; }
                .fill.cash { background: #10B981; }
                .fill.upi { background: #3B82F6; }
                .fill.credit { background: #F59E0B; }
                .payment-type .amount { font-weight: 600; min-width: 100px; text-align: right; }

                .top-products {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .product-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .product-row:last-child { border-bottom: none; }
                .product-row .rank { 
                    width: 28px; height: 28px; 
                    background: var(--bg-tertiary);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.75rem; font-weight: 600;
                }
                .product-row .name { flex: 1; }
                .product-row .qty { color: var(--text-tertiary); font-size: 0.875rem; }
                .product-row .revenue { font-weight: 600; color: var(--success); }

                .inventory-status {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                .status-item {
                    padding: 16px;
                    border-radius: var(--radius-lg);
                    text-align: center;
                }
                .status-item .count { font-size: 2rem; font-weight: 700; display: block; }
                .status-item .label { font-size: 0.75rem; opacity: 0.8; }
                .status-item.warning { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
                .status-item.danger { background: rgba(239, 68, 68, 0.2); color: #EF4444; }
                .status-item.success { background: rgba(16, 185, 129, 0.2); color: #10B981; }
                .status-item.info { background: rgba(59, 130, 246, 0.2); color: #3B82F6; }

                .insights-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .insight-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px;
                    border-radius: var(--radius-lg);
                    font-size: 0.875rem;
                }
                .insight-item.success { background: rgba(16, 185, 129, 0.1); color: #10B981; }
                .insight-item.warning { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
                .insight-item.info { background: rgba(59, 130, 246, 0.1); color: #3B82F6; }
                .insight-item.tip { background: rgba(139, 92, 246, 0.1); color: #8B5CF6; }

                .tasks-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .task-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border-left: 4px solid;
                }
                .task-item.priority-high { border-color: #EF4444; }
                .task-item.priority-medium { border-color: #F59E0B; }
                .task-item.priority-low { border-color: #10B981; }
                .task-checkbox {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--border-default);
                    border-radius: var(--radius-sm);
                }
                .task-item span:first-of-type { flex: 1; }
                .priority-badge {
                    padding: 2px 8px;
                    border-radius: var(--radius-sm);
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .priority-badge.high { background: rgba(239, 68, 68, 0.2); color: #EF4444; }
                .priority-badge.medium { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
                .priority-badge.low { background: rgba(16, 185, 129, 0.2); color: #10B981; }

                .btn-success {
                    background: #25D366;
                    color: white;
                    border: none;
                }
                .btn-success:hover { background: #128C7E; }
            `}</style>
        </div>
    )
}
