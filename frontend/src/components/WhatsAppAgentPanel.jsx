/**
 * WhatsApp Agent Panel - Dashboard widget for WhatsApp AI Agent controls
 */

import { useState, useEffect } from 'react'
import { MessageSquare, Send, Bell, BellOff, Phone, AlertTriangle, FileText, TrendingUp, DollarSign, Receipt, Loader2, Check, Settings } from 'lucide-react'
import whatsappAgentService from '../services/whatsappAgent'

export default function WhatsAppAgentPanel({ addToast }) {
    const [ownerPhone, setOwnerPhone] = useState(localStorage.getItem('kadai_owner_phone') || '')
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        localStorage.getItem('kadai_wa_notifications') === 'true'
    )
    const [sending, setSending] = useState(null)
    const [showConfig, setShowConfig] = useState(!ownerPhone)

    const actions = [
        { id: 'lowstock', label: 'Low Stock Alert', icon: AlertTriangle, color: '#f59e0b', desc: 'Send low stock products list' },
        { id: 'daily', label: 'Daily Report', icon: FileText, color: '#3b82f6', desc: 'Send today\'s business summary' },
        { id: 'income', label: 'Income/Expense', icon: TrendingUp, color: '#22c55e', desc: 'Send profit/loss report' },
        { id: 'gst', label: 'GST Report', icon: Receipt, color: '#8b5cf6', desc: 'Send GST summary' },
    ]

    const handleSavePhone = () => {
        if (!ownerPhone || ownerPhone.length < 10) {
            addToast?.('Please enter a valid phone number', 'error')
            return
        }
        whatsappAgentService.setOwnerPhone(ownerPhone)
        setShowConfig(false)
        addToast?.('Phone number saved!', 'success')
    }

    const toggleNotifications = () => {
        const newState = !notificationsEnabled
        setNotificationsEnabled(newState)
        whatsappAgentService.enableAutoNotifications(newState)
        addToast?.(newState ? 'Auto notifications enabled' : 'Auto notifications disabled', 'info')
    }

    const handleAction = async (actionId) => {
        if (!ownerPhone) {
            setShowConfig(true)
            addToast?.('Please configure your phone number first', 'error')
            return
        }

        setSending(actionId)

        try {
            let result
            switch (actionId) {
                case 'lowstock':
                    result = await whatsappAgentService.checkAndSendLowStockAlert()
                    break
                case 'daily':
                    result = await whatsappAgentService.sendDailySummary()
                    break
                case 'income':
                    result = await whatsappAgentService.sendIncomeExpenseSummary()
                    break
                case 'gst':
                    result = await whatsappAgentService.sendGSTReport()
                    break
                default:
                    result = { success: false, error: 'Unknown action' }
            }

            if (result.success) {
                addToast?.('Opening WhatsApp...', 'success')
            } else {
                addToast?.(result.error || 'Failed to send', 'error')
            }
        } catch (error) {
            addToast?.('Failed to send message', 'error')
        } finally {
            setSending(null)
        }
    }

    return (
        <div className="wa-agent-panel">
            <div className="wa-panel-header">
                <div className="wa-title">
                    <MessageSquare size={20} className="wa-icon" />
                    <span>WhatsApp AI Agent</span>
                </div>
                <div className="wa-controls">
                    <button
                        className={`wa-toggle ${notificationsEnabled ? 'active' : ''}`}
                        onClick={toggleNotifications}
                        title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
                    >
                        {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>
                    <button
                        className="wa-config-btn"
                        onClick={() => setShowConfig(!showConfig)}
                        title="Configure phone"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {showConfig && (
                <div className="wa-config">
                    <div className="wa-config-input">
                        <Phone size={16} />
                        <input
                            type="tel"
                            placeholder="Enter your WhatsApp number"
                            value={ownerPhone}
                            onChange={(e) => setOwnerPhone(e.target.value)}
                            maxLength={15}
                        />
                        <button className="wa-save-btn" onClick={handleSavePhone}>
                            <Check size={16} />
                        </button>
                    </div>
                    <p className="wa-hint">This number will receive all alerts and reports</p>
                </div>
            )}

            <div className="wa-actions">
                {actions.map(action => (
                    <button
                        key={action.id}
                        className="wa-action-btn"
                        onClick={() => handleAction(action.id)}
                        disabled={sending !== null}
                        style={{ '--action-color': action.color }}
                    >
                        <span className="wa-action-icon">
                            {sending === action.id ? (
                                <Loader2 size={18} className="spin" />
                            ) : (
                                <action.icon size={18} />
                            )}
                        </span>
                        <span className="wa-action-text">
                            <span className="wa-action-label">{action.label}</span>
                            <span className="wa-action-desc">{action.desc}</span>
                        </span>
                        <Send size={14} className="wa-send-icon" />
                    </button>
                ))}
            </div>

            <style>{`
                .wa-agent-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: 20px;
                    margin-bottom: 20px;
                }

                .wa-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .wa-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    font-size: 1rem;
                }

                .wa-icon {
                    color: #25D366;
                }

                .wa-controls {
                    display: flex;
                    gap: 8px;
                }

                .wa-toggle, .wa-config-btn {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    padding: 8px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .wa-toggle:hover, .wa-config-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .wa-toggle.active {
                    background: rgba(37, 211, 102, 0.15);
                    color: #25D366;
                    border-color: #25D366;
                }

                .wa-config {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    padding: 16px;
                    margin-bottom: 16px;
                }

                .wa-config-input {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-default);
                    border-radius: var(--radius-md);
                    padding: 8px 12px;
                }

                .wa-config-input input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .wa-config-input input:focus {
                    outline: none;
                }

                .wa-save-btn {
                    background: #25D366;
                    border: none;
                    border-radius: var(--radius-sm);
                    padding: 6px;
                    cursor: pointer;
                    color: white;
                }

                .wa-hint {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    margin-top: 8px;
                }

                .wa-actions {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                @media (max-width: 600px) {
                    .wa-actions {
                        grid-template-columns: 1fr;
                    }
                }

                .wa-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    padding: 14px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                }

                .wa-action-btn:hover:not(:disabled) {
                    border-color: var(--action-color);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .wa-action-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .wa-action-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(var(--action-color), 0.15);
                    border-radius: var(--radius-md);
                    color: var(--action-color);
                    flex-shrink: 0;
                }

                .wa-action-text {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .wa-action-label {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: var(--text-primary);
                }

                .wa-action-desc {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                }

                .wa-send-icon {
                    color: var(--text-tertiary);
                    transition: color 0.2s;
                }

                .wa-action-btn:hover .wa-send-icon {
                    color: #25D366;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
