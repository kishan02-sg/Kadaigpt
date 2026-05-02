import { useState, useEffect } from 'react'
import { Users, Search, Plus, Phone, IndianRupee, Calendar, X, Send, Check, AlertCircle, Loader2, Edit2, Trash2 } from 'lucide-react'
import realDataService from '../services/realDataService'
import api from '../services/api'
import FloatingActionButton from '../components/FloatingActionButton'

export default function Customers({ addToast, setCurrentPage }) {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [editCustomer, setEditCustomer] = useState(null)
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', initialCredit: '' })
    const [paymentAmount, setPaymentAmount] = useState('')

    // Load customers from API
    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        setLoading(true)

        try {
            // Always fetch from real API - no more demo mode
            const customerList = await realDataService.getCustomers()

            if (Array.isArray(customerList)) {
                // Normalize customer data
                const normalizedCustomers = customerList.map(c => ({
                    ...c,
                    credit: c.credit || c.outstanding || 0,
                    totalPurchases: c.totalSpent || c.totalPurchases || 0,
                    visits: c.visits || 0,
                    lastPurchase: c.lastVisit || c.lastPurchase
                }))
                setCustomers(normalizedCustomers)
            } else {
                setCustomers([])
            }
        } catch (error) {
            console.error('Error loading customers:', error)
            addToast?.('Failed to load customers', 'error')
            setCustomers([])
        } finally {
            setLoading(false)
        }
    }

    // Statistics
    const totalCredit = customers.reduce((sum, c) => sum + (c.credit || 0), 0)
    const customersWithCredit = customers.filter(c => (c.credit || 0) > 0).length

    // Customer Segmentation
    const [segmentFilter, setSegmentFilter] = useState('All')
    const getSegment = (c) => {
        const spent = c.totalPurchases || c.totalSpent || 0
        const visits = c.visits || 0
        if (spent >= 10000 || visits >= 20) return { label: 'VIP', color: '#8b5cf6', emoji: '👑' }
        if (spent >= 3000 || visits >= 8) return { label: 'Regular', color: '#3b82f6', emoji: '⭐' }
        if (visits <= 1) return { label: 'New', color: '#10b981', emoji: '🆕' }
        return { label: 'At-Risk', color: '#f59e0b', emoji: '⚠️' }
    }
    const segments = ['All', 'VIP', 'Regular', 'At-Risk', 'New']
    const segmentCounts = segments.reduce((acc, s) => {
        acc[s] = s === 'All' ? customers.length : customers.filter(c => getSegment(c).label === s).length
        return acc
    }, {})

    // Filter
    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.phone && c.phone.includes(search))
        const matchesSegment = segmentFilter === 'All' || getSegment(c).label === segmentFilter
        return matchesSearch && matchesSegment
    })

    const handleAddCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            addToast('Name and phone are required', 'error')
            return
        }

        // BUG-004: Validate phone format
        const cleanPhone = newCustomer.phone.replace(/\D/g, '')
        if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
            addToast('Phone must be 10 digits starting with 6, 7, 8, or 9', 'error')
            return
        }

        try {
            const customerData = {
                ...newCustomer,
                phone: cleanPhone,
                credit: parseFloat(newCustomer.initialCredit) || 0
            }
            const customer = await api.createCustomer(customerData)
            setCustomers([customer, ...customers])
            setNewCustomer({ name: '', phone: '', email: '', address: '', initialCredit: '' })
            setShowAddModal(false)
            addToast('Customer added successfully!', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to add customer', 'error')
        }
    }

    const handlePayment = async (customerId) => {
        const amount = parseFloat(paymentAmount)
        if (!amount || amount <= 0) {
            addToast('Enter a valid amount', 'error')
            return
        }

        try {
            const result = await api.recordPayment(customerId, amount)
            setCustomers(customers.map(c =>
                c.id === customerId ? result.customer : c
            ))
            setPaymentAmount('')
            setSelectedCustomer(null)
            addToast(`Payment of ₹${amount} recorded!`, 'success')
        } catch (error) {
            addToast(error.message || 'Failed to record payment', 'error')
        }
    }

    const handleAddCredit = async (customerId, amount) => {
        try {
            const result = await api.addCredit(customerId, amount)
            setCustomers(customers.map(c =>
                c.id === customerId ? result.customer : c
            ))
            addToast(`Added ₹${amount} to credit`, 'info')
        } catch (error) {
            addToast(error.message || 'Failed to add credit', 'error')
        }
    }

    const handleEditCustomer = (customer) => {
        setEditCustomer({ ...customer })
        setShowEditModal(true)
    }

    const handleUpdateCustomer = async () => {
        if (!editCustomer?.name || !editCustomer?.phone) {
            addToast('Name and phone are required', 'error')
            return
        }

        // BUG-004: Validate phone
        const cleanPhone = editCustomer.phone.replace(/\D/g, '')
        if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
            addToast('Phone must be 10 digits starting with 6, 7, 8, or 9', 'error')
            return
        }

        try {
            const updated = await api.updateCustomer(editCustomer.id, editCustomer)
            setCustomers(customers.map(c => c.id === editCustomer.id ? updated : c))
            setShowEditModal(false)
            setEditCustomer(null)
            addToast('Customer updated successfully!', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to update customer', 'error')
        }
    }

    const handleDeleteCustomer = async (customerId) => {
        if (!window.confirm('Are you sure you want to delete this customer?')) return

        try {
            await api.deleteCustomer(customerId)
            setCustomers(customers.filter(c => c.id !== customerId))
            addToast('Customer deleted', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to delete customer', 'error')
        }
    }

    const sendReminder = (customer) => {
        // Open WhatsApp with reminder message
        const message = `Hi ${customer.name}, this is a friendly reminder about your pending dues of ₹${customer.credit}. Please clear at your earliest convenience. Thank you!`
        const url = `https://wa.me/91${customer.phone}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
        addToast(`Reminder sent to ${customer.name}`, 'success')
    }

    // Redeem loyalty points: 10000 points = ₹100 discount (100 points = ₹1)
    const handleRedeemPoints = async (customer) => {
        const points = customer.loyalty_points || customer.loyaltyPoints || 0
        if (points < 10000) {
            addToast('Minimum 10,000 points required for redemption', 'error')
            return
        }

        const pointsToRedeem = Math.floor(points / 10000) * 10000
        const discountValue = pointsToRedeem / 100 // 100 points = ₹1, so 10000 = ₹100

        if (window.confirm(`Redeem ${pointsToRedeem.toLocaleString()} points for ₹${discountValue.toLocaleString()} credit?`)) {
            try {
                const newPoints = points - pointsToRedeem
                const newCredit = (customer.credit || 0) - discountValue // Reduce credit or add as store credit

                await api.updateCustomer?.(customer.id, {
                    loyalty_points: newPoints,
                    credit: Math.max(0, newCredit)
                })

                setCustomers(customers.map(c =>
                    c.id === customer.id
                        ? { ...c, loyalty_points: newPoints, credit: Math.max(0, newCredit) }
                        : c
                ))

                addToast(`🎉 ₹${discountValue} redeemed! ${newPoints} points remaining.`, 'success')

                // Send WhatsApp confirmation
                const waMessage = `🎉 Congratulations ${customer.name}!\n\nYou've redeemed ${pointsToRedeem.toLocaleString()} loyalty points for ₹${discountValue.toLocaleString()} discount!\n\nRemaining points: ${newPoints.toLocaleString()}\n\nThank you for being a valued customer! 🙏\n_Powered by KadaiGPT_`
                const waUrl = `https://wa.me/91${customer.phone}?text=${encodeURIComponent(waMessage)}`
                window.open(waUrl, '_blank')
            } catch (error) {
                addToast('Failed to redeem points', 'error')
            }
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <Loader2 className="spin" size={48} />
                <p>Loading customers...</p>
            </div>
        )
    }

    return (
        <div className="customers-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">👥 Customer Credit Book (Khata)</h1>
                    <p className="page-subtitle">Manage customer credits and track payments</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} /> Add Customer
                </button>
            </div>

            {/* Stats */}
            <div className="credit-stats">
                <div className="stat-card">
                    <Users size={24} />
                    <div>
                        <span className="stat-value">{customers.length}</span>
                        <span className="stat-label">Total Customers</span>
                    </div>
                </div>
                <div className="stat-card warning">
                    <IndianRupee size={24} />
                    <div>
                        <span className="stat-value">₹{totalCredit.toLocaleString()}</span>
                        <span className="stat-label">Total Pending Credit</span>
                    </div>
                </div>
                <div className="stat-card">
                    <AlertCircle size={24} />
                    <div>
                        <span className="stat-value">{customersWithCredit}</span>
                        <span className="stat-label">With Pending Dues</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="card search-bar">
                <div className="search-input">
                    <Search size={18} className="icon" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search customers by name or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Segment Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {segments.map(seg => (
                    <button
                        key={seg}
                        onClick={() => setSegmentFilter(seg)}
                        style={{
                            padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600,
                            border: `1px solid ${segmentFilter === seg ? '#ea580c' : 'var(--border-subtle)'}`,
                            borderRadius: 8, cursor: 'pointer',
                            background: segmentFilter === seg ? 'rgba(234,88,12,0.1)' : 'var(--bg-card)',
                            color: segmentFilter === seg ? '#ea580c' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {seg === 'VIP' ? '👑 ' : seg === 'Regular' ? '⭐ ' : seg === 'At-Risk' ? '⚠️ ' : seg === 'New' ? '🆕 ' : ''}{seg} ({segmentCounts[seg]})
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {customers.length === 0 && (
                <div className="empty-state">
                    <Users size={48} />
                    <h3>No Customers Yet</h3>
                    <p>Add your first customer to start managing credit</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                        <Plus size={16} /> Add Customer
                    </button>
                </div>
            )}

            {/* Customer List */}
            <div className="customers-grid">
                {filteredCustomers.map(customer => (
                    <div key={customer.id} className={`customer-card ${(customer.credit || 0) > 0 ? 'has-credit' : ''}`}>
                        <div className="customer-header">
                            <div className="customer-avatar">
                                {customer.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="customer-info">
                                <h3>{customer.name}
                                    <span style={{
                                        display: 'inline-block', marginLeft: 8,
                                        fontSize: '0.65rem', padding: '2px 8px',
                                        borderRadius: 4, fontWeight: 700,
                                        background: `${getSegment(customer).color}20`,
                                        color: getSegment(customer).color
                                    }}>
                                        {getSegment(customer).emoji} {getSegment(customer).label}
                                    </span>
                                </h3>
                                <span className="phone"><Phone size={12} /> {customer.phone}</span>
                            </div>
                            {(customer.credit || 0) > 0 && (
                                <span className="credit-badge">₹{customer.credit} Due</span>
                            )}
                        </div>

                        <div className="customer-stats">
                            <div className="customer-stat">
                                <span className="label">Total Purchases</span>
                                <span className="value">₹{(customer.total_purchases || 0).toLocaleString()}</span>
                            </div>
                            <div className="customer-stat">
                                <span className="label">Loyalty Points</span>
                                <span className="value loyalty-points">⭐ {(customer.loyalty_points || customer.loyaltyPoints || 0).toLocaleString()}</span>
                            </div>
                            <div className="customer-stat">
                                <span className="label">Last Purchase</span>
                                <span className="value">
                                    {customer.last_purchase
                                        ? new Date(customer.last_purchase).toLocaleDateString('en-IN')
                                        : 'Never'}
                                </span>
                            </div>
                        </div>

                        {/* Loyalty Points Redemption */}
                        {(customer.loyalty_points || customer.loyaltyPoints || 0) >= 10000 && (
                            <div className="loyalty-section">
                                <span>🎉 Eligible for ₹{Math.floor((customer.loyalty_points || 0) / 10000) * 100} discount!</span>
                                <button className="btn btn-sm btn-success" onClick={() => handleRedeemPoints(customer)}>
                                    Redeem Points
                                </button>
                            </div>
                        )}

                        {(customer.credit || 0) > 0 && (
                            <div className="credit-section">
                                <div className="credit-amount">
                                    <span>Pending Amount</span>
                                    <span className="amount">₹{customer.credit}</span>
                                </div>
                                <div className="credit-actions">
                                    <button className="btn btn-sm btn-secondary" onClick={() => setSelectedCustomer(customer)}>
                                        <Check size={14} /> Record Payment
                                    </button>
                                    <button className="btn btn-sm btn-ghost" onClick={() => sendReminder(customer)}>
                                        <Send size={14} /> Remind
                                    </button>
                                </div>
                            </div>
                        )}

                        {(customer.credit || 0) === 0 && (
                            <div className="no-credit">
                                <Check size={16} />
                                <span>All dues cleared</span>
                            </div>
                        )}

                        <div className="customer-card-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEditCustomer(customer)}>
                                <Edit2 size={14} /> Edit
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteCustomer(customer.id)}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Customer</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input type="text" className="form-input" placeholder="Full Name"
                                        value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number *</label>
                                    <input type="tel" inputMode="numeric" className="form-input" placeholder="10-digit mobile (e.g. 9876543210)"
                                        maxLength={10} pattern="[6-9][0-9]{9}"
                                        value={newCustomer.phone} onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                                            setNewCustomer({ ...newCustomer, phone: cleaned })
                                        }} />
                                    {newCustomer.phone.length > 0 && newCustomer.phone.length < 10 && (
                                        <small style={{ color: '#f59e0b' }}>{10 - newCustomer.phone.length} digits remaining</small>
                                    )}
                                    {newCustomer.phone.length === 10 && !/^[6-9]/.test(newCustomer.phone) && (
                                        <small style={{ color: '#ef4444' }}>Must start with 6, 7, 8, or 9</small>
                                    )}
                                    {newCustomer.phone.length === 10 && /^[6-9]/.test(newCustomer.phone) && (
                                        <small style={{ color: '#22c55e' }}>✓ Valid phone number</small>
                                    )}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Email (Optional)</label>
                                    <input type="email" className="form-input" placeholder="email@example.com"
                                        value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Initial Credit (₹)</label>
                                    <input type="number" className="form-input" placeholder="0"
                                        value={newCustomer.initialCredit} onChange={(e) => setNewCustomer({ ...newCustomer, initialCredit: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address (Optional)</label>
                                <textarea className="form-input" placeholder="Customer address" rows="2"
                                    value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddCustomer}>Add Customer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {selectedCustomer && (
                <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Record Payment</h3>
                            <button className="modal-close" onClick={() => setSelectedCustomer(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="payment-customer">
                                <div className="customer-avatar large">
                                    {selectedCustomer.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div>
                                    <h4>{selectedCustomer.name}</h4>
                                    <p className="pending">Pending: ₹{selectedCustomer.credit}</p>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment Amount (₹)</label>
                                <input
                                    type="number"
                                    className="form-input payment-input"
                                    placeholder="Enter amount"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    max={selectedCustomer.credit}
                                />
                            </div>
                            <div className="quick-amounts">
                                <button onClick={() => setPaymentAmount(selectedCustomer.credit.toString())}>Full: ₹{selectedCustomer.credit}</button>
                                <button onClick={() => setPaymentAmount(Math.round(selectedCustomer.credit / 2).toString())}>Half: ₹{Math.round(selectedCustomer.credit / 2)}</button>
                                <button onClick={() => setPaymentAmount('500')}>₹500</button>
                                <button onClick={() => setPaymentAmount('1000')}>₹1000</button>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>Cancel</button>
                            <button className="btn btn-success" onClick={() => handlePayment(selectedCustomer.id)} disabled={!paymentAmount}>
                                <Check size={18} /> Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Customer Modal */}
            {showEditModal && editCustomer && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Customer</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input type="text" className="form-input" placeholder="Full Name"
                                        value={editCustomer.name} onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number *</label>
                                    <input type="tel" inputMode="numeric" className="form-input" placeholder="10-digit mobile"
                                        maxLength={10} pattern="[6-9][0-9]{9}"
                                        value={editCustomer.phone} onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                                            setEditCustomer({ ...editCustomer, phone: cleaned })
                                        }} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input type="email" className="form-input" placeholder="email@example.com"
                                        value={editCustomer.email || ''} onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Current Credit (₹)</label>
                                    <input type="number" className="form-input" placeholder="0"
                                        value={editCustomer.credit || 0} onChange={(e) => setEditCustomer({ ...editCustomer, credit: parseFloat(e.target.value) || 0 })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <textarea className="form-input" placeholder="Customer address" rows="2"
                                    value={editCustomer.address || ''} onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleUpdateCustomer}>Update Customer</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; gap: 16px; }
        .loading-container .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
        .empty-state svg { color: var(--text-tertiary); margin-bottom: 16px; }
        .empty-state h3 { margin-bottom: 8px; }
        .empty-state p { color: var(--text-tertiary); margin-bottom: 20px; }

        .credit-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
        @media (max-width: 768px) { .credit-stats { grid-template-columns: 1fr; } }
        .stat-card { 
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }
        .stat-card svg { color: var(--primary-400); }
        .stat-card.warning svg { color: var(--warning); }
        .stat-value { font-size: 1.5rem; font-weight: 700; display: block; }
        .stat-label { font-size: 0.8125rem; color: var(--text-tertiary); }

        .search-bar { margin-bottom: 20px; }

        .customers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }

        .customer-card {
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl); padding: 20px;
          transition: all var(--transition-fast);
        }
        .customer-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .customer-card.has-credit { border-left: 3px solid var(--warning); }

        .customer-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .customer-avatar {
          width: 48px; height: 48px;
          background: var(--gradient-primary);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 1rem;
        }
        .customer-avatar.large { width: 64px; height: 64px; font-size: 1.25rem; }
        .customer-info h3 { font-size: 1rem; margin-bottom: 4px; }
        .customer-info .phone { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--text-tertiary); }
        .credit-badge { 
          margin-left: auto; padding: 6px 12px;
          background: rgba(245, 158, 11, 0.15); color: var(--warning);
          border-radius: var(--radius-md); font-size: 0.8125rem; font-weight: 600;
        }

        .customer-stats { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md); }
        .customer-stat .label { display: block; font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 2px; }
        .customer-stat .value { font-weight: 600; }

        .credit-section { padding-top: 16px; border-top: 1px solid var(--border-subtle); }
        .credit-amount { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .credit-amount .amount { font-size: 1.25rem; font-weight: 700; color: var(--warning); }
        .credit-actions { display: flex; gap: 8px; }

        .no-credit { display: flex; align-items: center; gap: 8px; color: var(--success); font-size: 0.875rem; padding-top: 12px; }

        .payment-customer { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .payment-customer h4 { margin-bottom: 4px; }
        .payment-customer .pending { color: var(--warning); font-weight: 600; }
        .payment-input { font-size: 1.5rem; text-align: center; font-weight: 700; }
        .quick-amounts { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .quick-amounts button {
          padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md); cursor: pointer; font-size: 0.8125rem;
          transition: all var(--transition-fast); color: var(--text-secondary);
        }
        .quick-amounts button:hover { border-color: var(--primary-400); color: var(--primary-400); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }

        .customer-card-actions { 
          display: flex; gap: 8px; margin-top: 16px; padding-top: 12px; 
          border-top: 1px solid var(--border-subtle); 
        }
        .text-danger { color: var(--error) !important; }
        .text-danger:hover { background: rgba(239, 68, 68, 0.1); }
      `}</style>
        </div>
    )
}
