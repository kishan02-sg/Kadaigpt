import { useState, useEffect } from 'react'
import {
    Wallet, Plus, TrendingUp, TrendingDown, Calendar,
    Filter, Download, PieChart, Receipt, Trash2, Edit2,
    DollarSign, ShoppingBag, Truck, Zap, Users, Building
} from 'lucide-react'

const expenseCategories = [
    { id: 'rent', name: 'Rent', icon: Building, color: '#8B5CF6' },
    { id: 'salary', name: 'Salaries', icon: Users, color: '#3B82F6' },
    { id: 'utilities', name: 'Utilities', icon: Zap, color: '#F59E0B' },
    { id: 'inventory', name: 'Inventory', icon: ShoppingBag, color: '#10B981' },
    { id: 'transport', name: 'Transport', icon: Truck, color: '#EF4444' },
    { id: 'other', name: 'Other', icon: Receipt, color: '#6B7280' },
]

// Demo expenses data
const demoExpenses = [
    { id: 1, category: 'rent', description: 'Shop Rent - January', amount: 15000, date: '2026-01-01', recurring: true },
    { id: 2, category: 'salary', description: 'Staff Salary - Rajan', amount: 12000, date: '2026-01-05', recurring: true },
    { id: 3, category: 'utilities', description: 'Electricity Bill', amount: 2500, date: '2026-01-10', recurring: false },
    { id: 4, category: 'inventory', description: 'Rice Stock Purchase', amount: 45000, date: '2026-01-12', recurring: false },
    { id: 5, category: 'transport', description: 'Delivery Vehicle Fuel', amount: 3000, date: '2026-01-15', recurring: false },
    { id: 6, category: 'utilities', description: 'Water Bill', amount: 800, date: '2026-01-18', recurring: false },
    { id: 7, category: 'salary', description: 'Staff Salary - Kumar', amount: 10000, date: '2026-01-20', recurring: true },
    { id: 8, category: 'other', description: 'Packaging Materials', amount: 1500, date: '2026-01-22', recurring: false },
]

export default function ExpenseTracker({ addToast }) {
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [filter, setFilter] = useState('all')
    const [dateRange, setDateRange] = useState('month')
    const [newExpense, setNewExpense] = useState({
        category: 'other',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        recurring: false
    })

    useEffect(() => {
        loadExpenses()
    }, [])

    const loadExpenses = () => {
        setLoading(true)

        // Always load from localStorage - no more demo mode
        const savedExpenses = localStorage.getItem('kadai_expenses')
        if (savedExpenses) {
            try {
                const parsed = JSON.parse(savedExpenses)
                setExpenses(Array.isArray(parsed) ? parsed : [])
            } catch {
                setExpenses([])
            }
        } else {
            // No expenses yet - show empty state
            setExpenses([])
        }
        setLoading(false)
    }

    // Save expenses to localStorage for persistence
    useEffect(() => {
        if (expenses.length > 0) {
            localStorage.setItem('kadai_expenses', JSON.stringify(expenses))
        }
    }, [expenses])

    const filteredExpenses = expenses.filter(e =>
        filter === 'all' || e.category === filter
    )

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)

    const categoryTotals = expenseCategories.map(cat => ({
        ...cat,
        total: expenses.filter(e => e.category === cat.id).reduce((sum, e) => sum + e.amount, 0)
    }))

    const handleAddExpense = () => {
        if (!newExpense.description || !newExpense.amount) {
            addToast('Please fill all fields', 'error')
            return
        }

        const expense = {
            id: Date.now(),
            ...newExpense,
            amount: parseFloat(newExpense.amount)
        }

        setExpenses([expense, ...expenses])
        setShowAddModal(false)
        setNewExpense({
            category: 'other',
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            recurring: false
        })
        addToast('Expense added successfully!', 'success')
    }

    const handleDelete = (id) => {
        setExpenses(expenses.filter(e => e.id !== id))
        addToast('Expense deleted', 'info')
    }

    const getCategoryInfo = (catId) => {
        return expenseCategories.find(c => c.id === catId) || expenseCategories[5]
    }

    return (
        <div className="expense-tracker-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Wallet size={28} /> Expense Tracker
                    </h1>
                    <p className="page-subtitle">
                        செலவுகளை கண்காணிக்கவும் • Track All Store Expenses
                    </p>
                </div>
                <div className="header-actions">
                    <select
                        className="form-select"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Add Expense
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="expense-summary">
                <div className="summary-card total">
                    <div className="summary-icon">
                        <Wallet size={24} />
                    </div>
                    <div className="summary-info">
                        <span className="label">Total Expenses</span>
                        <span className="value">₹{totalExpenses.toLocaleString()}</span>
                    </div>
                    <div className="summary-trend negative">
                        <TrendingUp size={16} />
                        <span>+12% vs last month</span>
                    </div>
                </div>

                {categoryTotals.slice(0, 3).map(cat => (
                    <div key={cat.id} className="summary-card">
                        <div className="summary-icon" style={{ background: `${cat.color}20`, color: cat.color }}>
                            <cat.icon size={24} />
                        </div>
                        <div className="summary-info">
                            <span className="label">{cat.name}</span>
                            <span className="value">₹{cat.total.toLocaleString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="expense-content">
                {/* Category Breakdown */}
                <div className="card category-breakdown">
                    <div className="card-header">
                        <h3><PieChart size={20} /> Category Breakdown</h3>
                    </div>
                    <div className="category-list">
                        {categoryTotals.map(cat => (
                            <div key={cat.id} className="category-item">
                                <div className="category-info">
                                    <div className="category-icon" style={{ background: `${cat.color}20`, color: cat.color }}>
                                        <cat.icon size={16} />
                                    </div>
                                    <span>{cat.name}</span>
                                </div>
                                <div className="category-bar">
                                    <div
                                        className="bar-fill"
                                        style={{
                                            width: `${(cat.total / totalExpenses) * 100}%`,
                                            background: cat.color
                                        }}
                                    />
                                </div>
                                <span className="category-amount">₹{cat.total.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Expense List */}
                <div className="card expense-list-card">
                    <div className="card-header">
                        <h3><Receipt size={20} /> Recent Expenses</h3>
                        <div className="filter-tabs">
                            <button
                                className={filter === 'all' ? 'active' : ''}
                                onClick={() => setFilter('all')}
                            >
                                All
                            </button>
                            {expenseCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={filter === cat.id ? 'active' : ''}
                                    onClick={() => setFilter(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="expense-list">
                        {filteredExpenses.map(expense => {
                            const cat = getCategoryInfo(expense.category)
                            return (
                                <div key={expense.id} className="expense-item">
                                    <div className="expense-icon" style={{ background: `${cat.color}20`, color: cat.color }}>
                                        <cat.icon size={18} />
                                    </div>
                                    <div className="expense-details">
                                        <strong>{expense.description}</strong>
                                        <span>{expense.date} {expense.recurring && '🔄 Recurring'}</span>
                                    </div>
                                    <div className="expense-amount">
                                        ₹{expense.amount.toLocaleString()}
                                    </div>
                                    <div className="expense-actions">
                                        <button className="btn-icon" onClick={() => handleDelete(expense.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Expense</h3>
                            <button className="btn-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Category</label>
                                <div className="category-select">
                                    {expenseCategories.map(cat => (
                                        <button
                                            key={cat.id}
                                            className={`cat-btn ${newExpense.category === cat.id ? 'active' : ''}`}
                                            style={{ '--cat-color': cat.color }}
                                            onClick={() => setNewExpense({ ...newExpense, category: cat.id })}
                                        >
                                            <cat.icon size={16} />
                                            <span>{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="What was this expense for?"
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={newExpense.date}
                                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={newExpense.recurring}
                                        onChange={(e) => setNewExpense({ ...newExpense, recurring: e.target.checked })}
                                    />
                                    <span>This is a recurring expense</span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleAddExpense}>
                                <Plus size={18} /> Add Expense
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .expense-tracker-page { padding: 0; }
                
                .expense-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 24px;
                }
                @media (max-width: 1200px) {
                    .expense-summary { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 600px) {
                    .expense-summary { grid-template-columns: 1fr; }
                }

                .summary-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .summary-card.total {
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-400));
                    border: none;
                    color: white;
                }
                .summary-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.2);
                }
                .summary-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .summary-info .label {
                    font-size: 0.875rem;
                    opacity: 0.8;
                }
                .summary-info .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                .summary-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                    opacity: 0.9;
                }

                .expense-content {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 24px;
                }
                @media (max-width: 1024px) {
                    .expense-content { grid-template-columns: 1fr; }
                }

                .category-breakdown { height: fit-content; }
                .category-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .category-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .category-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 100px;
                }
                .category-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .category-bar {
                    flex: 1;
                    height: 8px;
                    background: var(--bg-tertiary);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.5s ease;
                }
                .category-amount {
                    font-weight: 600;
                    min-width: 80px;
                    text-align: right;
                }

                .filter-tabs {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .filter-tabs button {
                    padding: 6px 12px;
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .filter-tabs button:hover {
                    background: var(--bg-secondary);
                }
                .filter-tabs button.active {
                    background: var(--primary-500);
                    color: white;
                }

                .expense-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-height: 500px;
                    overflow-y: auto;
                }
                .expense-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                }
                .expense-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .expense-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .expense-details span {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                }
                .expense-amount {
                    font-weight: 600;
                    font-size: 1.125rem;
                }
                .expense-actions {
                    display: flex;
                    gap: 8px;
                }
                .btn-icon {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: none;
                    color: var(--text-tertiary);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .btn-icon:hover {
                    background: var(--error);
                    color: white;
                }

                .category-select {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }
                .cat-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    padding: 12px;
                    border: 2px solid var(--border-subtle);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    color: var(--text-secondary);
                }
                .cat-btn:hover {
                    border-color: var(--cat-color);
                }
                .cat-btn.active {
                    border-color: var(--cat-color);
                    background: color-mix(in srgb, var(--cat-color) 10%, transparent);
                    color: var(--cat-color);
                }
                .cat-btn span {
                    font-size: 0.75rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .checkbox-label input {
                    width: 18px;
                    height: 18px;
                }
            `}</style>
        </div>
    )
}
