import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, X, ChevronRight, Sparkles, Clock, TrendingUp, Users, Package, DollarSign, Target, Zap } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function AICopilot({ currentPage, addToast }) {
    const [suggestions, setSuggestions] = useState([])
    const [isMinimized, setIsMinimized] = useState(true) // Start minimized for better UX
    const [dismissed, setDismissed] = useState([])
    const [loading, setLoading] = useState(true)

    const generateContextualSuggestions = useCallback(async () => {
        setLoading(true)
        try {
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const now = new Date()
            const hour = now.getHours()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

            const todayBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= today)
            const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0)

            const contextSuggestions = []

            // Page-specific suggestions
            switch (currentPage) {
                case 'dashboard':
                    // Morning greeting
                    if (hour >= 6 && hour < 12) {
                        contextSuggestions.push({
                            id: 'morning',
                            icon: Clock,
                            title: 'Good Morning! ☀️',
                            description: 'Check low stock alerts before the day begins.',
                            action: 'View Stock',
                            actionPage: 'products',
                            color: '#f59e0b'
                        })
                    }

                    // Evening summary
                    if (hour >= 18 && hour <= 22) {
                        contextSuggestions.push({
                            id: 'evening',
                            icon: TrendingUp,
                            title: 'Daily Summary',
                            description: `Today's sales: ₹${todaySales.toLocaleString()} from ${todayBills.length} bills.`,
                            action: 'View Analytics',
                            actionPage: 'analytics',
                            color: '#22c55e'
                        })
                    }

                    // Low stock warning
                    const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5))
                    if (lowStock.length > 0) {
                        contextSuggestions.push({
                            id: 'lowstock',
                            icon: Package,
                            title: `${lowStock.length} items low on stock`,
                            description: `${lowStock.slice(0, 2).map(p => p.name).join(', ')}...`,
                            action: 'Restock',
                            actionPage: 'products',
                            color: '#ef4444'
                        })
                    }
                    break

                case 'create-bill':
                    // Suggest popular products
                    const topProducts = products.slice(0, 3)
                    if (topProducts.length > 0) {
                        contextSuggestions.push({
                            id: 'popular',
                            icon: Zap,
                            title: 'Quick Add',
                            description: `Popular: ${topProducts.map(p => p.name).join(', ')}`,
                            color: '#7c3aed'
                        })
                    }

                    // Suggest customer
                    if (customers.length > 0) {
                        contextSuggestions.push({
                            id: 'customer',
                            icon: Users,
                            title: 'Add Customer',
                            description: 'Link bill to a customer for loyalty points.',
                            color: '#3b82f6'
                        })
                    }
                    break

                case 'products':
                    // Pricing suggestions
                    const lowMargin = products.filter(p => {
                        const cost = p.cost_price || p.costPrice || p.price * 0.7
                        const margin = ((p.price - cost) / p.price) * 100
                        return margin < 15
                    })
                    if (lowMargin.length > 0) {
                        contextSuggestions.push({
                            id: 'margin',
                            icon: DollarSign,
                            title: 'Low Margin Alert',
                            description: `${lowMargin.length} products have margins below 15%.`,
                            action: 'Review Pricing',
                            color: '#f59e0b'
                        })
                    }
                    break

                case 'customers':
                    // Inactive customers
                    const inactive = customers.filter(c => (c.visit_count || c.visits || 0) <= 1)
                    if (inactive.length > 0) {
                        contextSuggestions.push({
                            id: 'inactive',
                            icon: Users,
                            title: 'Engage Inactive Customers',
                            description: `${inactive.length} customers have only visited once.`,
                            action: 'Send Offer',
                            color: '#ec4899'
                        })
                    }

                    // VIP customers
                    const vips = customers.filter(c => (c.loyalty_points || 0) >= 5000)
                    if (vips.length > 0) {
                        contextSuggestions.push({
                            id: 'vip',
                            icon: Target,
                            title: 'VIP Customers',
                            description: `${vips.length} customers have 5000+ loyalty points.`,
                            color: '#7c3aed'
                        })
                    }
                    break

                case 'analytics':
                    contextSuggestions.push({
                        id: 'export',
                        icon: TrendingUp,
                        title: 'Export Report',
                        description: 'Download your analytics as PDF for record keeping.',
                        action: 'Export',
                        color: '#3b82f6'
                    })
                    break

                default:
                    break
            }

            // Global suggestions (always available)
            if (bills.length < 5) {
                contextSuggestions.push({
                    id: 'gettingstarted',
                    icon: Sparkles,
                    title: "You're just getting started!",
                    description: 'Create more bills to unlock AI predictions.',
                    action: 'Create Bill',
                    actionPage: 'create-bill',
                    color: '#7c3aed'
                })
            }

            // Filter out dismissed suggestions
            const activeSuggestions = contextSuggestions.filter(s => !dismissed.includes(s.id))
            setSuggestions(activeSuggestions)
        } catch (error) {
            console.error('Copilot error:', error)
        } finally {
            setLoading(false)
        }
    }, [currentPage, dismissed])

    useEffect(() => {
        generateContextualSuggestions()
    }, [generateContextualSuggestions])

    const dismissSuggestion = (id) => {
        setDismissed(prev => [...prev, id])
    }

    if (suggestions.length === 0 || loading) return null

    return (
        <>
            <style>{copilotStyles}</style>

            {isMinimized ? (
                <button
                    className="copilot-minimized"
                    onClick={() => setIsMinimized(false)}
                >
                    <Lightbulb size={18} />
                    <span className="suggestion-count">{suggestions.length}</span>
                </button>
            ) : (
                <div className="copilot-panel">
                    <div className="copilot-header">
                        <div className="copilot-title">
                            <Lightbulb size={16} style={{ color: '#f59e0b' }} />
                            <span>AI Copilot</span>
                        </div>
                        <button className="minimize-btn" onClick={() => setIsMinimized(true)}>
                            _
                        </button>
                    </div>

                    <div className="suggestions-list">
                        {suggestions.slice(0, 3).map(suggestion => {
                            const Icon = suggestion.icon

                            return (
                                <div key={suggestion.id} className="suggestion-item">
                                    <div
                                        className="suggestion-icon"
                                        style={{ backgroundColor: `${suggestion.color}20`, color: suggestion.color }}
                                    >
                                        <Icon size={14} />
                                    </div>
                                    <div className="suggestion-content">
                                        <h6>{suggestion.title}</h6>
                                        <p>{suggestion.description}</p>
                                        {suggestion.action && (
                                            <button className="suggestion-action">
                                                {suggestion.action}
                                                <ChevronRight size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        className="dismiss-btn"
                                        onClick={() => dismissSuggestion(suggestion.id)}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </>
    )
}

const copilotStyles = `
    .copilot-panel {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 300px;
        max-height: 450px;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 16px;
        box-shadow: var(--shadow-xl);
        z-index: 1000;
        overflow: hidden;
    }

    .copilot-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02));
        border-bottom: 1px solid var(--border-subtle);
    }

    .copilot-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 0.875rem;
    }

    .minimize-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        font-weight: bold;
    }

    .suggestions-list {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .suggestion-item {
        display: flex;
        gap: 10px;
        padding: 10px;
        background: var(--bg-secondary);
        border-radius: 10px;
        position: relative;
    }

    .suggestion-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        flex-shrink: 0;
    }

    .suggestion-content {
        flex: 1;
        min-width: 0;
    }

    .suggestion-content h6 {
        margin: 0 0 2px;
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .suggestion-content p {
        margin: 0;
        font-size: 0.6875rem;
        color: var(--text-tertiary);
        line-height: 1.4;
    }

    .suggestion-action {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
        padding: 4px 8px;
        background: transparent;
        border: 1px solid currentColor;
        border-radius: 6px;
        font-size: 0.625rem;
        font-weight: 600;
        color: var(--primary-500);
        cursor: pointer;
    }

    .dismiss-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: var(--text-tertiary);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .suggestion-item:hover .dismiss-btn {
        opacity: 1;
    }

    .dismiss-btn:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    /* Minimized state */
    .copilot-minimized {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f59e0b, #eab308);
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
        z-index: 1000;
    }

    .suggestion-count {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ef4444;
        border-radius: 100px;
        font-size: 0.625rem;
        font-weight: 700;
    }

    @media (max-width: 768px) {
        .copilot-panel {
            top: auto;
            bottom: 200px;
            right: 10px;
            left: 10px;
            width: auto;
        }

        .copilot-minimized {
            top: auto;
            bottom: 200px;
            right: 16px;
        }
    }
`
