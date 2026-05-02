import { useState, useEffect } from 'react'
import { MessageCircle, Send, Users, Clock, CheckCheck, FileText, Plus, Phone, AlertCircle, Sparkles, Check, X, Loader2 } from 'lucide-react'
import whatsappService from '../services/whatsapp'
import api from '../services/api'
import { demoCustomers } from '../services/demoData'

export default function WhatsAppIntegration({ addToast }) {
    const [customers, setCustomers] = useState([])
    const [selectedCustomers, setSelectedCustomers] = useState([])
    const [message, setMessage] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [quickPhone, setQuickPhone] = useState('')
    const [quickMessage, setQuickMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [loading, setLoading] = useState(true)

    const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'

    // Load customers
    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        const isDemoMode = localStorage.getItem('kadai_demo_mode') === 'true'
        try {
            if (isDemoMode) {
                setCustomers(demoCustomers)
            } else {
                const data = await api.getCustomers()
                setCustomers(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error('Error loading customers:', error)
            setCustomers([])
        } finally {
            setLoading(false)
        }
    }

    const templates = whatsappService.getTemplates()
    const customersWithDue = customers.filter(c => (c.credit || 0) > 0)

    // Stats
    const stats = {
        total: customers.length,
        withDues: customersWithDue.length,
        totalDues: customersWithDue.reduce((sum, c) => sum + (c.credit || 0), 0),
        messagesSent: 0
    }

    const handleTemplateSelect = (template) => {
        setSelectedTemplate(template)
        setMessage(template.template)
    }

    const handleQuickSend = () => {
        if (!quickPhone || !quickMessage) {
            addToast('Please enter phone and message', 'error')
            return
        }

        whatsappService.openWhatsApp(quickPhone, quickMessage)
        addToast('Opening WhatsApp...', 'success')
        setQuickPhone('')
        setQuickMessage('')
    }

    const handleSendToSelected = () => {
        if (selectedCustomers.length === 0) {
            addToast('Please select customers', 'error')
            return
        }
        if (!message) {
            addToast('Please enter a message', 'error')
            return
        }

        // Send to first selected customer (WhatsApp opens one at a time)
        const customer = selectedCustomers[0]
        const parsedMessage = whatsappService.parseTemplate(message, {
            name: customer.name,
            amount: customer.credit,
            store: storeName,
            date: new Date().toLocaleDateString('en-IN')
        })

        whatsappService.openWhatsApp(customer.phone, parsedMessage)
        addToast(`Message sent to ${customer.name}`, 'success')

        // Remove from selection
        setSelectedCustomers(prev => prev.filter(c => c.id !== customer.id))
    }

    const handleBulkReminders = async () => {
        if (customersWithDue.length === 0) {
            addToast('No customers with pending dues', 'info')
            return
        }

        setSending(true)
        setProgress({ current: 0, total: customersWithDue.length })

        // For demo, we'll open one by one with delay
        for (let i = 0; i < Math.min(customersWithDue.length, 3); i++) {
            const customer = customersWithDue[i]
            await new Promise(resolve => setTimeout(resolve, 1500))

            whatsappService.sendPaymentReminder(customer, storeName)
            setProgress(prev => ({ ...prev, current: i + 1 }))
        }

        setSending(false)
        addToast(`Reminders sent to ${Math.min(customersWithDue.length, 3)} customers!`, 'success')
    }

    const toggleCustomerSelection = (customer) => {
        setSelectedCustomers(prev => {
            const exists = prev.find(c => c.id === customer.id)
            if (exists) {
                return prev.filter(c => c.id !== customer.id)
            }
            return [...prev, customer]
        })
    }

    const selectAllWithDues = () => {
        setSelectedCustomers(customersWithDue)
    }

    const clearSelection = () => {
        setSelectedCustomers([])
    }

    return (
        <div className="whatsapp-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">💬 WhatsApp Business</h1>
                    <p className="page-subtitle">Send reminders and communicate with customers</p>
                </div>
            </div>

            {/* Stats */}
            <div className="wa-stats">
                <div className="stat-card">
                    <Users size={24} />
                    <div>
                        <span className="value">{stats.total}</span>
                        <span className="label">Total Customers</span>
                    </div>
                </div>
                <div className="stat-card warning">
                    <AlertCircle size={24} />
                    <div>
                        <span className="value">{stats.withDues}</span>
                        <span className="label">With Pending Dues</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Clock size={24} />
                    <div>
                        <span className="value">₹{stats.totalDues.toLocaleString()}</span>
                        <span className="label">Total Outstanding</span>
                    </div>
                </div>
                <div className="stat-card highlight">
                    <CheckCheck size={24} />
                    <div>
                        <span className="value">{stats.messagesSent}</span>
                        <span className="label">Messages Sent</span>
                    </div>
                </div>
            </div>

            <div className="wa-grid">
                {/* Quick Send */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Send size={20} /> Quick Send</h3>
                    </div>
                    <div className="quick-send-form">
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <div className="phone-input">
                                <span className="prefix">+91</span>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="Enter 10-digit number"
                                    value={quickPhone}
                                    onChange={(e) => setQuickPhone(e.target.value)}
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea
                                className="form-input"
                                placeholder="Type your message..."
                                rows={3}
                                value={quickMessage}
                                onChange={(e) => setQuickMessage(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-success w-full" onClick={handleQuickSend}>
                            <MessageCircle size={18} /> Send via WhatsApp
                        </button>
                    </div>
                </div>

                {/* Templates */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><FileText size={20} /> Message Templates</h3>
                    </div>
                    <div className="templates-list">
                        {templates.map(template => (
                            <div
                                key={template.id}
                                className={`template-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                                onClick={() => handleTemplateSelect(template)}
                            >
                                <span className="template-icon">{template.icon}</span>
                                <span className="template-name">{template.name}</span>
                                {selectedTemplate?.id === template.id && <Check size={16} className="check" />}
                            </div>
                        ))}
                    </div>
                    {selectedTemplate && (
                        <div className="template-preview">
                            <h4>Preview:</h4>
                            <p>{selectedTemplate.template}</p>
                            <small>Variables: {'{name}'}, {'{amount}'}, {'{store}'}, etc.</small>
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            <div className="card bulk-section">
                <div className="card-header">
                    <h3 className="card-title"><Users size={20} /> Bulk Messaging</h3>
                    <div className="bulk-actions">
                        {selectedCustomers.length > 0 && (
                            <span className="selected-count">{selectedCustomers.length} selected</span>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={selectAllWithDues}>
                            Select All with Dues
                        </button>
                        {selectedCustomers.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="customers-grid">
                    {customers.map(customer => (
                        <div
                            key={customer.id}
                            className={`customer-chip ${selectedCustomers.find(c => c.id === customer.id) ? 'selected' : ''} ${customer.credit > 0 ? 'has-due' : ''}`}
                            onClick={() => toggleCustomerSelection(customer)}
                        >
                            <div className="customer-avatar">{customer.name.charAt(0)}</div>
                            <div className="customer-info">
                                <span className="name">{customer.name}</span>
                                <span className="phone">{customer.phone}</span>
                            </div>
                            {customer.credit > 0 && (
                                <span className="due-badge">₹{customer.credit}</span>
                            )}
                            {selectedCustomers.find(c => c.id === customer.id) && (
                                <div className="selected-indicator"><Check size={14} /></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Message Composer */}
                <div className="message-composer">
                    <textarea
                        className="form-input"
                        placeholder="Type your message or select a template above..."
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="composer-actions">
                        <button
                            className="btn btn-primary"
                            onClick={handleSendToSelected}
                            disabled={selectedCustomers.length === 0 || !message}
                        >
                            <Send size={18} /> Send to Selected ({selectedCustomers.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Payment Reminders Section */}
            <div className="card reminder-section">
                <div className="card-header">
                    <h3 className="card-title"><Clock size={20} /> Payment Reminders</h3>
                </div>
                <div className="reminder-content">
                    <div className="reminder-stats">
                        <div className="reminder-stat">
                            <span className="value">{customersWithDue.length}</span>
                            <span className="label">Customers with dues</span>
                        </div>
                        <div className="reminder-stat">
                            <span className="value">₹{stats.totalDues.toLocaleString()}</span>
                            <span className="label">Total outstanding</span>
                        </div>
                    </div>

                    <div className="reminder-list">
                        {customersWithDue.slice(0, 5).map(customer => (
                            <div key={customer.id} className="reminder-item">
                                <div className="customer-info">
                                    <span className="name">{customer.name}</span>
                                    <span className="phone">{customer.phone}</span>
                                </div>
                                <span className="amount">₹{customer.credit.toLocaleString()}</span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => whatsappService.sendPaymentReminder(customer, storeName)}
                                >
                                    <MessageCircle size={14} /> Remind
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        className="btn btn-warning w-full mt-lg"
                        onClick={handleBulkReminders}
                        disabled={sending || customersWithDue.length === 0}
                    >
                        {sending ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Sending ({progress.current}/{progress.total})...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} /> Send Reminders to All ({customersWithDue.length})
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* AI Suggestions */}
            <div className="ai-suggestions">
                <div className="ai-header">
                    <Sparkles size={20} />
                    <h4>AI Suggestions</h4>
                </div>
                <div className="suggestions-grid">
                    <div className="suggestion-card">
                        <span className="icon">🕐</span>
                        <p>Best time to send reminders is <strong>10 AM - 12 PM</strong> based on your customer response rates.</p>
                    </div>
                    <div className="suggestion-card">
                        <span className="icon">📅</span>
                        <p><strong>{customersWithDue.filter(c => c.credit > 1000).length} customers</strong> have dues above ₹1,000. Prioritize calling them.</p>
                    </div>
                    <div className="suggestion-card">
                        <span className="icon">🎉</span>
                        <p>Pongal is coming! Send festive greetings with <strong>special offers</strong> to increase sales.</p>
                    </div>
                </div>
            </div>

            <style>{`
        .wa-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        @media (max-width: 1024px) { .wa-stats { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
        }
        .stat-card svg { color: #25D366; }
        .stat-card.warning svg { color: var(--warning); }
        .stat-card.highlight { background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none; }
        .stat-card.highlight svg { color: white; }
        .stat-card .value { font-size: 1.5rem; font-weight: 700; display: block; }
        .stat-card .label { font-size: 0.8125rem; opacity: 0.8; }

        .wa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 1024px) { .wa-grid { grid-template-columns: 1fr; } }

        .quick-send-form { display: flex; flex-direction: column; gap: 16px; }
        .phone-input { display: flex; align-items: center; }
        .phone-input .prefix { padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-default); border-right: none; border-radius: var(--radius-md) 0 0 var(--radius-md); color: var(--text-secondary); }
        .phone-input .form-input { border-radius: 0 var(--radius-md) var(--radius-md) 0; }
        .btn-success { background: #25D366; border-color: #25D366; color: white; }
        .btn-success:hover { background: #128C7E; }
        .w-full { width: 100%; }

        .templates-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        @media (max-width: 600px) { .templates-list { grid-template-columns: 1fr; } }
        .template-item {
          display: flex; align-items: center; gap: 10px;
          padding: 12px; background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle); border-radius: var(--radius-lg);
          cursor: pointer; transition: all var(--transition-fast);
        }
        .template-item:hover { border-color: #25D366; }
        .template-item.selected { border-color: #25D366; background: rgba(37, 211, 102, 0.1); }
        .template-icon { font-size: 1.25rem; }
        .template-name { flex: 1; font-weight: 500; font-size: 0.875rem; }
        .template-item .check { color: #25D366; }
        .template-preview { margin-top: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .template-preview h4 { margin: 0 0 8px; font-size: 0.875rem; color: var(--text-secondary); }
        .template-preview p { margin: 0 0 8px; font-size: 0.875rem; }
        .template-preview small { color: var(--text-tertiary); }

        .bulk-section .bulk-actions { display: flex; align-items: center; gap: 12px; }
        .selected-count { padding: 4px 12px; background: #25D366; color: white; border-radius: var(--radius-sm); font-size: 0.8125rem; font-weight: 600; }

        .customers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .customer-chip {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle); border-radius: var(--radius-lg);
          cursor: pointer; transition: all var(--transition-fast);
          position: relative;
        }
        .customer-chip:hover { border-color: #25D366; }
        .customer-chip.selected { border-color: #25D366; background: rgba(37, 211, 102, 0.1); }
        .customer-chip.has-due { border-left: 3px solid var(--warning); }
        .customer-avatar { width: 36px; height: 36px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
        .customer-chip .name { font-weight: 500; display: block; font-size: 0.875rem; }
        .customer-chip .phone { font-size: 0.75rem; color: var(--text-tertiary); }
        .due-badge { margin-left: auto; padding: 4px 8px; background: rgba(245, 158, 11, 0.1); color: var(--warning); border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; }
        .selected-indicator { position: absolute; top: -4px; right: -4px; width: 20px; height: 20px; background: #25D366; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }

        .message-composer { padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .message-composer textarea { margin-bottom: 12px; }
        .composer-actions { display: flex; justify-content: flex-end; }

        .reminder-section { margin-top: 24px; }
        .reminder-content { }
        .reminder-stats { display: flex; gap: 48px; margin-bottom: 20px; padding: 20px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .reminder-stat .value { font-size: 1.75rem; font-weight: 800; display: block; color: var(--primary-400); }
        .reminder-stat .label { font-size: 0.875rem; color: var(--text-secondary); }
        .reminder-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .reminder-item { display: flex; align-items: center; gap: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-lg); }
        .reminder-item .customer-info { flex: 1; }
        .reminder-item .name { font-weight: 500; display: block; }
        .reminder-item .phone { font-size: 0.75rem; color: var(--text-tertiary); }
        .reminder-item .amount { font-weight: 700; color: var(--warning); }
        .mt-lg { margin-top: 16px; }
        .btn-warning { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; }

        .ai-suggestions { margin-top: 24px; padding: 20px; background: linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(18, 140, 126, 0.1)); border: 1px solid rgba(37, 211, 102, 0.3); border-radius: var(--radius-xl); }
        .ai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: #25D366; }
        .ai-header h4 { margin: 0; }
        .suggestions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1024px) { .suggestions-grid { grid-template-columns: 1fr; } }
        .suggestion-card { padding: 16px; background: var(--bg-card); border-radius: var(--radius-lg); }
        .suggestion-card .icon { font-size: 1.5rem; display: block; margin-bottom: 8px; }
        .suggestion-card p { margin: 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}
