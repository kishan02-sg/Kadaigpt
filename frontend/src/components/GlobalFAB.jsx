import { useState } from 'react'
import { Plus, X, FileText, Package, Users, Truck, DollarSign, BarChart3 } from 'lucide-react'

// Global Floating Action Button for quick actions across all pages
export default function GlobalFAB({ currentPage, setCurrentPage, addToast }) {
    const [isExpanded, setIsExpanded] = useState(false)

    const quickActions = [
        { id: 'create-bill', label: 'New Bill', icon: FileText, color: '#f97316' },
        { id: 'products', label: 'Add Product', icon: Package, color: '#22c55e' },
        { id: 'customers', label: 'Add Customer', icon: Users, color: '#3b82f6' },
        { id: 'suppliers', label: 'Add Supplier', icon: Truck, color: '#8b5cf6' },
        { id: 'expenses', label: 'Add Expense', icon: DollarSign, color: '#ef4444' },
        { id: 'analytics', label: 'View Reports', icon: BarChart3, color: '#06b6d4' },
    ]

    const handleAction = (actionId) => {
        setCurrentPage(actionId)
        setIsExpanded(false)
        addToast?.(`Navigating to ${actionId}...`, 'info')
    }

    return (
        <>
            {/* Backdrop */}
            {isExpanded && (
                <div
                    className="fab-backdrop"
                    onClick={() => setIsExpanded(false)}
                />
            )}

            {/* Quick Action Menu */}
            <div className={`fab-menu ${isExpanded ? 'expanded' : ''}`}>
                {quickActions.map((action, index) => (
                    <button
                        key={action.id}
                        className="fab-action"
                        style={{
                            '--action-color': action.color,
                            '--delay': `${index * 0.05}s`
                        }}
                        onClick={() => handleAction(action.id)}
                    >
                        <span className="fab-action-label">{action.label}</span>
                        <span className="fab-action-icon" style={{ background: action.color }}>
                            <action.icon size={18} />
                        </span>
                    </button>
                ))}
            </div>

            {/* Main FAB Button */}
            <button
                className={`global-fab ${isExpanded ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label="Quick actions"
            >
                {isExpanded ? <X size={24} /> : <Plus size={24} />}
            </button>

            <style>{`
                .fab-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 998;
                    animation: fadeIn 0.2s ease;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .global-fab {
                    position: fixed;
                    bottom: 90px;
                    left: 24px;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                    z-index: 999;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .global-fab:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 24px rgba(59, 130, 246, 0.5);
                }

                .global-fab.active {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
                    transform: rotate(45deg);
                }

                .fab-menu {
                    position: fixed;
                    bottom: 160px;
                    left: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    z-index: 999;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(20px);
                    transition: all 0.3s ease;
                }

                .fab-menu.expanded {
                    opacity: 1;
                    pointer-events: auto;
                    transform: translateY(0);
                }

                .fab-action {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    opacity: 0;
                    transform: translateX(-20px);
                    animation: slideIn 0.3s ease forwards;
                    animation-delay: var(--delay);
                }

                .fab-menu.expanded .fab-action {
                    opacity: 1;
                    transform: translateX(0);
                }

                @keyframes slideIn {
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .fab-action-label {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    padding: 8px 16px;
                    border-radius: var(--radius-lg);
                    font-size: 0.875rem;
                    font-weight: 500;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    white-space: nowrap;
                }

                .fab-action-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    transition: transform 0.2s ease;
                }

                .fab-action:hover .fab-action-icon {
                    transform: scale(1.1);
                }

                .fab-action:hover .fab-action-label {
                    background: var(--primary-500);
                    color: white;
                }

                /* Mobile adjustments */
                @media (max-width: 768px) {
                    .global-fab {
                        bottom: 140px;
                        left: 16px;
                        width: 52px;
                        height: 52px;
                    }
                    
                    .fab-menu {
                        bottom: 200px;
                        left: 16px;
                    }
                }
            `}</style>
        </>
    )
}
