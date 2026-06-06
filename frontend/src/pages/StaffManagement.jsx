import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, UserPlus, Shield, ShieldCheck, ShieldOff, Phone, Search, X, Check, Copy, Key, AlertTriangle } from 'lucide-react'
import api from '../services/api'

export default function StaffManagement({ addToast }) {
  const { t } = useTranslation()
    const [staff, setStaff] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [createdStaff, setCreatedStaff] = useState(null) // Shows the newly created staff's credentials
    const [addLoading, setAddLoading] = useState(false)

    const [newStaff, setNewStaff] = useState({
        full_name: '',
        role: 'cashier',
        phone: '',
    })

    const roles = [
        { id: 'cashier', label: 'Cashier', description: 'Create bills, view products (read-only), view customers', color: '#3b82f6', icon: '🧾' },
        { id: 'inventory_manager', label: 'Inventory Manager', description: 'Manage products & stock, suppliers, bulk import', color: '#f59e0b', icon: '📦' },
        { id: 'manager', label: 'Manager', description: 'Full access — billing, products, analytics, staff', color: '#8b5cf6', icon: '👔' },
    ]

    useEffect(() => {
        loadStaff()
    }, [])

    const loadStaff = async () => {
        setIsLoading(true)
        try {
            const response = await api.listStaff()
            setStaff(Array.isArray(response) ? response : [])
        } catch (err) {
            console.error('Failed to load staff:', err)
            setStaff([])
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddStaff = async () => {
        if (!newStaff.full_name || newStaff.full_name.length < 2) {
            addToast('Please enter a valid name (min 2 characters)', 'error')
            return
        }

        setAddLoading(true)
        try {
            const result = await api.createStaff({
                full_name: newStaff.full_name,
                role: newStaff.role,
                phone: newStaff.phone || undefined,
            })
            // Show the generated Staff ID and temp password
            setCreatedStaff(result)
            addToast(`${newStaff.full_name} added as ${newStaff.role}!`, 'success')
            setNewStaff({ full_name: '', role: 'cashier', phone: '' })
            loadStaff()
        } catch (err) {
            addToast(err.message || 'Failed to create staff', 'error')
        } finally {
            setAddLoading(false)
        }
    }

    const handleToggleStatus = async (member) => {
        try {
            await api.toggleStaffStatus(member.id)
            addToast(`${member.full_name || member.username} status updated`, 'success')
            loadStaff()
        } catch (err) {
            addToast(err.message || 'Failed to update status', 'error')
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        addToast('Copied to clipboard!', 'success')
    }

    const filteredStaff = staff.filter(s => {
        const name = (s.full_name || s.username || '').toLowerCase()
        const staffId = (s.staff_id || '').toLowerCase()
        const q = searchQuery.toLowerCase()
        return name.includes(q) || staffId.includes(q)
    })

    const getRoleInfo = (role) => {
        return roles.find(r => r.id === (role || '').toLowerCase()) || roles[0]
    }

    return (
        <div className="staff-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1><Users size={28} /> {t('staff.title', 'Staff Management')}</h1>
                    <p className="page-subtitle">Create staff accounts with unique login IDs</p>
                </div>
                <button className="add-btn" onClick={() => { setShowAddModal(true); setCreatedStaff(null) }}>
                    <UserPlus size={18} />
                    {t('staff.addStaff', 'Add Staff')}
                </button>
            </div>

            {/* Search */}
            <div className="search-bar">
                <Search size={18} />
                <input
                    type="text"
                    placeholder="Search by name or Staff ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Staff List */}
            <div className="staff-list">
                {isLoading ? (
                    <div className="empty-state">
                        <p>Loading staff...</p>
                    </div>
                ) : filteredStaff.length > 0 ? filteredStaff.map(member => {
                    const roleInfo = getRoleInfo(member.role)
                    const isActive = member.is_active !== false
                    return (
                        <div key={member.id} className={`staff-card ${isActive ? '' : 'inactive'}`}>
                            <div className="staff-avatar" style={{ background: roleInfo.color + '20', color: roleInfo.color }}>
                                {roleInfo.icon}
                            </div>
                            <div className="staff-info">
                                <div className="staff-name">
                                    {member.full_name || member.username}
                                    <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                                        {isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                {member.staff_id && (
                                    <div className="staff-id-display">
                                        <Key size={12} />
                                        <span className="sid">{member.staff_id}</span>
                                        <button className="copy-mini" onClick={() => copyToClipboard(member.staff_id)} title="Copy ID">
                                            <Copy size={10} />
                                        </button>
                                    </div>
                                )}
                                <div className="staff-meta">
                                    {member.phone && <span><Phone size={12} /> {member.phone}</span>}
                                </div>
                                <div className="staff-role">
                                    <Shield size={12} style={{ color: roleInfo.color }} />
                                    {roleInfo.label}
                                </div>
                            </div>
                            <div className="staff-actions">
                                <button
                                    className={`action-btn ${isActive ? 'deactivate' : 'activate'}`}
                                    onClick={() => handleToggleStatus(member)}
                                    title={isActive ? 'Deactivate' : 'Activate'}
                                >
                                    {isActive ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                                </button>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="empty-state">
                        <Users size={48} />
                        <h3>No staff members yet</h3>
                        <p>Create your first staff member — they'll get a unique login ID</p>
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
                                <span style={{ fontSize: '20px' }}>{role.icon}</span>
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
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setCreatedStaff(null) }}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><UserPlus size={20} /> {createdStaff ? 'Staff Created!' : 'Add New Staff'}</h2>
                            <button className="close-btn" onClick={() => { setShowAddModal(false); setCreatedStaff(null) }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Show credentials after creation */}
                        {createdStaff ? (
                            <div className="modal-body">
                                <div className="credentials-box">
                                    <div className="cred-header">
                                        <Check size={24} style={{ color: '#22c55e' }} />
                                        <h3>Staff account created successfully!</h3>
                                    </div>
                                    <p className="cred-note">
                                        <AlertTriangle size={14} /> Share these credentials with the staff member. The password should be changed on first login.
                                    </p>
                                    <div className="cred-row">
                                        <label>Staff ID</label>
                                        <div className="cred-value">
                                            <span className="staff-id-big">{createdStaff.staff_id}</span>
                                            <button onClick={() => copyToClipboard(createdStaff.staff_id)}><Copy size={14} /> Copy</button>
                                        </div>
                                    </div>
                                    <div className="cred-row">
                                        <label>Temporary Password</label>
                                        <div className="cred-value">
                                            <span className="temp-pass">{createdStaff.temporary_password}</span>
                                            <button onClick={() => copyToClipboard(createdStaff.temporary_password)}><Copy size={14} /> Copy</button>
                                        </div>
                                    </div>
                                    <div className="cred-row">
                                        <label>Role</label>
                                        <div className="cred-value">
                                            <span>{getRoleInfo(createdStaff.role).label}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn-primary" onClick={() => { setShowAddModal(false); setCreatedStaff(null) }}>
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label>Full Name *</label>
                                        <input
                                            type="text"
                                            placeholder="Enter staff member's name"
                                            value={newStaff.full_name}
                                            onChange={e => setNewStaff({ ...newStaff, full_name: e.target.value })}
                                            autoFocus
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
                                        <label>Role *</label>
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
                                                    <span style={{ fontSize: '16px' }}>{role.icon}</span>
                                                    <div>
                                                        <span className="role-name">{role.label}</span>
                                                        <span className="role-desc">{role.description}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button className="btn-primary" onClick={handleAddStaff} disabled={addLoading}>
                                        {addLoading ? 'Creating...' : <><Check size={18} /> Create Staff</>}
                                    </button>
                                </div>
                            </>
                        )}
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

        .staff-id-display {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          font-size: 0.8rem;
          margin-bottom: 4px;
        }
        .staff-id-display .sid {
          font-family: 'Courier New', monospace;
          font-weight: 700;
          color: var(--primary-400);
          letter-spacing: 1px;
        }
        .copy-mini {
          background: none; border: none; cursor: pointer;
          color: var(--text-tertiary); padding: 2px;
          display: flex; align-items: center;
        }
        .copy-mini:hover { color: var(--primary-400); }

        .staff-meta {
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          color: var(--text-tertiary);
          margin-bottom: 4px;
        }
        .staff-meta span { display: flex; align-items: center; gap: 4px; }

        .staff-role {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

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
        .roles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
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

        /* Credentials Box */
        .credentials-box {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.02));
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 16px;
          padding: 24px;
        }
        .cred-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px;
        }
        .cred-header h3 { margin: 0; font-size: 1.1rem; color: #22c55e; }
        .cred-note {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.8rem; color: #f59e0b;
          margin-bottom: 20px; padding: 10px 14px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 8px;
        }
        .cred-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .cred-row:last-child { border-bottom: none; }
        .cred-row label { font-size: 0.85rem; color: var(--text-tertiary); font-weight: 500; }
        .cred-value { display: flex; align-items: center; gap: 10px; }
        .staff-id-big {
          font-family: 'Courier New', monospace;
          font-size: 1.4rem; font-weight: 800;
          color: var(--primary-400);
          letter-spacing: 2px;
        }
        .temp-pass {
          font-family: 'Courier New', monospace;
          font-size: 1.1rem; font-weight: 600;
          color: var(--text-primary);
        }
        .cred-value button {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 12px; background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle); border-radius: 6px;
          font-size: 0.75rem; cursor: pointer; color: var(--text-secondary);
        }
        .cred-value button:hover { border-color: var(--primary-400); color: var(--primary-400); }

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
          max-width: 520px;
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
        .form-group > label { display: block; margin-bottom: 8px; font-weight: 500; font-size: 0.9rem; }
        .form-group input[type="text"],
        .form-group input[type="tel"] {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .form-group input:focus { border-color: var(--primary-400); outline: none; }

        .role-options { display: flex; flex-direction: column; gap: 10px; }
        .role-option {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-option input { display: none; }
        .role-option.selected { background: var(--bg-card); }
        .role-option div { display: flex; flex-direction: column; }
        .role-name { font-weight: 600; font-size: 0.9rem; }
        .role-desc { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px; }

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
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; gap: 16px; }
          .add-btn { width: 100%; justify-content: center; }
          .staff-card { flex-direction: column; text-align: center; }
          .staff-info { text-align: center; }
          .staff-name { justify-content: center; }
          .staff-meta { justify-content: center; flex-wrap: wrap; }
          .staff-role { justify-content: center; }
          .staff-id-display { justify-content: center; }
        }
      `}</style>
        </div>
    )
}
