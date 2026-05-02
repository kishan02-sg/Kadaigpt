import { useState, useEffect } from 'react'
import { Users, UserPlus, Trash2, Edit2, Shield, ShieldCheck, ShieldOff, Mail, Phone, Search, X, Check } from 'lucide-react'
import api from '../services/api'

export default function StaffManagement({ addToast }) {
    const [staff, setStaff] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    const [newStaff, setNewStaff] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'cashier',
        permissions: {
            canCreateBills: true,
            canViewProducts: true,
            canEditProducts: false,
            canViewCustomers: false,
            canEditCustomers: false,
            canViewReports: false,
            canManageStaff: false
        }
    })

    // Demo staff data
    const demoStaff = [
        { id: 1, name: 'Ravi Kumar', email: 'ravi@store.com', phone: '9876543210', role: 'manager', status: 'active', lastActive: '2 hours ago' },
        { id: 2, name: 'Priya S', email: 'priya@store.com', phone: '9876543211', role: 'cashier', status: 'active', lastActive: '10 mins ago' },
        { id: 3, name: 'Arun M', email: 'arun@store.com', phone: '9876543212', role: 'cashier', status: 'inactive', lastActive: '2 days ago' },
    ]

    useEffect(() => {
        loadStaff()
    }, [])

    const loadStaff = async () => {
        setIsLoading(true)
        try {
            // Try to fetch from API, fallback to demo
            const response = await api.getStaff?.() || demoStaff
            setStaff(Array.isArray(response) ? response : demoStaff)
        } catch {
            setStaff(demoStaff)
        } finally {
            setIsLoading(false)
        }
    }

    const roles = [
        { id: 'cashier', label: 'Cashier', description: 'Can create bills and view products', color: '#3b82f6' },
        { id: 'salesperson', label: 'Sales Person', description: 'Can create bills and manage customers', color: '#22c55e' },
        { id: 'inventory', label: 'Inventory Manager', description: 'Can manage products and stock', color: '#f59e0b' },
        { id: 'manager', label: 'Manager', description: 'Full access except staff management', color: '#8b5cf6' },
    ]

    const handleAddStaff = () => {
        if (!newStaff.name || !newStaff.email) {
            addToast('Please fill in name and email', 'error')
            return
        }

        const staffMember = {
            id: Date.now(),
            ...newStaff,
            status: 'active',
            lastActive: 'Just now'
        }

        setStaff([...staff, staffMember])
        setShowAddModal(false)
        setNewStaff({ name: '', email: '', phone: '', role: 'cashier', permissions: {} })
        addToast(`${newStaff.name} added to staff`, 'success')
    }

    const handleRemoveStaff = (id) => {
        const member = staff.find(s => s.id === id)
        setStaff(staff.filter(s => s.id !== id))
        addToast(`${member?.name} removed from staff`, 'info')
    }

    const handleToggleStatus = (id) => {
        setStaff(staff.map(s => {
            if (s.id === id) {
                const newStatus = s.status === 'active' ? 'inactive' : 'active'
                addToast(`${s.name} is now ${newStatus}`, 'success')
                return { ...s, status: newStatus }
            }
            return s
        }))
    }

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="staff-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1><Users size={28} /> Staff Management</h1>
                    <p>Add, remove, and manage staff access to your store</p>
                </div>
                <button className="add-btn" onClick={() => setShowAddModal(true)}>
                    <UserPlus size={18} />
                    Add Staff
                </button>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Search staff by name or email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Staff List */}
            <div className="staff-list">
                {filteredStaff.length > 0 ? filteredStaff.map(member => {
                    const role = roles.find(r => r.id === member.role) || roles[0]
                    return (
                        <div key={member.id} className={`staff-card ${member.status}`}>
                            <div className="staff-avatar" style={{ background: role.color + '20', color: role.color }}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="staff-info">
                                <div className="staff-name">
                                    {member.name}
                                    <span className={`status-badge ${member.status}`}>
                                        {member.status}
                                    </span>
                                </div>
                                <div className="staff-meta">
                                    <span><Mail size={12} /> {member.email}</span>
                                    {member.phone && <span><Phone size={12} /> {member.phone}</span>}
                                </div>
                                <div className="staff-role">
                                    <Shield size={12} style={{ color: role.color }} />
                                    {role.label}
                                    <span className="last-active">• Last active: {member.lastActive}</span>
                                </div>
                            </div>
                            <div className="staff-actions">
                                <button
                                    className={`action-btn ${member.status === 'active' ? 'deactivate' : 'activate'}`}
                                    onClick={() => handleToggleStatus(member.id)}
                                    title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                                >
                                    {member.status === 'active' ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                                </button>
                                <button
                                    className="action-btn edit"
                                    onClick={() => setEditingStaff(member)}
                                    title="Edit"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    className="action-btn delete"
                                    onClick={() => handleRemoveStaff(member.id)}
                                    title="Remove"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="empty-state">
                        <Users size={48} />
                        <h3>No staff members yet</h3>
                        <p>Add your first staff member to get started</p>
                        <button onClick={() => setShowAddModal(true)}>
                            <UserPlus size={18} /> Add Staff
                        </button>
                    </div>
                )}
            </div>

            {/* Role Permissions Info */}
            <div className="permissions-info">
                <h3>Role Permissions</h3>
                <div className="roles-grid">
                    {roles.map(role => (
                        <div key={role.id} className="role-card" style={{ borderColor: role.color }}>
                            <div className="role-icon" style={{ background: role.color + '20', color: role.color }}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <strong>{role.label}</strong>
                                <p>{role.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Staff Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><UserPlus size={20} /> Add New Staff</h2>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input
                                    type="text"
                                    placeholder="Enter name"
                                    value={newStaff.name}
                                    onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    placeholder="Enter email"
                                    value={newStaff.email}
                                    onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={newStaff.phone}
                                    onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <div className="role-options">
                                    {roles.map(role => (
                                        <label
                                            key={role.id}
                                            className={`role-option ${newStaff.role === role.id ? 'selected' : ''}`}
                                            style={{ borderColor: newStaff.role === role.id ? role.color : 'transparent' }}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                value={role.id}
                                                checked={newStaff.role === role.id}
                                                onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                                            />
                                            <Shield size={16} style={{ color: role.color }} />
                                            <span>{role.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleAddStaff}>
                                <Check size={18} /> Add Staff
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .staff-page { max-width: 1000px; margin: 0 auto; }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .page-header h1 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.5rem;
          margin: 0 0 4px;
        }
        .page-header p { color: var(--text-secondary); margin: 0; }

        .add-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 500;
          cursor: pointer;
        }
        .add-btn:hover { opacity: 0.9; }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .search-bar input {
          flex: 1;
          border: none;
          background: none;
          font-size: 0.9rem;
          color: var(--text-primary);
          outline: none;
        }
        .search-bar svg { color: var(--text-tertiary); }

        .staff-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }

        .staff-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          transition: all 0.2s;
        }
        .staff-card:hover { border-color: var(--primary-400); }
        .staff-card.inactive { opacity: 0.6; }

        .staff-avatar {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .staff-info { flex: 1; }
        .staff-name {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 4px;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        .status-badge.active { background: #22c55e20; color: #22c55e; }
        .status-badge.inactive { background: #ef444420; color: #ef4444; }

        .staff-meta {
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          color: var(--text-tertiary);
          margin-bottom: 6px;
        }
        .staff-meta span { display: flex; align-items: center; gap: 4px; }

        .staff-role {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .last-active { color: var(--text-tertiary); }

        .staff-actions { display: flex; gap: 8px; }
        .action-btn {
          width: 36px;
          height: 36px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-tertiary);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .action-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .action-btn.delete:hover { border-color: #ef4444; color: #ef4444; }
        .action-btn.activate:hover { border-color: #22c55e; color: #22c55e; }
        .action-btn.deactivate:hover { border-color: #f59e0b; color: #f59e0b; }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: var(--bg-card);
          border: 1px dashed var(--border-subtle);
          border-radius: 16px;
        }
        .empty-state svg { color: var(--text-tertiary); opacity: 0.3; margin-bottom: 16px; }
        .empty-state h3 { margin: 0 0 8px; }
        .empty-state p { color: var(--text-secondary); margin-bottom: 20px; }
        .empty-state button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: var(--primary-500);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }

        .permissions-info {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 24px;
        }
        .permissions-info h3 { margin: 0 0 16px; font-size: 1rem; }
        .roles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
        .role-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: 12px;
        }
        .role-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .role-card strong { display: block; margin-bottom: 4px; }
        .role-card p { margin: 0; font-size: 0.8rem; color: var(--text-tertiary); }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal {
          background: var(--bg-secondary);
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .modal-header h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 1.25rem;
        }
        .close-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
        }
        .modal-body { padding: 24px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 500; font-size: 0.9rem; }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        .form-group input:focus { border-color: var(--primary-400); outline: none; }

        .role-options { display: flex; flex-wrap: wrap; gap: 10px; }
        .role-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-option input { display: none; }
        .role-option.selected { background: var(--bg-card); }
        .role-option span { font-size: 0.85rem; }

        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid var(--border-subtle);
        }
        .btn-secondary {
          padding: 10px 20px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--primary-500);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 500;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; gap: 16px; }
          .add-btn { width: 100%; justify-content: center; }
          .staff-card { flex-direction: column; text-align: center; }
          .staff-info { text-align: center; }
          .staff-name { justify-content: center; }
          .staff-meta { justify-content: center; flex-wrap: wrap; }
          .staff-role { justify-content: center; }
        }
      `}</style>
        </div>
    )
}
