import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Filter, Download, Eye, Printer, Calendar, X, ChevronDown, FileText, TrendingUp, ArrowUpRight, XCircle, AlertTriangle } from 'lucide-react'
import realDataService from '../services/realDataService'
import api from '../services/api'
import EmptyState from '../components/EmptyState'
import FloatingActionButton from '../components/FloatingActionButton'

export default function Bills({ addToast, setCurrentPage }) {
  const { t } = useTranslation()
    const [bills, setBills] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [selectedBill, setSelectedBill] = useState(null)
    const [cancellingBill, setCancellingBill] = useState(null)
    const [cancelReason, setCancelReason] = useState('')
    const [filters, setFilters] = useState({
        dateRange: 'all',  // Changed from 'today' to show all bills by default
        paymentMode: 'all',
        minAmount: '',
        maxAmount: '',
    })

    useEffect(() => {
        loadBills()
    }, [])

    const loadBills = async () => {
        setLoading(true)

        try {
            // Invalidate cache to get fresh data
            realDataService.invalidateCache('bills')
            const billList = await realDataService.getBills()

            if (Array.isArray(billList) && billList.length > 0) {
                setBills(billList)
            } else {
                setBills([])
            }
        } catch (error) {
            console.error('Failed to load bills:', error)
            addToast?.('Failed to load bills', 'error')
            setBills([])
        } finally {
            setLoading(false)
        }
    }

    // Filter bills
    const filteredBills = bills.filter(bill => {
        // Search filter
        const searchMatch =
            bill.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bill.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bill.customer_phone?.includes(searchQuery)

        if (!searchMatch) return false

        // Payment mode filter (case-insensitive) — 'due' matches 'credit' in DB
        if (filters.paymentMode !== 'all') {
            const filterVal = filters.paymentMode.toLowerCase()
            const billPay = bill.payment_mode?.toLowerCase() || ''
            if (filterVal === 'due') {
                if (billPay !== 'credit' && billPay !== 'due') return false
            } else if (billPay !== filterVal) {
                return false
            }
        }

        // Amount filters
        if (filters.minAmount && bill.total < parseFloat(filters.minAmount)) return false
        if (filters.maxAmount && bill.total > parseFloat(filters.maxAmount)) return false

        // Date filter
        const billDate = new Date(bill.created_at)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (filters.dateRange === 'today') {
            if (billDate < today) return false
        } else if (filters.dateRange === 'week') {
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            if (billDate < weekAgo) return false
        } else if (filters.dateRange === 'month') {
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            if (billDate < monthAgo) return false
        }

        return true
    })

    // Calculate stats
    const totalRevenue = filteredBills.reduce((sum, b) => sum + b.total, 0)
    const totalBills = filteredBills.length

    // Export functions
    const exportToCSV = () => {
        const headers = ['Bill No', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment']
        const rows = filteredBills.map(bill => [
            bill.bill_number,
            new Date(bill.created_at).toLocaleString(),
            bill.customer_name,
            bill.customer_phone || '-',
            bill.items?.map(i => `${i.product_name} x${i.quantity}`).join('; ') || '-',
            bill.subtotal?.toFixed(2),
            bill.tax?.toFixed(2),
            bill.total?.toFixed(2),
            bill.payment_mode
        ])

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KadaiGPT_Bills_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        addToast('Bills exported to CSV successfully!', 'success')
    }

    const exportToJSON = () => {
        const data = {
            exported_at: new Date().toISOString(),
            total_bills: filteredBills.length,
            total_revenue: totalRevenue,
            bills: filteredBills
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `KadaiGPT_Bills_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        addToast('Bills exported to JSON successfully!', 'success')
    }

    const exportToPDF = () => {
        const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        
        const html = `<!DOCTYPE html><html><head><title>Bills Report - ${storeName}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a; max-width: 1000px; margin: 0 auto; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin-bottom: 24px; }
            .stat-box { padding: 14px 20px; background: #f5f5f5; border-radius: 8px; flex: 1; }
            .stat-box h3 { font-size: 20px; margin: 0 0 4px 0; color: #ea580c; }
            .stat-box p { font-size: 11px; margin: 0; color: #888; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) { background: #fafafa; }
            .total-cell { font-weight: 700; color: #ea580c; }
            .footer { margin-top: 24px; text-align: center; color: #aaa; font-size: 11px; }
            @media print { body { padding: 10px; } }
        </style></head><body>
        <h1>📄 ${storeName} — Bills Report</h1>
        <p class="subtitle">Generated: ${dateStr} • ${filteredBills.length} bills • Total: ₹${totalRevenue.toLocaleString('en-IN')}</p>
        <div class="stats">
            <div class="stat-box"><h3>${filteredBills.length}</h3><p>Bills</p></div>
            <div class="stat-box"><h3>₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3><p>Revenue</p></div>
            <div class="stat-box"><h3>₹${totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0}</h3><p>Avg Bill</p></div>
        </div>
        <table>
            <thead><tr><th>#</th><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th></tr></thead>
            <tbody>
            ${filteredBills.map((b, i) => `<tr>
                <td>${i + 1}</td>
                <td>${b.bill_number}</td>
                <td>${new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                <td>${b.customer_name || 'Walk-in'}</td>
                <td>${b.items_count || b.items?.length || 0}</td>
                <td>${b.payment_mode}</td>
                <td class="total-cell">₹${b.total?.toFixed(2)}</td>
            </tr>`).join('')}
            </tbody>
        </table>
        <p class="footer">Powered by KadaiGPT • ${storeName}</p>
        </body></html>`
        
        const w = window.open('', '_blank')
        w.document.write(html)
        w.document.close()
        setTimeout(() => w.print(), 500)
        addToast('PDF report opened for printing!', 'success')
    }

    const printBill = async (bill) => {
        try {
            await api.printReceipt({
                bill_number: bill.bill_number,
                customer_name: bill.customer_name,
                items: bill.items,
                subtotal: bill.subtotal,
                tax: bill.tax,
                total: bill.total,
                payment_mode: bill.payment_mode
            })
            addToast('Receipt sent to printer!', 'success')
        } catch {
            addToast('Print sent (demo mode)', 'info')
        }
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const clearFilters = () => {
        setFilters({ dateRange: 'all', paymentMode: 'all', minAmount: '', maxAmount: '' })
        setSearchQuery('')
    }

    // Cancel/Void a bill (Manager+ only)
    const handleCancelBill = async () => {
        if (!cancellingBill || !cancelReason.trim()) {
            addToast?.('Please enter a reason for cancellation', 'error')
            return
        }
        try {
            await api.cancelBill(cancellingBill.id, cancelReason.trim())
            addToast?.(`Bill ${cancellingBill.bill_number} cancelled. Stock restored.`, 'success')
            setCancellingBill(null)
            setCancelReason('')
            loadBills() // Refresh
        } catch (error) {
            const msg = error?.response?.data?.detail || error?.message || 'Failed to cancel bill'
            if (msg.includes('permission') || msg.includes('403') || msg.includes('role')) {
                addToast?.('Only Managers and Owners can cancel bills', 'error')
            } else {
                addToast?.(msg, 'error')
            }
        }
    }

    return (
        <div className="bills-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📄 All Bills</h1>
                    <p className="page-subtitle">View, search, and export your billing history</p>
                </div>
                {localStorage.getItem('kadai_user_role')?.toLowerCase() !== 'owner' && (
                <button className="btn btn-primary" onClick={() => setCurrentPage('create-bill')}>
                    + New Bill
                </button>
                )}
            </div>

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat-mini">
                    <FileText size={18} />
                    <div>
                        <span className="stat-mini-value">{totalBills}</span>
                        <span className="stat-mini-label">Bills Found</span>
                    </div>
                </div>
                <div className="stat-mini">
                    <TrendingUp size={18} />
                    <div>
                        <span className="stat-mini-value">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        <span className="stat-mini-label">Total Revenue</span>
                    </div>
                </div>
                <div className="stat-mini">
                    <ArrowUpRight size={18} />
                    <div>
                        <span className="stat-mini-value">₹{totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0}</span>
                        <span className="stat-mini-label">Avg Bill Value</span>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="card search-bar">
                <div className="search-input">
                    <Search size={18} className="icon" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search by bill number, customer name, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="filter-actions">
                    <button className={`btn btn-ghost ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={18} /> Filters <ChevronDown size={16} />
                    </button>
                    <div className="export-dropdown">
                        <button className="btn btn-secondary">
                            <Download size={18} /> Export
                        </button>
                        <div className="dropdown-menu">
                            <button onClick={exportToCSV}>📊 Export as CSV</button>
                            <button onClick={exportToJSON}>📋 Export as JSON</button>
                            <button onClick={exportToPDF}>📄 Export as PDF</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="card filters-panel">
                    <div className="filters-grid">
                        <div className="form-group">
                            <label className="form-label">Date Range</label>
                            <select className="form-input" value={filters.dateRange} onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}>
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Mode</label>
                            <select className="form-input" value={filters.paymentMode} onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}>
                                <option value="all">All Modes</option>
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="credit">Due / Credit</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Min Amount (₹)</label>
                            <input type="number" className="form-input" placeholder="0" value={filters.minAmount} onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Max Amount (₹)</label>
                            <input type="number" className="form-input" placeholder="Any" value={filters.maxAmount} onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })} />
                        </div>
                    </div>
                    <div className="filters-actions">
                        <button className="btn btn-ghost" onClick={clearFilters}>Clear All</button>
                        <button className="btn btn-primary" onClick={() => setShowFilters(false)}>Apply Filters</button>
                    </div>
                </div>
            )}

            {/* Bills Table */}
            {bills.length === 0 ? (
                <EmptyState
                    type="bills"
                    onAction={() => setCurrentPage('create-bill')}
                />
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Invoice</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Amount</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBills.map(bill => (
                                    <tr key={bill.id}>
                                        <td><code className="bill-code">{bill.bill_number}</code></td>
                                        <td>
                                            <div className="customer-cell">
                                                <span className="customer-name">{bill.customer_name}</span>
                                                {bill.customer_phone && <span className="customer-phone">{bill.customer_phone}</span>}
                                            </div>
                                        </td>
                                        <td><span className="items-count">{bill.items_count || bill.items?.length || 0} items</span></td>
                                        <td><span className="amount">₹{bill.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
                                        <td><span className={`badge badge-${bill.payment_mode?.toLowerCase() === 'cash' ? 'success' : bill.payment_mode?.toLowerCase() === 'upi' ? 'info' : bill.payment_mode?.toLowerCase() === 'credit' ? 'error' : 'warning'}`}>{bill.payment_mode?.toLowerCase() === 'credit' ? 'DUE' : bill.payment_mode}</span></td>
                                        <td>
                                            <span className={`badge badge-${bill.status === 'cancelled' ? 'danger' : bill.status === 'refunded' ? 'warning' : 'success'}`}>
                                                {bill.status === 'cancelled' ? '❌ Cancelled' : bill.status === 'refunded' ? '↩️ Refunded' : '✅ Completed'}
                                            </span>
                                        </td>
                                        <td><span className="date-cell">{formatDate(bill.created_at)}</span></td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn btn-ghost btn-sm" onClick={async () => {
                                                    const fullBill = await realDataService.getBillById(bill.id)
                                                    setSelectedBill(fullBill || bill)
                                                }} title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => printBill(bill)} title="Print Receipt">
                                                    <Printer size={16} />
                                                </button>
                                                {bill.status !== 'cancelled' && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setCancellingBill(bill)} title="Cancel Bill" style={{ color: 'var(--danger-500, #ef4444)' }}>
                                                        <XCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredBills.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="empty-state">
                                            <FileText size={48} />
                                            <h4>No bills found</h4>
                                            <p>Try adjusting your filters or create a new bill</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Bill Details Modal */}
            {selectedBill && (
                <div className="modal-overlay" onClick={() => setSelectedBill(null)}>
                    <div className="modal bill-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Bill Details</h3>
                            <button className="modal-close" onClick={() => setSelectedBill(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="bill-details-header">
                                <div>
                                    <h4>{selectedBill.bill_number}</h4>
                                    <p>{formatDate(selectedBill.created_at)}</p>
                                </div>
                                <span className="badge badge-success">Completed</span>
                            </div>

                            <div className="bill-details-section">
                                <h5>Customer</h5>
                                <p>{selectedBill.customer_name}</p>
                                {selectedBill.customer_phone && <p className="text-secondary">{selectedBill.customer_phone}</p>}
                            </div>

                            <div className="bill-details-section">
                                <h5>Items</h5>
                                <div className="bill-items-list">
                                    {selectedBill.items?.map((item, i) => (
                                        <div key={i} className="bill-item-row">
                                            <span>{item.product_name}</span>
                                            <span>{item.quantity} × ₹{item.unit_price}</span>
                                            <span className="item-amount">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bill-details-section totals-section">
                                {(() => {
                                    // Calculate subtotal from items if missing
                                    const calculatedSubtotal = selectedBill.items?.reduce(
                                        (sum, item) => sum + (item.quantity * (item.unit_price || item.price || 0)), 0
                                    ) || 0
                                    const subtotal = selectedBill.subtotal || calculatedSubtotal
                                    const gstRate = parseFloat(localStorage.getItem('kadai_default_gst_rate') || '5') / 100
                                    const tax = selectedBill.tax || (subtotal * gstRate)
                                    const total = selectedBill.total || (subtotal + tax)

                                    return (
                                        <>
                                            <div className="total-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                                            <div className="total-row"><span>GST ({(gstRate * 100).toFixed(0)}%)</span><span>₹{tax.toFixed(2)}</span></div>
                                            <div className="total-row grand"><span>Grand Total</span><span>₹{total.toFixed(2)}</span></div>
                                            <div className="total-row"><span>Payment Mode</span><span className={`badge ${selectedBill.payment_mode?.toLowerCase() === 'credit' ? 'badge-error' : 'badge-info'}`}>{selectedBill.payment_mode?.toLowerCase() === 'credit' ? 'DUE' : selectedBill.payment_mode}</span></div>
                                        </>
                                    )
                                })()}
                            </div>

                            {/* Receipt Preview */}
                            <div className="receipt-preview-section">
                                <h5>Receipt Preview</h5>
                                <div className="receipt-preview">
                                    <pre>{generateReceiptText(selectedBill)}</pre>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedBill(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { printBill(selectedBill); setSelectedBill(null); }}>
                                <Printer size={18} /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Bill Confirmation Modal */}
            {cancellingBill && (
                <div className="modal-overlay" onClick={() => setCancellingBill(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)' }}>
                            <h3 className="modal-title" style={{ color: '#dc2626' }}>
                                <AlertTriangle size={20} style={{ marginRight: 8 }} />
                                Cancel Bill
                            </h3>
                            <button className="modal-close" onClick={() => setCancellingBill(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 12 }}>
                                Cancel <strong>{cancellingBill.bill_number}</strong> for <strong>₹{cancellingBill.total?.toFixed(2)}</strong>?
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                                ⚠️ Stock will be restored for all items. This action requires Manager/Owner permissions.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Reason for cancellation *</label>
                                <textarea
                                    className="form-input"
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    placeholder="e.g. Customer returned items, wrong bill, duplicate entry..."
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setCancellingBill(null); setCancelReason('') }}>Keep Bill</button>
                            <button
                                className="btn"
                                style={{ background: '#dc2626', color: 'white' }}
                                onClick={handleCancelBill}
                                disabled={!cancelReason.trim()}
                            >
                                <XCircle size={16} /> Cancel Bill
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
        .stats-bar { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-mini { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); flex: 1; }
        .stat-mini svg { color: var(--primary-400); }
        .stat-mini-value { font-size: 1.25rem; font-weight: 700; display: block; }
        .stat-mini-label { font-size: 0.75rem; color: var(--text-tertiary); }
        /* Mobile: stack each stat compactly so all three fit without overflowing */
        @media (max-width: 768px) {
          .stats-bar { gap: 8px; }
          .stat-mini { flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; min-width: 0; }
          .stat-mini svg { width: 18px; height: 18px; }
          .stat-mini-value { font-size: 1rem; }
          .stat-mini-label { font-size: 0.65rem; line-height: 1.2; }
        }

        .search-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
        .search-input { flex: 1; }
        .filter-actions { display: flex; gap: 12px; }
        
        .export-dropdown { position: relative; }
        .export-dropdown .dropdown-menu { 
          position: absolute; right: 0; top: 100%; margin-top: 8px;
          background: var(--bg-card); border: 1px solid var(--border-default);
          border-radius: var(--radius-lg); padding: 8px; min-width: 160px;
          opacity: 0; visibility: hidden; transition: all var(--transition-fast);
          z-index: 100; box-shadow: var(--shadow-lg);
        }
        .export-dropdown:hover .dropdown-menu { opacity: 1; visibility: visible; }
        .dropdown-menu button { 
          width: 100%; padding: 10px 14px; text-align: left;
          background: none; border: none; border-radius: var(--radius-md);
          cursor: pointer; color: var(--text-primary); font-size: 0.875rem;
        }
        .dropdown-menu button:hover { background: var(--bg-tertiary); }

        .filters-panel { margin-bottom: 16px; }
        .filters-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 900px) { .filters-grid { grid-template-columns: repeat(2, 1fr); } }
        .filters-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle); }

        .bill-code { background: var(--bg-tertiary); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8125rem; }
        .customer-cell { display: flex; flex-direction: column; }
        .customer-name { font-weight: 500; }
        .customer-phone { font-size: 0.75rem; color: var(--text-tertiary); }
        .items-count { color: var(--text-secondary); font-size: 0.875rem; }
        .amount { font-weight: 700; color: var(--primary-400); }
        .date-cell { font-size: 0.8125rem; color: var(--text-secondary); }
        .action-buttons { display: flex; gap: 4px; }

        .empty-state { text-align: center; padding: 60px 20px; color: var(--text-tertiary); }
        .empty-state svg { opacity: 0.3; margin-bottom: 16px; }
        .empty-state h4 { color: var(--text-secondary); margin-bottom: 8px; }

        .bill-modal { max-width: 600px; max-height: 90vh; overflow-y: auto; }
        .bill-details-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle); }
        .bill-details-header h4 { font-size: 1.25rem; margin-bottom: 4px; }
        .bill-details-header p { color: var(--text-secondary); font-size: 0.875rem; }
        .bill-details-section { margin-bottom: 20px; }
        .bill-details-section h5 { font-size: 0.875rem; color: var(--text-tertiary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .bill-items-list { display: flex; flex-direction: column; gap: 8px; }
        .bill-item-row { display: flex; justify-content: space-between; padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: 0.875rem; }
        .item-amount { font-weight: 600; }
        .totals-section { padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-row.grand { font-size: 1.125rem; font-weight: 700; color: var(--primary-400); border-top: 1px solid var(--border-subtle); margin-top: 8px; padding-top: 12px; }

        .receipt-preview-section { margin-top: 20px; }
        .receipt-preview-section h5 { font-size: 0.875rem; color: var(--text-tertiary); margin-bottom: 12px; text-transform: uppercase; }
        .receipt-preview { background: #1a1a1a; padding: 20px; border-radius: var(--radius-lg); overflow-x: auto; }
        .receipt-preview pre { font-family: 'Courier New', monospace; font-size: 0.75rem; color: #e5e5e5; white-space: pre; margin: 0; line-height: 1.5; }
      `}</style>
        </div>
    )
}

// Helper function to generate receipt text
function generateReceiptText(bill) {
    const w = 32
    let r = ''
    r += '='.repeat(w) + '\n'
    r += 'KadaiGPT Store'.padStart(w / 2 + 7).padEnd(w) + '\n'
    r += '='.repeat(w) + '\n'
    r += `Bill: ${bill.bill_number}\n`
    r += `Date: ${new Date(bill.created_at).toLocaleString()}\n`
    r += `Customer: ${bill.customer_name}\n`
    r += '-'.repeat(w) + '\n'
    r += 'Item             Qty     Amount\n'
    r += '-'.repeat(w) + '\n'
    bill.items?.forEach(item => {
        const name = item.product_name.substring(0, 16).padEnd(16)
        const qty = item.quantity.toString().padStart(3)
        const amt = (item.quantity * item.unit_price).toFixed(2).padStart(10)
        r += `${name} ${qty} ${amt}\n`
    })
    r += '-'.repeat(w) + '\n'
    r += `${'Subtotal'.padEnd(20)} ₹${bill.subtotal?.toFixed(2)}\n`
    r += `${'GST (5%)'.padEnd(20)} ₹${bill.tax?.toFixed(2)}\n`
    r += '='.repeat(w) + '\n'
    r += `${'TOTAL'.padEnd(20)} ₹${bill.total?.toFixed(2)}\n`
    r += '='.repeat(w) + '\n'
    r += `Payment: ${bill.payment_mode}\n`
    r += '\n'
    r += 'Thank You!'.padStart(w / 2 + 5).padEnd(w) + '\n'
    r += 'Powered by KadaiGPT'.padStart(w / 2 + 10).padEnd(w) + '\n'
    return r
}
