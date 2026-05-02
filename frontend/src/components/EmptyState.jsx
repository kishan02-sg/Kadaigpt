import { Plus, Package, Receipt, Users, TrendingUp, Gift, FileText, Wallet } from 'lucide-react'

const iconMap = {
    products: Package,
    bills: Receipt,
    customers: Users,
    suppliers: Package,
    analytics: TrendingUp,
    loyalty: Gift,
    expenses: Wallet,
    reports: FileText
}

export default function EmptyState({
    type = 'products',
    title,
    description,
    actionLabel,
    onAction,
    showAction = true
}) {
    const Icon = iconMap[type] || Package

    const defaults = {
        products: {
            title: 'No Products Yet',
            description: 'Start by adding your first product to manage inventory and track stock levels.',
            actionLabel: 'Add Your First Product'
        },
        bills: {
            title: 'No Bills Created',
            description: 'Create your first bill to start tracking sales and revenue.',
            actionLabel: 'Create First Bill'
        },
        customers: {
            title: 'No Customers Yet',
            description: 'Add customers to track their purchases, manage credit, and build loyalty.',
            actionLabel: 'Add Your First Customer'
        },
        suppliers: {
            title: 'No Suppliers Added',
            description: 'Add suppliers to manage purchase orders and track inventory.',
            actionLabel: 'Add Your First Supplier'
        },
        analytics: {
            title: 'No Data to Analyze',
            description: 'Start creating bills to see sales analytics and business insights.',
            actionLabel: 'Go to Bills'
        },
        loyalty: {
            title: 'Loyalty Program Ready',
            description: 'As customers make purchases, they\'ll earn loyalty points automatically.',
            actionLabel: 'Add Customers'
        },
        expenses: {
            title: 'No Expenses Recorded',
            description: 'Track your business expenses to understand profitability.',
            actionLabel: 'Add First Expense'
        },
        reports: {
            title: 'No Reports Available',
            description: 'Complete some transactions to generate reports.',
            actionLabel: 'Create Bill'
        }
    }

    const config = defaults[type] || defaults.products

    return (
        <div className="empty-state">
            <div className="empty-state-icon">
                <Icon size={64} />
            </div>
            <h3>{title || config.title}</h3>
            <p>{description || config.description}</p>
            {showAction && onAction && (
                <button className="btn btn-primary" onClick={onAction}>
                    <Plus size={18} />
                    {actionLabel || config.actionLabel}
                </button>
            )}

            <style>{`
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    text-align: center;
                    min-height: 400px;
                }
                .empty-state-icon {
                    width: 120px;
                    height: 120px;
                    background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                    color: white;
                    box-shadow: 0 8px 32px rgba(124, 58, 237, 0.3);
                }
                .empty-state h3 {
                    font-size: 1.5rem;
                    margin-bottom: 12px;
                    color: var(--text-primary);
                }
                .empty-state p {
                    color: var(--text-secondary);
                    max-width: 400px;
                    margin-bottom: 24px;
                    line-height: 1.6;
                }
                .empty-state .btn {
                    padding: 12px 24px;
                    font-size: 1rem;
                }
            `}</style>
        </div>
    )
}
