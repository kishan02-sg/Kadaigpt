import { useState, useEffect } from 'react'
import { Store, Plus, ChevronRight, Settings, Users, BarChart3, MapPin, Phone, Edit2, Trash2, Check, X } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function StoreManager({ addToast, setCurrentPage, onStoreChange }) {
    const [stores, setStores] = useState([])
    const [activeStoreId, setActiveStoreId] = useState(localStorage.getItem('kadai_active_store_id') || null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const [newStore, setNewStore] = useState({
        name: '',
        address: '',
        phone: '',
        type: 'grocery'
    })

    // Demo stores
    const demoStores = [
        {
            id: '1',
            name: localStorage.getItem('kadai_store_name') || 'My Store',
            address: 'Main Street',
            phone: '9876543210',
            type: 'grocery',
            stats: { todaySales: 12500, bills: 23, products: 156 }
        },
    ]

    useEffect(() => {
        loadStores()
    }, [])

    const loadStores = async () => {
        setIsLoading(true)
        try {
            // Load from localStorage or demo
            const savedStores = localStorage.getItem('kadai_stores')
            if (savedStores) {
                setStores(JSON.parse(savedStores))
            } else {
                setStores(demoStores)
                localStorage.setItem('kadai_stores', JSON.stringify(demoStores))
            }

            if (!activeStoreId && demoStores.length > 0) {
                setActiveStoreId(demoStores[0].id)
                localStorage.setItem('kadai_active_store_id', demoStores[0].id)
            }
        } catch (error) {
            setStores(demoStores)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddStore = () => {
        if (!newStore.name) {
            addToast('Please enter store name', 'error')
            return
        }

        const store = {
            id: Date.now().toString(),
            ...newStore,
            stats: { todaySales: 0, bills: 0, products: 0 }
        }

        const updatedStores = [...stores, store]
        setStores(updatedStores)
        localStorage.setItem('kadai_stores', JSON.stringify(updatedStores))
        setShowAddModal(false)
        setNewStore({ name: '', address: '', phone: '', type: 'grocery' })
        addToast(`${store.name} added successfully`, 'success')
    }

    const handleSwitchStore = (storeId) => {
        const store = stores.find(s => s.id === storeId)
        if (store) {
            setActiveStoreId(storeId)

            // BUG-009 FIX: Clear ALL cached data on store switch
            localStorage.setItem('kadai_active_store_id', storeId)
            localStorage.setItem('kadai_store_name', store.name)
            if (store.address) localStorage.setItem('kadai_store_address', store.address)
            if (store.phone) localStorage.setItem('kadai_store_phone', store.phone)

            // Clear cached product/customer/bill data so fresh data loads
            localStorage.removeItem('kadai_products_cache')
            localStorage.removeItem('kadai_customers_cache')
            localStorage.removeItem('kadai_bills_cache')

            // BUG-009: Clear in-memory API cache
            realDataService.clearCache()

            addToast(`🏪 Switched to ${store.name}`, 'success')

            // Trigger parent callback to refresh all data
            if (onStoreChange) onStoreChange(store)

            // Navigate to dashboard to show fresh store data
            if (setCurrentPage) setCurrentPage('dashboard')
        }
    }

    const handleDeleteStore = (storeId) => {
        if (stores.length === 1) {
            addToast('Cannot delete the only store', 'error')
            return
        }
        const store = stores.find(s => s.id === storeId)
        const updatedStores = stores.filter(s => s.id !== storeId)
        setStores(updatedStores)
        localStorage.setItem('kadai_stores', JSON.stringify(updatedStores))

        if (activeStoreId === storeId) {
            handleSwitchStore(updatedStores[0].id)
        }
        addToast(`${store?.name} deleted`, 'info')
    }

    const storeTypes = [
        { id: 'grocery', label: 'Grocery' },
        { id: 'medical', label: 'Medical' },
        { id: 'general', label: 'General Store' },
        { id: 'electronics', label: 'Electronics' },
        { id: 'restaurant', label: 'Restaurant' },
        { id: 'other', label: 'Other' },
    ]

    const formatCurrency = (n) => `₹${(n || 0).toLocaleString('en-IN')}`

    return (
        <div className="store-manager">
            <div className="page-header">
                <div>
                    <h1><Store size={28} /> My Stores</h1>
                    <p>Manage multiple store locations</p>
                </div>
                <button className="add-btn" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} />
                    Add Store
                </button>
            </div>

            {/* Store Cards */}
            <div className="stores-grid">
                {stores.map(store => (
                    <div
                        key={store.id}
                        className={`store-card ${activeStoreId === store.id ? 'active' : ''}`}
                        onClick={() => handleSwitchStore(store.id)}
                    >
                        {activeStoreId === store.id && (
                            <div className="active-badge">
                                <Check size={12} /> Active
                            </div>
                        )}

                        <div className="store-header">
                            <div className="store-icon">
                                <Store size={24} />
                            </div>
                            <div className="store-info">
                                <h3>{store.name}</h3>
                                <span className="store-type">{store.type}</span>
                            </div>
                        </div>

                        <div className="store-meta">
                            {store.address && (
                                <div className="meta-item">
                                    <MapPin size={14} />
                                    <span>{store.address}</span>
                                </div>
                            )}
                            {store.phone && (
                                <div className="meta-item">
                                    <Phone size={14} />
                                    <span>{store.phone}</span>
                                </div>
                            )}
                        </div>

                        <div className="store-stats">
                            <div className="stat">
                                <strong>{formatCurrency(store.stats?.todaySales)}</strong>
                                <span>Today</span>
                            </div>
                            <div className="stat">
                                <strong>{store.stats?.bills || 0}</strong>
                                <span>Bills</span>
                            </div>
                            <div className="stat">
                                <strong>{store.stats?.products || 0}</strong>
                                <span>Products</span>
                            </div>
                        </div>

                        <div className="store-actions">
                            <button
                                className="action-btn"
                                onClick={(e) => { e.stopPropagation(); handleSwitchStore(store.id); }}
                            >
                                <ChevronRight size={16} />
                                {activeStoreId === store.id ? 'Current' : 'Switch'}
                            </button>
                            <button
                                className="action-btn delete"
                                onClick={(e) => { e.stopPropagation(); handleDeleteStore(store.id); }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Store Card */}
                <div className="store-card add-card" onClick={() => setShowAddModal(true)}>
                    <Plus size={40} />
                    <span>Add New Store</span>
                </div>
            </div>

            {/* Add Store Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><Store size={20} /> Add New Store</h2>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Store Name *</label>
                                <input
                                    type="text"
                                    placeholder="Enter store name"
                                    value={newStore.name}
                                    onChange={e => setNewStore({ ...newStore, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Address</label>
                                <input
                                    type="text"
                                    placeholder="Enter address"
                                    value={newStore.address}
                                    onChange={e => setNewStore({ ...newStore, address: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={newStore.phone}
                                    onChange={e => setNewStore({ ...newStore, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Store Type</label>
                                <select
                                    value={newStore.type}
                                    onChange={e => setNewStore({ ...newStore, type: e.target.value })}
                                >
                                    {storeTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleAddStore}>
                                <Check size={18} /> Add Store
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .store-manager { max-width: 1200px; margin: 0 auto; }

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

        .stores-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .store-card {
          background: var(--bg-card);
          border: 2px solid var(--border-subtle);
          border-radius: 20px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
        }
        .store-card:hover {
          border-color: var(--primary-400);
          transform: translateY(-2px);
        }
        .store-card.active {
          border-color: #22c55e;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02));
        }

        .active-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #22c55e;
          color: white;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .store-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }
        .store-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 88, 12, 0.05));
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-400);
        }
        .store-info h3 { margin: 0 0 4px; font-size: 1.1rem; }
        .store-type {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          text-transform: capitalize;
        }

        .store-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .meta-item svg { color: var(--text-tertiary); }

        .store-stats {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-top: 1px solid var(--border-subtle);
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 16px;
        }
        .store-stats .stat { text-align: center; flex: 1; }
        .store-stats .stat strong { display: block; font-size: 1.1rem; }
        .store-stats .stat span { font-size: 0.7rem; color: var(--text-tertiary); }

        .store-actions {
          display: flex;
          gap: 8px;
        }
        .store-actions .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.8rem;
        }
        .store-actions .action-btn:hover {
          border-color: var(--primary-400);
          color: var(--primary-400);
        }
        .store-actions .action-btn.delete {
          flex: 0;
          width: 40px;
        }
        .store-actions .action-btn.delete:hover {
          border-color: #ef4444;
          color: #ef4444;
        }

        .add-card {
          border-style: dashed;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 280px;
          color: var(--text-tertiary);
        }
        .add-card:hover {
          border-color: var(--primary-400);
          color: var(--primary-400);
        }

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
        .form-group input, .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        .form-group input:focus, .form-group select:focus { border-color: var(--primary-400); outline: none; }
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
          .stores-grid { grid-template-columns: 1fr; }
        }
      `}</style>
        </div>
    )
}
