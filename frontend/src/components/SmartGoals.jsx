import { useState, useEffect } from 'react'
import { Target, TrendingUp, Trophy, Plus, X, Zap, CheckCircle2, Clock, AlertCircle, Sparkles, Calendar, Edit2 } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function SmartGoals({ addToast }) {
    const [goals, setGoals] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newGoal, setNewGoal] = useState({ type: 'revenue', target: '', period: 'weekly' })
    const [businessData, setBusinessData] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Load saved goals from localStorage
            const savedGoals = JSON.parse(localStorage.getItem('kadai_goals') || '[]')

            // Load business data to calculate progress
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const now = new Date()
            const weekStart = new Date(now)
            weekStart.setDate(now.getDate() - now.getDay())
            weekStart.setHours(0, 0, 0, 0)

            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

            const weeklyBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= weekStart)
            const monthlyBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= monthStart)

            const data = {
                weeklyRevenue: weeklyBills.reduce((sum, b) => sum + (b.total || 0), 0),
                monthlyRevenue: monthlyBills.reduce((sum, b) => sum + (b.total || 0), 0),
                weeklyBills: weeklyBills.length,
                monthlyBills: monthlyBills.length,
                totalCustomers: customers.length,
                totalProducts: products.length
            }
            setBusinessData(data)

            // Update goals with current progress
            const updatedGoals = savedGoals.map(goal => ({
                ...goal,
                current: calculateProgress(goal, data),
                percentage: Math.min(100, (calculateProgress(goal, data) / goal.target) * 100)
            }))

            setGoals(updatedGoals)

            // Generate AI suggestions if no goals
            if (savedGoals.length === 0) {
                const aiGoals = generateAIGoals(data)
                setGoals(aiGoals)
            }
        } catch (error) {
            console.error('Failed to load goals data:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateProgress = (goal, data) => {
        switch (goal.type) {
            case 'revenue':
                return goal.period === 'weekly' ? data.weeklyRevenue : data.monthlyRevenue
            case 'bills':
                return goal.period === 'weekly' ? data.weeklyBills : data.monthlyBills
            case 'customers':
                return data.totalCustomers
            default:
                return 0
        }
    }

    const generateAIGoals = (data) => {
        // AI-suggested goals based on current performance
        const suggestions = []

        // Revenue goal - 20% increase
        const weeklyTarget = Math.ceil((data.weeklyRevenue || 5000) * 1.2 / 1000) * 1000
        suggestions.push({
            id: 'ai_1',
            type: 'revenue',
            target: weeklyTarget,
            period: 'weekly',
            title: 'Weekly Revenue Goal',
            aiSuggested: true,
            current: data.weeklyRevenue,
            percentage: Math.min(100, (data.weeklyRevenue / weeklyTarget) * 100)
        })

        // Bills goal
        const billsTarget = Math.max(50, Math.ceil((data.weeklyBills || 30) * 1.15))
        suggestions.push({
            id: 'ai_2',
            type: 'bills',
            target: billsTarget,
            period: 'weekly',
            title: 'Weekly Transactions',
            aiSuggested: true,
            current: data.weeklyBills,
            percentage: Math.min(100, (data.weeklyBills / billsTarget) * 100)
        })

        // Customer goal
        const customerTarget = Math.max(20, data.totalCustomers + 10)
        suggestions.push({
            id: 'ai_3',
            type: 'customers',
            target: customerTarget,
            period: 'monthly',
            title: 'Total Customers',
            aiSuggested: true,
            current: data.totalCustomers,
            percentage: Math.min(100, (data.totalCustomers / customerTarget) * 100)
        })

        return suggestions
    }

    const handleAddGoal = () => {
        if (!newGoal.target || parseInt(newGoal.target) <= 0) {
            addToast('Please enter a valid target', 'error')
            return
        }

        const goal = {
            id: Date.now().toString(),
            type: newGoal.type,
            target: parseInt(newGoal.target),
            period: newGoal.period,
            title: getGoalTitle(newGoal.type, newGoal.period),
            aiSuggested: false,
            current: 0,
            percentage: 0
        }

        const updatedGoals = [...goals.filter(g => !g.aiSuggested || g.type !== newGoal.type), goal]
        setGoals(updatedGoals)
        saveGoals(updatedGoals)
        setShowAddModal(false)
        setNewGoal({ type: 'revenue', target: '', period: 'weekly' })
        addToast('Goal added successfully!', 'success')
    }

    const getGoalTitle = (type, period) => {
        const titles = {
            revenue: `${period === 'weekly' ? 'Weekly' : 'Monthly'} Revenue`,
            bills: `${period === 'weekly' ? 'Weekly' : 'Monthly'} Transactions`,
            customers: 'Customer Growth'
        }
        return titles[type] || 'Custom Goal'
    }

    const saveGoals = (goalsList) => {
        const toSave = goalsList.filter(g => !g.aiSuggested).map(g => ({
            id: g.id,
            type: g.type,
            target: g.target,
            period: g.period,
            title: g.title
        }))
        localStorage.setItem('kadai_goals', JSON.stringify(toSave))
    }

    const handleDeleteGoal = (goalId) => {
        const updatedGoals = goals.filter(g => g.id !== goalId)
        setGoals(updatedGoals)
        saveGoals(updatedGoals)
        addToast('Goal removed', 'info')
    }

    const acceptAISuggestion = (goal) => {
        const acceptedGoal = { ...goal, aiSuggested: false, id: Date.now().toString() }
        const updatedGoals = goals.map(g => g.id === goal.id ? acceptedGoal : g)
        setGoals(updatedGoals)
        saveGoals(updatedGoals)
        addToast('AI suggestion accepted!', 'success')
    }

    const getGoalIcon = (type) => {
        switch (type) {
            case 'revenue': return '💰'
            case 'bills': return '🧾'
            case 'customers': return '👥'
            default: return '🎯'
        }
    }

    const getGoalStatus = (percentage) => {
        if (percentage >= 100) return { status: 'completed', color: '#22c55e', icon: CheckCircle2, text: 'Achieved!' }
        if (percentage >= 75) return { status: 'close', color: '#84cc16', icon: TrendingUp, text: 'Almost there!' }
        if (percentage >= 50) return { status: 'progress', color: '#f59e0b', icon: Clock, text: 'On track' }
        return { status: 'behind', color: '#ef4444', icon: AlertCircle, text: 'Needs focus' }
    }

    if (loading) {
        return (
            <div className="smart-goals-panel loading">
                <Target size={32} className="pulse" style={{ color: 'var(--primary-500)' }} />
                <style>{goalsStyles}</style>
            </div>
        )
    }

    return (
        <div className="smart-goals-panel">
            <style>{goalsStyles}</style>

            <div className="goals-header">
                <div className="goals-title">
                    <Target size={22} style={{ color: 'var(--primary-500)' }} />
                    <h3>Smart Goals</h3>
                    <span className="ai-badge"><Sparkles size={12} /> AI-Powered</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                    <Plus size={16} /> Add Goal
                </button>
            </div>

            {goals.length === 0 ? (
                <div className="goals-empty">
                    <Trophy size={48} />
                    <h4>Set Your First Goal</h4>
                    <p>AI will suggest goals based on your business performance</p>
                    <button className="btn btn-primary" onClick={loadData}>
                        <Sparkles size={16} /> Get AI Suggestions
                    </button>
                </div>
            ) : (
                <div className="goals-list">
                    {goals.map(goal => {
                        const status = getGoalStatus(goal.percentage)
                        const StatusIcon = status.icon

                        return (
                            <div key={goal.id} className={`goal-card ${goal.aiSuggested ? 'ai-suggested' : ''}`}>
                                {goal.aiSuggested && (
                                    <div className="ai-suggestion-badge">
                                        <Sparkles size={12} /> AI Suggested
                                    </div>
                                )}
                                <div className="goal-header">
                                    <span className="goal-emoji">{getGoalIcon(goal.type)}</span>
                                    <div className="goal-info">
                                        <h4>{goal.title}</h4>
                                        <span className="goal-period">
                                            <Calendar size={12} /> {goal.period === 'weekly' ? 'This Week' : 'This Month'}
                                        </span>
                                    </div>
                                    {!goal.aiSuggested && (
                                        <button className="delete-btn" onClick={() => handleDeleteGoal(goal.id)}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                <div className="goal-progress">
                                    <div className="progress-numbers">
                                        <span className="current">
                                            {goal.type === 'revenue' ? `₹${(goal.current || 0).toLocaleString()}` : (goal.current || 0).toLocaleString()}
                                        </span>
                                        <span className="separator">/</span>
                                        <span className="target">
                                            {goal.type === 'revenue' ? `₹${goal.target.toLocaleString()}` : goal.target.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${goal.percentage}%`, backgroundColor: status.color }}
                                        />
                                    </div>
                                    <div className="progress-status" style={{ color: status.color }}>
                                        <StatusIcon size={14} />
                                        <span>{status.text} ({goal.percentage.toFixed(0)}%)</span>
                                    </div>
                                </div>

                                {goal.aiSuggested && (
                                    <button className="accept-btn" onClick={() => acceptAISuggestion(goal)}>
                                        <CheckCircle2 size={14} /> Accept Goal
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add Goal Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Goal</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Goal Type</label>
                                <select
                                    className="form-input"
                                    value={newGoal.type}
                                    onChange={e => setNewGoal({ ...newGoal, type: e.target.value })}
                                >
                                    <option value="revenue">💰 Revenue Target</option>
                                    <option value="bills">🧾 Transaction Count</option>
                                    <option value="customers">👥 Customer Growth</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Target {newGoal.type === 'revenue' ? '(₹)' : ''}</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder={newGoal.type === 'revenue' ? 'e.g., 50000' : 'e.g., 100'}
                                    value={newGoal.target}
                                    onChange={e => setNewGoal({ ...newGoal, target: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Period</label>
                                <select
                                    className="form-input"
                                    value={newGoal.period}
                                    onChange={e => setNewGoal({ ...newGoal, period: e.target.value })}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>

                            {businessData && (
                                <div className="ai-hint">
                                    <Sparkles size={14} />
                                    <span>
                                        Based on your data, we suggest a {newGoal.period} {newGoal.type} target of{' '}
                                        <strong>
                                            {newGoal.type === 'revenue'
                                                ? `₹${Math.ceil((newGoal.period === 'weekly' ? businessData.weeklyRevenue : businessData.monthlyRevenue) * 1.2 / 1000) * 1000}`
                                                : Math.ceil((newGoal.period === 'weekly' ? businessData.weeklyBills : businessData.monthlyBills) * 1.2)
                                            }
                                        </strong>
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddGoal}>
                                <Target size={16} /> Set Goal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const goalsStyles = `
    .smart-goals-panel {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .smart-goals-panel.loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
    }

    .goals-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .goals-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .goals-title h3 {
        margin: 0;
        font-size: 1.125rem;
    }

    .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1));
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--primary-500);
    }

    .goals-empty {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
    }

    .goals-empty svg {
        color: var(--text-tertiary);
        margin-bottom: 16px;
    }

    .goals-empty h4 {
        margin: 0 0 8px;
        color: var(--text-primary);
    }

    .goals-empty p {
        margin: 0 0 20px;
        font-size: 0.875rem;
    }

    .goals-list {
        display: grid;
        gap: 16px;
    }

    .goal-card {
        position: relative;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 16px;
        transition: all 0.2s;
    }

    .goal-card:hover {
        border-color: var(--primary-400);
    }

    .goal-card.ai-suggested {
        border-style: dashed;
        border-color: var(--primary-300);
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(99, 102, 241, 0.02));
    }

    .ai-suggestion-badge {
        position: absolute;
        top: -8px;
        right: 12px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: linear-gradient(135deg, #7c3aed, #6366f1);
        color: white;
        font-size: 0.625rem;
        font-weight: 600;
        border-radius: 100px;
    }

    .goal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .goal-emoji {
        font-size: 1.5rem;
    }

    .goal-info {
        flex: 1;
    }

    .goal-info h4 {
        margin: 0 0 4px;
        font-size: 0.9375rem;
    }

    .goal-period {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: var(--text-tertiary);
    }

    .delete-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-tertiary);
        border: none;
        border-radius: 6px;
        color: var(--text-tertiary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .delete-btn:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .goal-progress {
        margin-bottom: 12px;
    }

    .progress-numbers {
        display: flex;
        align-items: baseline;
        gap: 4px;
        margin-bottom: 8px;
    }

    .progress-numbers .current {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--primary-500);
    }

    .progress-numbers .separator {
        color: var(--text-tertiary);
    }

    .progress-numbers .target {
        font-size: 0.875rem;
        color: var(--text-secondary);
    }

    .progress-bar {
        height: 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;
    }

    .progress-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .accept-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: linear-gradient(135deg, #7c3aed, #6366f1);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .accept-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .ai-hint {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 12px;
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.05));
        border-radius: 8px;
        font-size: 0.8125rem;
        color: var(--text-secondary);
    }

    .ai-hint svg {
        color: var(--primary-500);
        flex-shrink: 0;
        margin-top: 2px;
    }

    .ai-hint strong {
        color: var(--primary-500);
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.1); }
    }
`
