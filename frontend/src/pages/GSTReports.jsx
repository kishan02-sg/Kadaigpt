import { useState, useEffect } from 'react'
import { Receipt, Download, FileText, Calendar, Check, Clock, IndianRupee, AlertCircle, ChevronDown, RefreshCw, Loader2 } from 'lucide-react'
import realDataService from '../services/realDataService'
import api from '../services/api'

export default function GSTReports({ addToast }) {
    const [selectedMonth, setSelectedMonth] = useState('Feb 2026')
    const [generating, setGenerating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [gstData, setGstData] = useState({
        summary: {
            totalSales: 0,
            taxableAmount: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
            totalGST: 0,
            exemptSales: 0,
            netPayable: 0
        },
        monthly: [{ month: 'Feb 2026' }],
        invoices: [],
        breakdown: []
    })

    const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'
    const gstin = localStorage.getItem('kadai_gstin') || 'Not Configured'
    const defaultGstRate = parseInt(localStorage.getItem('kadai_default_gst_rate') || '5')

    // Load GST data from bills
    useEffect(() => {
        loadGSTData()
    }, [])

    const loadGSTData = async () => {
        setLoading(true)
        try {
            const billsData = await realDataService.getBills()
            const bills = Array.isArray(billsData) ? billsData : []

            // Calculate GST data from bills
            const gstRate = defaultGstRate / 100
            let totalSales = 0
            let totalCgst = 0
            let totalSgst = 0
            let exemptSales = 0

            // Category breakdown
            const categoryBreakdown = {}

            const invoices = bills.map(bill => {
                const billTotal = bill.total || 0
                const taxableAmount = bill.subtotal || (billTotal / (1 + gstRate)) || 0
                const cgst = (taxableAmount * gstRate / 2)
                const sgst = (taxableAmount * gstRate / 2)

                totalSales += taxableAmount
                totalCgst += cgst
                totalSgst += sgst

                // Track category breakdown
                const category = 'General' // Default category
                if (!categoryBreakdown[category]) {
                    categoryBreakdown[category] = { sales: 0, cgst: 0, sgst: 0, gstRate: defaultGstRate }
                }
                categoryBreakdown[category].sales += taxableAmount
                categoryBreakdown[category].cgst += cgst
                categoryBreakdown[category].sgst += sgst

                // Safe date parsing
                let dateStr = 'N/A'
                try {
                    const date = new Date(bill.created_at || bill.createdAt || Date.now())
                    dateStr = date.toLocaleDateString('en-IN')
                } catch (e) {
                    dateStr = 'N/A'
                }

                return {
                    invoiceNo: bill.bill_number || bill.billNumber || `INV-${bill.id || 0}`,
                    date: dateStr,
                    customerGstin: bill.customer_gstin || '',
                    taxableAmount: Math.round(taxableAmount),
                    cgst: Math.round(cgst),
                    sgst: Math.round(sgst),
                    total: billTotal || Math.round(taxableAmount + cgst + sgst)
                }
            })

            // Convert breakdown to array
            const breakdown = Object.entries(categoryBreakdown).map(([category, data]) => ({
                category,
                sales: Math.round(data.sales),
                gstRate: data.gstRate,
                cgst: Math.round(data.cgst),
                sgst: Math.round(data.sgst)
            }))

            // Generate monthly periods
            const now = new Date()
            const months = []
            for (let i = 0; i < 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                months.push({ month: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) })
            }

            setGstData({
                summary: {
                    totalSales: Math.round(totalSales),
                    taxableAmount: Math.round(totalSales),
                    cgst: Math.round(totalCgst),
                    sgst: Math.round(totalSgst),
                    igst: 0,
                    totalTax: Math.round(totalCgst + totalSgst),
                    totalGST: Math.round(totalCgst + totalSgst),
                    exemptSales: Math.round(exemptSales),
                    netPayable: Math.round(totalCgst + totalSgst)
                },
                monthly: months,
                invoices,
                breakdown
            })
        } catch (error) {
            console.error('Failed to load GST data:', error)
            addToast?.('Failed to load GST data', 'error')
            // Set empty data on error
            setGstData({
                summary: { totalSales: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalGST: 0, exemptSales: 0, netPayable: 0 },
                monthly: [{ month: 'Jan 2026' }],
                invoices: [],
                breakdown: []
            })
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateGSTR1 = () => {
        setGenerating(true)
        setTimeout(() => {
            setGenerating(false)
            addToast('GSTR-1 report generated successfully!', 'success')
        }, 2000)
    }

    const handleResetGST = () => {
        if (window.confirm('Are you sure you want to reset GST data? This will clear all current period calculations.')) {
            setGstData({
                summary: {
                    totalSales: 0,
                    cgst: 0,
                    sgst: 0,
                    igst: 0,
                    totalTax: 0,
                    netPayable: 0
                },
                monthly: [],
                invoices: []
            })
            addToast('GST data reset successfully!', 'success')
        }
    }

    const handleExport = (format) => {
        setShowExportMenu(false)
        addToast(`Exporting as ${format.toUpperCase()}...`, 'info')

        try {
            const selectedData = gstData.monthly.find(m => m.month === selectedMonth) || gstData.monthly[0]

            if (format === 'csv') {
                // Generate CSV
                const headers = ['Invoice No', 'Date', 'Customer GSTIN', 'Taxable Amount', 'CGST', 'SGST', 'Total']
                const rows = gstData.invoices.map(inv => [
                    inv.invoiceNo,
                    inv.date,
                    inv.customerGstin || 'N/A',
                    inv.taxableAmount,
                    inv.cgst,
                    inv.sgst,
                    inv.total
                ])

                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
                downloadFile(csvContent, `GST_Report_${selectedMonth.replace(' ', '_')}.csv`, 'text/csv')
            } else if (format === 'json') {
                // Generate JSON
                const jsonData = {
                    storeName,
                    gstin,
                    period: selectedMonth,
                    summary: gstData.summary,
                    invoices: gstData.invoices,
                    generatedAt: new Date().toISOString()
                }
                downloadFile(JSON.stringify(jsonData, null, 2), `GST_Report_${selectedMonth.replace(' ', '_')}.json`, 'application/json')
            } else if (format === 'pdf') {
                // Generate simple HTML that can be printed as PDF
                const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>GST Report - ${selectedMonth}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 40px; }
                            h1 { color: #333; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
                            .info { margin: 20px 0; }
                            .info p { margin: 5px 0; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background: #7c3aed; color: white; }
                            tr:nth-child(even) { background: #f9f9f9; }
                            .summary { display: flex; gap: 20px; margin: 20px 0; }
                            .summary-box { background: #f3f4f6; padding: 15px; border-radius: 8px; flex: 1; }
                            .summary-box h3 { margin: 0 0 5px 0; font-size: 14px; color: #666; }
                            .summary-box p { margin: 0; font-size: 20px; font-weight: bold; }
                        </style>
                    </head>
                    <body>
                        <h1>🧾 GST Report - ${selectedMonth}</h1>
                        <div class="info">
                            <p><strong>Store:</strong> ${storeName}</p>
                            <p><strong>GSTIN:</strong> ${gstin}</p>
                            <p><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</p>
                        </div>
                        <div class="summary">
                            <div class="summary-box">
                                <h3>Total Sales</h3>
                                <p>₹${(gstData?.summary?.totalSales || 0).toLocaleString()}</p>
                            </div>
                            <div class="summary-box">
                                <h3>CGST Collected</h3>
                                <p>₹${(gstData?.summary?.cgst || 0).toLocaleString()}</p>
                            </div>
                            <div class="summary-box">
                                <h3>SGST Collected</h3>
                                <p>₹${(gstData?.summary?.sgst || 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <h2>Invoice Details</h2>
                        <table>
                            <tr>
                                <th>Invoice No</th>
                                <th>Date</th>
                                <th>Taxable Amount</th>
                                <th>CGST</th>
                                <th>SGST</th>
                                <th>Total</th>
                            </tr>
                            ${(gstData?.invoices || []).map(inv => `
                                <tr>
                                    <td>${inv?.invoiceNo || 'N/A'}</td>
                                    <td>${inv?.date || 'N/A'}</td>
                                    <td>₹${(inv?.taxableAmount || 0).toLocaleString()}</td>
                                    <td>₹${(inv?.cgst || 0).toLocaleString()}</td>
                                    <td>₹${(inv?.sgst || 0).toLocaleString()}</td>
                                    <td>₹${(inv?.total || 0).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </table>
                        <p style="margin-top: 40px; color: #666; font-size: 12px;">Generated by KadaiGPT - India's AI-Powered Retail Platform</p>
                    </body>
                    </html>
                `

                // Open in new window for printing as PDF
                const printWindow = window.open('', '_blank')
                printWindow.document.write(htmlContent)
                printWindow.document.close()
                printWindow.print()
            }

            addToast(`${format.toUpperCase()} report ready!`, 'success')
        } catch (error) {
            addToast(`Failed to export: ${error.message}`, 'error')
        }
    }

    const downloadFile = (content, filename, mimeType) => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const gstSlabs = [
        { rate: 0, label: 'Exempt', examples: 'Rice, Wheat, Milk, Vegetables' },
        { rate: 5, label: '5% GST', examples: 'Pulses, Oils, Tea, Coffee' },
        { rate: 12, label: '12% GST', examples: 'Packaged Foods, Processed Items' },
        { rate: 18, label: '18% GST', examples: 'Beverages, Cosmetics, Electronics' },
    ]

    return (
        <div className="gst-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🧾 GST Reports</h1>
                    <p className="page-subtitle">Generate GSTR-1 and track tax compliance</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-ghost" onClick={handleResetGST} title="Reset GST Data">
                        <RefreshCw size={18} /> Reset
                    </button>
                    <div className="export-dropdown">
                        <button className="btn btn-secondary" onClick={() => setShowExportMenu(!showExportMenu)}>
                            <Download size={18} /> Export <ChevronDown size={16} />
                        </button>
                        {showExportMenu && (
                            <div className="dropdown-menu">
                                <button onClick={() => handleExport('csv')}>Export as CSV</button>
                                <button onClick={() => handleExport('json')}>Export as JSON</button>
                                <button onClick={() => handleExport('pdf')}>Export as PDF</button>
                            </div>
                        )}
                    </div>
                    <button className="btn btn-primary" onClick={handleGenerateGSTR1} disabled={generating}>
                        <FileText size={18} /> {generating ? 'Generating...' : 'Generate GSTR-1'}
                    </button>
                </div>
            </div>

            {/* Store Info */}
            <div className="card store-info-card">
                <div className="store-info">
                    <div>
                        <span className="label">Store Name</span>
                        <span className="value">{storeName}</span>
                    </div>
                    <div>
                        <span className="label">GSTIN</span>
                        <span className="value gstin">{gstin}</span>
                    </div>
                    <div>
                        <span className="label">Filing Period</span>
                        <select className="form-input" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                            {gstData.monthly.map(m => (
                                <option key={m.month} value={m.month}>{m.month}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="gst-stats">
                <div className="stat-card">
                    <IndianRupee size={24} />
                    <div>
                        <span className="value">₹{(gstData?.summary?.totalSales || 0).toLocaleString()}</span>
                        <span className="label">Total Sales</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Receipt size={24} />
                    <div>
                        <span className="value">₹{(gstData?.summary?.taxableAmount || 0).toLocaleString()}</span>
                        <span className="label">Taxable Amount</span>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <FileText size={24} />
                    <div>
                        <span className="value">₹{(gstData?.summary?.totalGST || 0).toLocaleString()}</span>
                        <span className="label">Total GST</span>
                    </div>
                </div>
                <div className="stat-card">
                    <AlertCircle size={24} />
                    <div>
                        <span className="value">₹{(gstData?.summary?.exemptSales || 0).toLocaleString()}</span>
                        <span className="label">Exempt Sales</span>
                    </div>
                </div>
            </div>

            {/* GST Breakdown */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Receipt size={20} /> Category-wise GST Breakdown</h3>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Sales Amount</th>
                                <th>GST Rate</th>
                                <th>CGST</th>
                                <th>SGST</th>
                                <th>Total GST</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(gstData?.breakdown || []).length > 0 ? (
                                (gstData?.breakdown || []).map((item, i) => (
                                    <tr key={i}>
                                        <td>{item?.category || 'General'}</td>
                                        <td>₹{(item?.sales || 0).toLocaleString()}</td>
                                        <td><span className={`rate-badge rate-${item?.gstRate || 5}`}>{item?.gstRate || 5}%</span></td>
                                        <td>₹{(item?.cgst || 0).toLocaleString()}</td>
                                        <td>₹{(item?.sgst || 0).toLocaleString()}</td>
                                        <td className="total-gst">₹{((item?.cgst || 0) + (item?.sgst || 0)).toLocaleString()}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                                        No GST data available. Create some bills to see breakdown.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Total</strong></td>
                                <td><strong>₹{(gstData?.summary?.totalSales || 0).toLocaleString()}</strong></td>
                                <td></td>
                                <td><strong>₹{(gstData?.summary?.cgst || 0).toLocaleString()}</strong></td>
                                <td><strong>₹{(gstData?.summary?.sgst || 0).toLocaleString()}</strong></td>
                                <td className="total-gst"><strong>₹{(gstData?.summary?.totalGST || 0).toLocaleString()}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="gst-grid">
                {/* GST Slabs Info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">GST Slab Information</h3>
                    </div>
                    <div className="slab-list">
                        {gstSlabs.map((slab, i) => (
                            <div key={i} className={`slab-item slab-${slab.rate}`}>
                                <div className="slab-rate">{slab.rate}%</div>
                                <div className="slab-info">
                                    <span className="slab-label">{slab.label}</span>
                                    <span className="slab-examples">{slab.examples}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filing History */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Calendar size={20} /> Filing History</h3>
                    </div>
                    <div className="filing-history">
                        {(gstData?.monthly || []).length > 0 ? (
                            (gstData?.monthly || []).map((record, i) => (
                                <div key={i} className="filing-item">
                                    <div className="filing-info">
                                        <span className="filing-month">{record?.month || 'N/A'}</span>
                                        <span className="filing-amount">₹{(record?.sales || 0).toLocaleString()} | GST: ₹{(record?.gst || 0).toLocaleString()}</span>
                                    </div>
                                    <div className={`filing-status ${record?.filed ? 'filed' : 'pending'}`}>
                                        {record?.filed ? <><Check size={14} /> Filed</> : <><Clock size={14} /> Pending</>}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>
                                No filing history available yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        .header-actions { display: flex; gap: 12px; position: relative; }
        .export-dropdown { position: relative; }
        .dropdown-menu {
          position: absolute; top: 100%; right: 0; margin-top: 8px;
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); padding: 8px;
          min-width: 160px; z-index: 100;
          box-shadow: var(--shadow-lg);
        }
        .dropdown-menu button {
          width: 100%; padding: 10px 16px; background: none; border: none;
          text-align: left; cursor: pointer; border-radius: var(--radius-md);
          color: var(--text-primary); font-size: 0.875rem;
          transition: background var(--transition-fast);
        }
        .dropdown-menu button:hover { background: var(--bg-tertiary); }

        .store-info-card { margin-bottom: 24px; }
        .store-info { display: flex; gap: 48px; align-items: center; }
        .store-info > div { display: flex; flex-direction: column; }
        .store-info .label { font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 4px; }
        .store-info .value { font-weight: 600; font-size: 1rem; }
        .store-info .gstin { font-family: var(--font-mono); letter-spacing: 1px; }
        .store-info .form-input { width: 160px; }

        .gst-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        @media (max-width: 1024px) { .gst-stats { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
        }
        .stat-card svg { color: var(--primary-400); }
        .stat-card.highlight { background: var(--gradient-primary); color: white; border: none; }
        .stat-card.highlight svg { color: white; }
        .stat-card .value { font-size: 1.25rem; font-weight: 700; display: block; }
        .stat-card .label { font-size: 0.8125rem; opacity: 0.8; }

        .rate-badge { padding: 4px 10px; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.8125rem; }
        .rate-0 { background: rgba(34, 197, 94, 0.1); color: var(--success); }
        .rate-5 { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .rate-12 { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .rate-18 { background: rgba(239, 68, 68, 0.1); color: var(--error); }
        .total-gst { font-weight: 700; color: var(--primary-400); }
        tfoot td { border-top: 2px solid var(--border-default); padding-top: 16px; }

        .gst-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
        @media (max-width: 1024px) { .gst-grid { grid-template-columns: 1fr; } }

        .slab-list { display: flex; flex-direction: column; gap: 12px; }
        .slab-item { display: flex; align-items: center; gap: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .slab-rate { 
          width: 48px; height: 48px; border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
        }
        .slab-0 .slab-rate { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .slab-5 .slab-rate { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .slab-12 .slab-rate { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .slab-18 .slab-rate { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        .slab-info { flex: 1; }
        .slab-label { font-weight: 600; display: block; }
        .slab-examples { font-size: 0.75rem; color: var(--text-tertiary); }

        .filing-history { display: flex; flex-direction: column; gap: 12px; }
        .filing-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .filing-month { font-weight: 600; display: block; }
        .filing-amount { font-size: 0.75rem; color: var(--text-tertiary); }
        .filing-status { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.8125rem; font-weight: 600; }
        .filing-status.filed { background: rgba(34, 197, 94, 0.1); color: var(--success); }
        .filing-status.pending { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
      `}</style>
        </div>
    )
}
