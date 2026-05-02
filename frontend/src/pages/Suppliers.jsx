import { useState, useEffect } from 'react'
import { Truck, Plus, Phone, MapPin, Package, Calendar, Clock, TrendingUp, X, Check, AlertTriangle, Search, Filter, Mail, Star, ShoppingCart, MessageCircle, Loader2, Edit2, Trash2 } from 'lucide-react'
import whatsappService from '../services/whatsapp'
import api from '../services/api'

export default function Suppliers({ addToast }) {
    const [suppliers, setSuppliers] = useState([])
    const [orders, setOrders] = useState([])
    const [lowStockProducts, setLowStockProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showOrderModal, setShowOrderModal] = useState(false)
    const [showCallModal, setShowCallModal] = useState(false)
    const [selectedSupplier, setSelectedSupplier] = useState(null)
    const [editSupplier, setEditSupplier] = useState(null)
    const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', phone: '', email: '', address: '', category: 'General' })
    const [orderItems, setOrderItems] = useState([])
    const [supplierProducts, setSupplierProducts] = useState([{ name: '', quantity: '', price: '' }])

    const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'

    // Load data from API
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [suppliersData, ordersData, productsData] = await Promise.all([
                api.getSuppliers().catch(() => []),
                api.getPurchaseOrders().catch(() => []),
                api.getProducts().catch(() => ({ products: [] }))
            ])
            setSuppliers(Array.isArray(suppliersData) ? suppliersData : [])
            setOrders(Array.isArray(ordersData) ? ordersData : [])

            // Get low stock products
            const products = productsData?.products || []
            const lowStock = products.filter(p => (p.stock || 0) <= (p.min_stock || p.minStock || 10))
            setLowStockProducts(lowStock)
        } catch (error) {
            console.error('Error loading suppliers:', error)
        } finally {
            setLoading(false)
        }
    }

    // Stats
    const totalPending = suppliers.reduce((sum, s) => sum + (s.pending_amount || s.pendingAmount || 0), 0) || 0
    const pendingOrders = orders.filter(o => o.status === 'pending').length
    const totalSuppliers = suppliers.length

    // Filter
    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(search.toLowerCase())) ||
        (s.contact && s.contact.toLowerCase().includes(search.toLowerCase()))
    )

    const handleAddSupplier = async () => {
        if (!newSupplier.name || !newSupplier.phone) {
            addToast('Name and phone are required', 'error')
            return
        }

        // BUG-004: Validate phone
        const cleanPhone = newSupplier.phone.replace(/\D/g, '')
        if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
            addToast('Phone must be 10 digits starting with 6, 7, 8, or 9', 'error')
            return
        }

        try {
            const supplier = await api.createSupplier({ ...newSupplier, phone: cleanPhone })
            setSuppliers([supplier, ...suppliers])
            setNewSupplier({ name: '', contact: '', phone: '', email: '', address: '', category: 'General' })
            setShowAddModal(false)
            addToast('Supplier added successfully!', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to add supplier', 'error')
        }
    }

    const handleEditSupplier = (supplier) => {
        setEditSupplier({ ...supplier })
        setShowEditModal(true)
    }

    const handleUpdateSupplier = async () => {
        if (!editSupplier?.name || !editSupplier?.phone) {
            addToast('Name and phone are required', 'error')
            return
        }

        // BUG-004: Validate phone
        const cleanPhone = editSupplier.phone.replace(/\D/g, '')
        if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
            addToast('Phone must be 10 digits starting with 6, 7, 8, or 9', 'error')
            return
        }

        try {
            const updated = await api.updateSupplier(editSupplier.id, editSupplier)
            setSuppliers(suppliers.map(s => s.id === editSupplier.id ? updated : s))
            setShowEditModal(false)
            setEditSupplier(null)
            addToast('Supplier updated successfully!', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to update supplier', 'error')
        }
    }

    const handleDeleteSupplier = async (supplierId) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) return

        try {
            await api.deleteSupplier(supplierId)
            setSuppliers(suppliers.filter(s => s.id !== supplierId))
            addToast('Supplier deleted', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to delete supplier', 'error')
        }
    }

    const handleCall = (supplier) => {
        setSelectedSupplier(supplier)
        setShowCallModal(true)
    }

    const makePhoneCall = () => {
        if (selectedSupplier) {
            window.location.href = `tel:+91${selectedSupplier.phone}`
            addToast(`Calling ${selectedSupplier.contact}...`, 'info')
            setShowCallModal(false)
        }
    }

    const sendWhatsAppMessage = () => {
        if (selectedSupplier) {
            const message = `Hi ${selectedSupplier.contact}, this is from ${storeName}. I'd like to discuss a stock order.`
            whatsappService.openWhatsApp(selectedSupplier.phone, message)
            setShowCallModal(false)
        }
    }

    const sendEmail = () => {
        if (selectedSupplier?.email) {
            window.location.href = `mailto:${selectedSupplier.email}?subject=Stock Order Inquiry - ${storeName}`
            setShowCallModal(false)
        }
    }

    const createPurchaseOrder = async () => {
        if (!selectedSupplier) {
            addToast('Please select a supplier', 'error')
            return
        }

        try {
            // Create order data
            const orderData = {
                supplier_id: selectedSupplier.id,
                items: orderItems.length > 0 ? orderItems.map(item => ({
                    product_name: item.name,
                    quantity: item.qty || 1,
                    unit: item.unit || 'pcs',
                    unit_price: item.price || 0
                })) : lowStockProducts.map(p => ({
                    product_name: p.name,
                    quantity: p.suggestedQty || 20,
                    unit: p.unit || 'kg',
                    unit_price: p.price || 100
                })),
                notes: `Order placed from ${storeName}`
            }

            const newOrder = await api.createPurchaseOrder(orderData)
            setOrders([newOrder, ...orders])

            // Send WhatsApp notification to supplier
            if (selectedSupplier.phone) {
                const items = orderItems.length > 0 ? orderItems : lowStockProducts
                whatsappService.sendStockOrder(selectedSupplier, items, storeName)
            }

            addToast(`Purchase order ${newOrder.order_no} created!`, 'success')
            setShowOrderModal(false)
            setSelectedSupplier(null)
            setOrderItems([])
        } catch (error) {
            addToast(error.message || 'Failed to create order', 'error')
        }
    }

    const renderStars = (rating) => {
        const fullStars = Math.floor(rating)
        const hasHalf = rating % 1 >= 0.5
        return (
            <div className="stars">
                {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < fullStars ? 'star filled' : i === fullStars && hasHalf ? 'star half' : 'star'}>★</span>
                ))}
                <span className="rating-value">{rating}</span>
            </div>
        )
    }

    const markDelivered = async (orderId) => {
        try {
            const updated = await api.updateOrderStatus(orderId, 'delivered')
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
            addToast('Order marked as delivered ✅', 'success')
            // Refresh supplier data to update pending amounts
            loadData()
        } catch (error) {
            // Fallback to local update if API fails
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
            addToast('Order marked as delivered (will sync later)', 'warning')
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <Loader2 className="spin" size={48} />
                <p>Loading suppliers...</p>
                <style>{`
                    .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; gap: 16px; }
                    .loading-container .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        )
    }

    return (
        <div className="suppliers-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🚚 Supplier Management</h1>
                    <p className="page-subtitle">Manage vendors and purchase orders</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowOrderModal(true)}>
                        <Package size={18} /> New Order
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Add Supplier
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="supplier-stats">
                <div className="stat-card">
                    <Truck size={24} />
                    <div>
                        <span className="value">{totalSuppliers}</span>
                        <span className="label">Total Suppliers</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Package size={24} />
                    <div>
                        <span className="value">{orders.length}</span>
                        <span className="label">Purchase Orders</span>
                    </div>
                </div>
                <div className="stat-card warning">
                    <Clock size={24} />
                    <div>
                        <span className="value">{pendingOrders}</span>
                        <span className="label">Pending Orders</span>
                    </div>
                </div>
                <div className="stat-card">
                    <TrendingUp size={24} />
                    <div>
                        <span className="value">₹{(totalPending || 0).toLocaleString()}</span>
                        <span className="label">Payables</span>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
                <div className="low-stock-alert">
                    <AlertTriangle size={20} />
                    <span><strong>{lowStockProducts.length} products</strong> are running low on stock. Quick order?</span>
                    <button className="btn btn-sm btn-warning" onClick={() => setShowOrderModal(true)}>
                        <ShoppingCart size={14} /> Order Now
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="card search-bar">
                <div className="search-input">
                    <Search size={18} className="icon" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search suppliers by name, category, or contact..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Suppliers Grid */}
            <div className="suppliers-grid">
                {filteredSuppliers.map(supplier => (
                    <div key={supplier.id} className="supplier-card">
                        <div className="supplier-header">
                            <div className="supplier-avatar">{supplier.name.charAt(0)}</div>
                            <div className="supplier-info">
                                <h3>{supplier.name}</h3>
                                <span className="category-badge">{supplier.category}</span>
                            </div>
                        </div>

                        <div className="supplier-details">
                            <div className="detail-row">
                                <Phone size={14} />
                                <span>{supplier.contact} • {supplier.phone}</span>
                            </div>
                            <div className="detail-row">
                                <MapPin size={14} />
                                <span>{supplier.address}</span>
                            </div>
                            {supplier.email && (
                                <div className="detail-row">
                                    <Mail size={14} />
                                    <span>{supplier.email}</span>
                                </div>
                            )}
                        </div>

                        {renderStars(supplier.rating)}

                        <div className="supplier-meta">
                            <div className="meta-item">
                                <span className="meta-value">{supplier.totalOrders || supplier.total_orders || 0}</span>
                                <span className="meta-label">Orders</span>
                            </div>
                            <div className="meta-item">
                                <span className={`meta-value ${(supplier.pendingAmount || supplier.pending_amount || 0) > 0 ? 'pending' : ''}`}>
                                    ₹{(supplier.pendingAmount || supplier.pending_amount || 0).toLocaleString()}
                                </span>
                                <span className="meta-label">Pending</span>
                            </div>
                            {(supplier.lastOrder || supplier.last_order) && (
                                <div className="meta-item">
                                    <span className="meta-value">{new Date(supplier.lastOrder || supplier.last_order).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                    <span className="meta-label">Last Order</span>
                                </div>
                            )}
                        </div>

                        <div className="supplier-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => { setSelectedSupplier(supplier); setShowOrderModal(true); }}>
                                <Package size={14} /> Order
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEditSupplier(supplier)}>
                                <Edit2 size={14} /> Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCall(supplier)}>
                                <Phone size={14} /> Call
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteSupplier(supplier.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Orders */}
            <div className="card mt-xl">
                <div className="card-header">
                    <h3 className="card-title"><Package size={20} /> Recent Purchase Orders</h3>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Order No</th>
                                <th>Supplier</th>
                                <th>Items</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td><code>{order.orderNo || order.order_no || `PO-${order.id}`}</code></td>
                                    <td>{order.supplier || order.supplier_name || suppliers.find(s => s.id === order.supplier_id)?.name || 'Unknown'}</td>
                                    <td>{(order.items?.length || order.item_count || order.items || 0)} items</td>
                                    <td className="amount">₹{(order.amount || order.total_amount || 0).toLocaleString()}</td>
                                    <td>{new Date(order.date || order.created_at).toLocaleDateString('en-IN')}</td>
                                    <td>
                                        <span className={`badge badge-${order.status === 'delivered' ? 'success' : order.status === 'pending' ? 'warning' : 'secondary'}`}>
                                            {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                                        </span>
                                    </td>
                                    <td>
                                        {order.status === 'pending' && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => markDelivered(order.id)}>
                                                <Check size={14} /> Received
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Supplier Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Supplier</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Business Name *</label>
                                <input type="text" className="form-input" placeholder="e.g., Metro Wholesale"
                                    value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Contact Person</label>
                                    <input type="text" className="form-input" placeholder="Name"
                                        value={newSupplier.contact} onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone *</label>
                                    <input type="tel" inputMode="numeric" className="form-input" placeholder="10-digit number"
                                        maxLength={10} value={newSupplier.phone} onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                                            setNewSupplier({ ...newSupplier, phone: cleaned })
                                        }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" placeholder="supplier@email.com"
                                    value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input type="text" className="form-input" placeholder="City, Area"
                                    value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-input" value={newSupplier.category} onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}>
                                    <option value="General">General</option>
                                    <option value="Grains">Grains</option>
                                    <option value="Dairy">Dairy</option>
                                    <option value="FMCG">FMCG</option>
                                    <option value="Beverages">Beverages</option>
                                    <option value="Vegetables">Vegetables</option>
                                </select>
                            </div>

                            {/* Products Section */}
                            <div className="form-section">
                                <div className="section-header">
                                    <label className="form-label">Products Supplied (Optional)</label>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setSupplierProducts([...supplierProducts, { name: '', quantity: '', price: '' }])}
                                    >
                                        <Plus size={14} /> Add Product
                                    </button>
                                </div>
                                {supplierProducts.map((product, index) => (
                                    <div key={index} className="product-row">
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Product name"
                                            value={product.name}
                                            onChange={(e) => {
                                                const updated = [...supplierProducts]
                                                updated[index].name = e.target.value
                                                setSupplierProducts(updated)
                                            }}
                                        />
                                        <input
                                            type="number"
                                            className="form-input small"
                                            placeholder="Qty"
                                            value={product.quantity}
                                            onChange={(e) => {
                                                const updated = [...supplierProducts]
                                                updated[index].quantity = e.target.value
                                                setSupplierProducts(updated)
                                            }}
                                        />
                                        <input
                                            type="number"
                                            className="form-input small"
                                            placeholder="Price ₹"
                                            value={product.price}
                                            onChange={(e) => {
                                                const updated = [...supplierProducts]
                                                updated[index].price = e.target.value
                                                setSupplierProducts(updated)
                                            }}
                                        />
                                        {supplierProducts.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm text-danger"
                                                onClick={() => {
                                                    setSupplierProducts(supplierProducts.filter((_, i) => i !== index))
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddSupplier}>
                                Add Supplier
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Supplier Modal */}
            {showEditModal && editSupplier && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Supplier</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Company Name *</label>
                                    <input type="text" className="form-input" placeholder="Supplier Company Name"
                                        value={editSupplier.name} onChange={(e) => setEditSupplier({ ...editSupplier, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Person</label>
                                    <input type="text" className="form-input" placeholder="Contact Name"
                                        value={editSupplier.contact || ''} onChange={(e) => setEditSupplier({ ...editSupplier, contact: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Phone *</label>
                                    <input type="tel" inputMode="numeric" className="form-input" placeholder="10-digit number"
                                        maxLength={10} value={editSupplier.phone} onChange={(e) => {
                                            const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                                            setEditSupplier({ ...editSupplier, phone: cleaned })
                                        }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input type="email" className="form-input" placeholder="supplier@email.com"
                                        value={editSupplier.email || ''} onChange={(e) => setEditSupplier({ ...editSupplier, email: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input type="text" className="form-input" placeholder="City, Area"
                                    value={editSupplier.address || ''} onChange={(e) => setEditSupplier({ ...editSupplier, address: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-input" value={editSupplier.category || 'General'} onChange={(e) => setEditSupplier({ ...editSupplier, category: e.target.value })}>
                                    <option value="General">General</option>
                                    <option value="Grains">Grains</option>
                                    <option value="Dairy">Dairy</option>
                                    <option value="FMCG">FMCG</option>
                                    <option value="Beverages">Beverages</option>
                                    <option value="Vegetables">Vegetables</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleUpdateSupplier}>
                                Update Supplier
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {showCallModal && selectedSupplier && (
                <div className="modal-overlay" onClick={() => setShowCallModal(false)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Contact {selectedSupplier.name}</h3>
                            <button className="modal-close" onClick={() => setShowCallModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="contact-info">
                                <p><strong>Contact:</strong> {selectedSupplier.contact}</p>
                                <p><strong>Phone:</strong> {selectedSupplier.phone}</p>
                                {selectedSupplier.email && <p><strong>Email:</strong> {selectedSupplier.email}</p>}
                            </div>
                            <div className="contact-actions">
                                <button className="btn btn-primary contact-btn" onClick={makePhoneCall}>
                                    <Phone size={20} /> Call
                                </button>
                                <button className="btn btn-success contact-btn" onClick={sendWhatsAppMessage}>
                                    <MessageCircle size={20} /> WhatsApp
                                </button>
                                {selectedSupplier.email && (
                                    <button className="btn btn-secondary contact-btn" onClick={sendEmail}>
                                        <Mail size={20} /> Email
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Order Modal */}
            {showOrderModal && (
                <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create Purchase Order</h3>
                            <button className="modal-close" onClick={() => setShowOrderModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-subtitle">Select a supplier to create order</p>

                            {/* Low stock items to order */}
                            {lowStockProducts.length > 0 && (
                                <div className="low-stock-items">
                                    <h4><AlertTriangle size={16} /> Low Stock Items</h4>
                                    {lowStockProducts.map(product => (
                                        <div key={product.id} className="low-stock-item">
                                            <span>{product.name}</span>
                                            <span className="stock-warning">{product.stock}/{product.minStock} {product.unit}</span>
                                            <span className="suggested">Suggested: {product.suggestedQty} {product.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="supplier-select-list">
                                {suppliers.map(supplier => (
                                    <div
                                        key={supplier.id}
                                        className={`supplier-select-item ${selectedSupplier?.id === supplier.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedSupplier(supplier)}
                                    >
                                        <div className="supplier-avatar small">{supplier.name.charAt(0)}</div>
                                        <div>
                                            <span className="name">{supplier.name}</span>
                                            <span className="category">{supplier.category} • {supplier.contact}</span>
                                        </div>
                                        {selectedSupplier?.id === supplier.id && <Check size={18} className="check-icon" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createPurchaseOrder} disabled={!selectedSupplier}>
                                <MessageCircle size={16} /> Create & Send via WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .header-actions { display: flex; gap: 12px; }
        
        .supplier-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        @media (max-width: 1024px) { .supplier-stats { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card);
          border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
        }
        .stat-card svg { color: var(--primary-400); }
        .stat-card.warning svg { color: var(--warning); }
        .stat-card .value { font-size: 1.5rem; font-weight: 700; display: block; }
        .stat-card .label { font-size: 0.8125rem; color: var(--text-tertiary); }

        .low-stock-alert {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px; background: rgba(245, 158, 11, 0.1);
          border: 1px solid var(--warning); border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }
        .low-stock-alert svg { color: var(--warning); }

        .suppliers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }

        .supplier-card {
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl); padding: 20px;
          transition: all var(--transition-fast);
        }
        .supplier-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

        .supplier-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .supplier-avatar { 
          width: 48px; height: 48px; background: var(--gradient-primary);
          border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 1.25rem;
        }
        .supplier-avatar.small { width: 36px; height: 36px; font-size: 1rem; }
        .supplier-info h3 { margin: 0 0 4px; font-size: 1rem; }
        .category-badge { font-size: 0.75rem; padding: 2px 8px; background: var(--bg-tertiary); border-radius: var(--radius-sm); color: var(--text-secondary); }

        .supplier-details { margin-bottom: 12px; }
        .detail-row { display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 6px; }
        .detail-row svg { color: var(--text-tertiary); flex-shrink: 0; }

        .stars { display: flex; align-items: center; gap: 2px; margin-bottom: 16px; }
        .star { color: #d1d5db; font-size: 1rem; }
        .star.filled { color: #fbbf24; }
        .rating-value { margin-left: 8px; font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }

        .supplier-meta { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md); }
        .meta-item { text-align: center; }
        .meta-value { font-size: 1.125rem; font-weight: 700; display: block; }
        .meta-value.pending { color: var(--warning); }
        .meta-label { font-size: 0.75rem; color: var(--text-tertiary); }

        .supplier-actions { display: flex; gap: 8px; }
        .supplier-actions .btn { flex: 1; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .amount { font-weight: 600; }
        .mt-xl { margin-top: 32px; }

        .modal-sm { max-width: 360px; }
        .contact-info { padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-lg); margin-bottom: 20px; }
        .contact-info p { margin: 8px 0; }
        .contact-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .contact-btn { flex: 1; min-width: 100px; justify-content: center; }
        .btn-success { background: #25D366; border-color: #25D366; }
        .btn-success:hover { background: #1da851; }

        .low-stock-items { margin-bottom: 20px; padding: 16px; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius-lg); }
        .low-stock-items h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 0.875rem; color: var(--warning); }
        .low-stock-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); }
        .low-stock-item:last-child { border-bottom: none; }
        .stock-warning { color: var(--error); font-size: 0.8125rem; }
        .suggested { color: var(--success); font-size: 0.8125rem; }

        .supplier-select-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
        .supplier-select-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle); border-radius: var(--radius-lg);
          cursor: pointer; transition: all var(--transition-fast);
        }
        .supplier-select-item:hover { border-color: var(--primary-400); }
        .supplier-select-item.selected { border-color: var(--primary-400); background: rgba(249, 115, 22, 0.1); }
        .supplier-select-item .name { font-weight: 500; display: block; }
        .supplier-select-item .category { font-size: 0.75rem; color: var(--text-tertiary); }
        .check-icon { margin-left: auto; color: var(--primary-400); }
      `}</style>
        </div>
    )
}
