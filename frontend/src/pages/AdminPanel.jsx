import { useState, useEffect } from 'react'
import {
    Users, Store, CreditCard, Settings, Shield, Activity,
    TrendingUp, AlertTriangle, CheckCircle, XCircle,
    MoreVertical, Search, Filter, Download, RefreshCw,
    UserPlus, Edit, Trash2, Eye, Lock, Unlock, Crown,
    Building2, BarChart3, DollarSign, Calendar, Globe
} from 'lucide-react'

// Mock data for admin panel
const mockStores = [
    { id: 1, name: "Sharma General Store", owner: "Ramesh Sharma", plan: "Pro", status: "active", revenue: 45000, users: 3, lastActive: "2 min ago" },
    { id: 2, name: "Krishna Mart", owner: "Krishna Iyer", plan: "Enterprise", status: "active", revenue: 125000, users: 8, lastActive: "5 min ago" },
    { id: 3, name: "City Grocers", owner: "Amit Patel", plan: "Free", status: "trial", revenue: 8500, users: 1, lastActive: "1 hour ago" },
    { id: 4, name: "Fresh Foods Hub", owner: "Priya Reddy", plan: "Pro", status: "active", revenue: 67000, users: 4, lastActive: "30 min ago" },
    { id: 5, name: "Super Bazaar", owner: "Mohammad Ali", plan: "Enterprise", status: "suspended", revenue: 0, users: 12, lastActive: "3 days ago" },
]

const mockUsers = [
    { id: 1, name: "Admin User", email: "admin@kadaigpt.com", role: "Super Admin", stores: "All", status: "active", lastLogin: "Just now" },
    { id: 2, name: "Ramesh Sharma", email: "ramesh@gmail.com", role: "Store Owner", stores: "1", status: "active", lastLogin: "2 min ago" },
    { id: 3, name: "Krishna Iyer", email: "krishna@gmail.com", role: "Store Owner", stores: "1", status: "active", lastLogin: "5 min ago" },
    { id: 4, name: "Support Agent", email: "support@kadaigpt.com", role: "Support", stores: "All", status: "active", lastLogin: "1 hour ago" },
]

const mockSubscriptions = [
    { id: 1, store: "Sharma General Store", plan: "Pro", amount: 499, status: "active", nextBilling: "Mar 2, 2026", method: "UPI" },
    { id: 2, store: "Krishna Mart", plan: "Enterprise", amount: 1999, status: "active", nextBilling: "Mar 5, 2026", method: "Card" },
    { id: 3, store: "City Grocers", plan: "Free", amount: 0, status: "trial", nextBilling: "Feb 15, 2026", method: "-" },
    { id: 4, store: "Fresh Foods Hub", plan: "Pro", amount: 499, status: "active", nextBilling: "Mar 10, 2026", method: "UPI" },
]

export default function AdminPanel({ addToast }) {
    const [activeTab, setActiveTab] = useState('overview')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedItems, setSelectedItems] = useState([])
    const [showAddUserModal, setShowAddUserModal] = useState(false)

    // Admin stats
    const stats = {
        totalStores: 1247,
        activeSubscriptions: 892,
        monthlyRevenue: 485000,
        totalUsers: 3456,
        trialUsers: 234,
        churnRate: 2.4,
        avgRevenuePerUser: 543,
        supportTickets: 12
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'stores', label: 'Stores', icon: Store },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'settings', label: 'Settings', icon: Settings },
    ]

    const getStatusBadge = (status) => {
        const styles = {
            active: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
            trial: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
            suspended: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
            inactive: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
        }
        const style = styles[status] || styles.inactive
        return (
            <span style={{
                background: style.bg,
                color: style.color,
                padding: '4px 12px',
                borderRadius: '100px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'capitalize'
            }}>
                {status}
            </span>
        )
    }

    const getPlanBadge = (plan) => {
        const colors = {
            Free: '#64748b',
            Pro: '#f97316',
            Enterprise: '#8b5cf6'
        }
        return (
            <span style={{
                background: `${colors[plan]}20`,
                color: colors[plan],
                padding: '4px 12px',
                borderRadius: '100px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {plan === 'Enterprise' && <Crown size={12} />}
                {plan}
            </span>
        )
    }

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <div>
                    <h1 className="page-title">
                        <Shield size={28} />
                        Admin Dashboard
                    </h1>
                    <p className="page-subtitle">Manage stores, users, and subscriptions</p>
                </div>
                <div className="admin-header-actions">
                    <button className="btn btn-secondary" onClick={() => addToast?.('Data refreshed', 'success')}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                    <button className="btn btn-secondary">
                        <Download size={16} />
                        Export
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="admin-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="admin-content">
                    <div className="admin-stats-grid">
                        <div className="admin-stat-card primary">
                            <div className="stat-icon"><Store size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Total Stores</span>
                                <span className="stat-value">{stats.totalStores.toLocaleString()}</span>
                            </div>
                            <span className="stat-trend positive">+12%</span>
                        </div>
                        <div className="admin-stat-card success">
                            <div className="stat-icon"><CreditCard size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Active Subscriptions</span>
                                <span className="stat-value">{stats.activeSubscriptions}</span>
                            </div>
                            <span className="stat-trend positive">+8%</span>
                        </div>
                        <div className="admin-stat-card warning">
                            <div className="stat-icon"><DollarSign size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Monthly Revenue</span>
                                <span className="stat-value">₹{(stats.monthlyRevenue / 1000).toFixed(0)}K</span>
                            </div>
                            <span className="stat-trend positive">+24%</span>
                        </div>
                        <div className="admin-stat-card info">
                            <div className="stat-icon"><Users size={24} /></div>
                            <div className="stat-info">
                                <span className="stat-label">Total Users</span>
                                <span className="stat-value">{stats.totalUsers.toLocaleString()}</span>
                            </div>
                            <span className="stat-trend positive">+15%</span>
                        </div>
                    </div>

                    <div className="admin-overview-grid">
                        <div className="card">
                            <h3>Recent Activity</h3>
                            <div className="activity-list">
                                <div className="activity-item">
                                    <CheckCircle size={16} className="success" />
                                    <span>New store "Fresh Mart" registered</span>
                                    <span className="time">2 min ago</span>
                                </div>
                                <div className="activity-item">
                                    <CreditCard size={16} className="primary" />
                                    <span>Krishna Mart upgraded to Enterprise</span>
                                    <span className="time">15 min ago</span>
                                </div>
                                <div className="activity-item">
                                    <AlertTriangle size={16} className="warning" />
                                    <span>Payment failed for Super Bazaar</span>
                                    <span className="time">1 hour ago</span>
                                </div>
                                <div className="activity-item">
                                    <Users size={16} className="info" />
                                    <span>5 new users signed up today</span>
                                    <span className="time">3 hours ago</span>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <h3>Quick Actions</h3>
                            <div className="quick-actions-grid">
                                <button className="quick-action-item" onClick={() => setShowAddUserModal(true)}>
                                    <UserPlus size={24} />
                                    <span>Add User</span>
                                </button>
                                <button className="quick-action-item">
                                    <Store size={24} />
                                    <span>Add Store</span>
                                </button>
                                <button className="quick-action-item">
                                    <Globe size={24} />
                                    <span>Broadcast</span>
                                </button>
                                <button className="quick-action-item">
                                    <Shield size={24} />
                                    <span>Security</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stores Tab */}
            {activeTab === 'stores' && (
                <div className="admin-content">
                    <div className="admin-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search stores..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="toolbar-actions">
                            <button className="btn btn-secondary">
                                <Filter size={16} />
                                Filters
                            </button>
                            <button className="btn btn-primary">
                                <Store size={16} />
                                Add Store
                            </button>
                        </div>
                    </div>

                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" /></th>
                                    <th>Store Name</th>
                                    <th>Owner</th>
                                    <th>Plan</th>
                                    <th>Revenue</th>
                                    <th>Users</th>
                                    <th>Status</th>
                                    <th>Last Active</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockStores.map(store => (
                                    <tr key={store.id}>
                                        <td><input type="checkbox" /></td>
                                        <td>
                                            <div className="store-name">
                                                <Store size={18} />
                                                {store.name}
                                            </div>
                                        </td>
                                        <td>{store.owner}</td>
                                        <td>{getPlanBadge(store.plan)}</td>
                                        <td>₹{store.revenue.toLocaleString()}</td>
                                        <td>{store.users}</td>
                                        <td>{getStatusBadge(store.status)}</td>
                                        <td>{store.lastActive}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="icon-btn" title="View"><Eye size={16} /></button>
                                                <button className="icon-btn" title="Edit"><Edit size={16} /></button>
                                                <button className="icon-btn danger" title="Delete"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="admin-content">
                    <div className="admin-toolbar">
                        <div className="search-box">
                            <Search size={18} />
                            <input type="text" placeholder="Search users..." />
                        </div>
                        <div className="toolbar-actions">
                            <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
                                <UserPlus size={16} />
                                Add User
                            </button>
                        </div>
                    </div>

                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" /></th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Stores</th>
                                    <th>Status</th>
                                    <th>Last Login</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockUsers.map(user => (
                                    <tr key={user.id}>
                                        <td><input type="checkbox" /></td>
                                        <td>
                                            <div className="user-info">
                                                <div className="user-avatar">{user.name.charAt(0)}</div>
                                                {user.name}
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge ${user.role.toLowerCase().replace(' ', '-')}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>{user.stores}</td>
                                        <td>{getStatusBadge(user.status)}</td>
                                        <td>{user.lastLogin}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="icon-btn" title="View"><Eye size={16} /></button>
                                                <button className="icon-btn" title="Edit"><Edit size={16} /></button>
                                                <button className="icon-btn" title="Lock"><Lock size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Subscriptions Tab */}
            {activeTab === 'subscriptions' && (
                <div className="admin-content">
                    <div className="subscription-stats">
                        <div className="sub-stat">
                            <span className="label">MRR</span>
                            <span className="value">₹4.85L</span>
                        </div>
                        <div className="sub-stat">
                            <span className="label">ARR</span>
                            <span className="value">₹58.2L</span>
                        </div>
                        <div className="sub-stat">
                            <span className="label">Churn Rate</span>
                            <span className="value">2.4%</span>
                        </div>
                        <div className="sub-stat">
                            <span className="label">LTV</span>
                            <span className="value">₹8,450</span>
                        </div>
                    </div>

                    <div className="admin-table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Store</th>
                                    <th>Plan</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Next Billing</th>
                                    <th>Payment Method</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockSubscriptions.map(sub => (
                                    <tr key={sub.id}>
                                        <td>{sub.store}</td>
                                        <td>{getPlanBadge(sub.plan)}</td>
                                        <td>₹{sub.amount}/mo</td>
                                        <td>{getStatusBadge(sub.status)}</td>
                                        <td>{sub.nextBilling}</td>
                                        <td>{sub.method}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn btn-sm btn-secondary">Manage</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style>{`
                .admin-panel {
                    padding: 24px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .admin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 24px;
                }
                .admin-header .page-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 0;
                }
                .admin-header-actions {
                    display: flex;
                    gap: 12px;
                }
                
                .admin-tabs {
                    display: flex;
                    gap: 4px;
                    background: var(--bg-secondary);
                    padding: 6px;
                    border-radius: var(--radius-xl);
                    margin-bottom: 24px;
                    overflow-x: auto;
                }
                .admin-tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-lg);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-weight: 500;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .admin-tab:hover { background: var(--bg-tertiary); }
                .admin-tab.active {
                    background: var(--primary-500);
                    color: white;
                }
                
                .admin-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 24px;
                }
                .admin-stat-card {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-xl);
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    position: relative;
                    overflow: hidden;
                }
                .admin-stat-card .stat-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .admin-stat-card.primary .stat-icon { background: rgba(249, 115, 22, 0.15); color: #f97316; }
                .admin-stat-card.success .stat-icon { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
                .admin-stat-card.warning .stat-icon { background: rgba(234, 179, 8, 0.15); color: #eab308; }
                .admin-stat-card.info .stat-icon { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                .stat-info { flex: 1; }
                .stat-label { display: block; font-size: 0.875rem; color: var(--text-tertiary); margin-bottom: 4px; }
                .stat-value { font-size: 1.75rem; font-weight: 700; }
                .stat-trend {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    padding: 4px 8px;
                    border-radius: var(--radius-md);
                }
                .stat-trend.positive { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
                .stat-trend.negative { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
                
                .admin-overview-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                }
                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 16px;
                }
                .activity-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                }
                .activity-item .time {
                    margin-left: auto;
                    color: var(--text-tertiary);
                    font-size: 0.75rem;
                }
                .activity-item .success { color: #22c55e; }
                .activity-item .primary { color: #f97316; }
                .activity-item .warning { color: #eab308; }
                .activity-item .info { color: #3b82f6; }
                
                .quick-actions-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-top: 16px;
                }
                .quick-action-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 20px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .quick-action-item:hover {
                    border-color: var(--primary-400);
                    background: rgba(249, 115, 22, 0.05);
                }
                
                .admin-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--bg-tertiary);
                    padding: 12px 16px;
                    border-radius: var(--radius-lg);
                    width: 300px;
                }
                .search-box input {
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-primary);
                    width: 100%;
                }
                .toolbar-actions { display: flex; gap: 12px; }
                
                .admin-table-container {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                }
                .admin-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .admin-table th, .admin-table td {
                    padding: 16px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .admin-table th {
                    background: var(--bg-tertiary);
                    font-weight: 600;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .admin-table tbody tr:hover { background: var(--bg-tertiary); }
                
                .store-name { display: flex; align-items: center; gap: 10px; font-weight: 500; }
                .user-info { display: flex; align-items: center; gap: 12px; }
                .user-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--primary-500);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                }
                
                .role-badge {
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .role-badge.super-admin { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
                .role-badge.store-owner { background: rgba(249, 115, 22, 0.15); color: #f97316; }
                .role-badge.support { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                
                .action-buttons { display: flex; gap: 8px; }
                .icon-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-md);
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
                .icon-btn.danger:hover { border-color: #ef4444; color: #ef4444; }
                
                .subscription-stats {
                    display: flex;
                    gap: 24px;
                    padding: 24px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-xl);
                    margin-bottom: 24px;
                }
                .sub-stat {
                    text-align: center;
                    flex: 1;
                }
                .sub-stat .label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                }
                .sub-stat .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--primary-400);
                }
                
                @media (max-width: 1024px) {
                    .admin-stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .admin-overview-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 768px) {
                    .admin-panel { padding: 16px; }
                    .admin-stats-grid { grid-template-columns: 1fr; }
                    .admin-header { flex-direction: column; gap: 16px; }
                    .admin-tabs { overflow-x: auto; }
                    .admin-toolbar { flex-direction: column; gap: 12px; }
                    .search-box { width: 100%; }
                }
            `}</style>
        </div>
    )
}
