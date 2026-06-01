import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Package, AlertTriangle, TrendingUp, TrendingDown, Edit2, Trash2, X, Save, BarChart3, RefreshCw } from 'lucide-react'
import realDataService from '../services/realDataService'
import api from '../services/api'
import EmptyState from '../components/EmptyState'
import FloatingActionButton from '../components/FloatingActionButton'

const categories = ["All", "Grains", "Pulses", "Essentials", "Oils", "Beverages", "Dairy", "Snacks", "Packaged", "Household", "Personal Care", "General"]

// Smart category detection based on product name keywords
const CATEGORY_KEYWORDS = {
    Grains: ['rice', 'wheat', 'atta', 'maida', 'rava', 'sooji', 'ragi', 'bajra', 'jowar', 'corn', 'flour', 'basmati', 'sella', 'ponni', 'idli'],
    Pulses: ['dal', 'toor', 'chana', 'moong', 'urad', 'masoor', 'rajma', 'lentil', 'chickpea', 'peas', 'beans', 'lobia'],
    Oils: ['oil', 'ghee', 'butter', 'vanaspati', 'coconut oil', 'sunflower', 'mustard oil', 'sesame', 'groundnut'],
    Dairy: ['milk', 'curd', 'paneer', 'cheese', 'yogurt', 'cream', 'buttermilk', 'lassi', 'khoya'],
    Beverages: ['tea', 'coffee', 'juice', 'water', 'soda', 'cola', 'pepsi', 'sprite', 'drink', 'shake'],
    Essentials: ['salt', 'sugar', 'jaggery', 'turmeric', 'chilli', 'pepper', 'cumin', 'coriander', 'masala', 'spice', 'garam'],
    Snacks: ['chips', 'biscuit', 'cookie', 'namkeen', 'mixture', 'murukku', 'cake', 'chocolate', 'candy', 'sweet'],
    Packaged: ['noodle', 'maggi', 'pasta', 'sauce', 'ketchup', 'jam', 'pickle', 'papad', 'ready'],
    Household: ['soap', 'detergent', 'cleaner', 'broom', 'mop', 'tissue', 'foil', 'bag', 'candle', 'match'],
    'Personal Care': ['shampoo', 'toothpaste', 'brush', 'cream', 'lotion', 'powder', 'deodorant', 'razor', 'comb'],
}
function detectCategory(productName) {
    const name = (productName || '').toLowerCase()
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => name.includes(kw))) return cat
    }
    return 'General'
}

export default function Products({ addToast, setCurrentPage }) {
  const { t } = useTranslation()
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('All')
    const [showLowStock, setShowLowStock] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editProduct, setEditProduct] = useState(null)
    const [newProduct, setNewProduct] = useState({
        name: '', sku: '', price: '', unit: 'kg', stock: '', minStock: '', category: 'General', expiryDate: ''
    })
    const [stockAdjust, setStockAdjust] = useState(null) // { product, newStock, reason }
    const [showAuditLog, setShowAuditLog] = useState(false)

    useEffect(() => {
        loadProducts()
    }, [])

    const loadProducts = async () => {
        setLoading(true)

        try {
            // Always fetch from real API - no more demo mode
            const productList = await realDataService.getProducts()

            if (Array.isArray(productList) && productList.length > 0) {
                // Map API fields to component fields
                const mappedProducts = productList.map(p => ({
                    ...p,
                    price: p.price || p.selling_price || 0,
                    stock: p.stock || p.current_stock || 0,
                    minStock: p.minStock || p.min_stock_alert || 10,
                    dailySales: p.dailySales || p.daily_sales || 2,
                    trend: p.trend || 'stable',
                    // Smart category: use backend name if available, else auto-detect from product name
                    category: typeof p.category === 'string' && p.category !== 'General' ? p.category :
                        (p.category?.name || detectCategory(p.name))
                }))
                setProducts(mappedProducts)
            } else {
                // No products - show empty state
                setProducts([])
            }
        } catch (error) {
            console.error('Failed to load products:', error)
            addToast?.('Failed to load products', 'error')
            setProducts([])
        } finally {
            setLoading(false)
        }
    }

    // Calculate statistics
    const lowStockProducts = products.filter(p => p.stock <= p.minStock)
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0)
    const outOfStock = products.filter(p => p.stock === 0).length

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.sku?.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = category === 'All' || p.category === category
        const matchesLowStock = !showLowStock || p.stock <= p.minStock
        return matchesSearch && matchesCategory && matchesLowStock
    })

    // Calculate days until stockout
    const getDaysUntilStockout = (product) => {
        if (product.dailySales === 0) return '∞'
        const days = Math.floor(product.stock / product.dailySales)
        return days
    }

    // Stock status
    const getStockStatus = (product) => {
        if (product.stock === 0) return { status: 'out', label: 'Out of Stock', color: 'error' }
        if (product.stock <= product.minStock) return { status: 'low', label: 'Low Stock', color: 'warning' }
        return { status: 'ok', label: 'In Stock', color: 'success' }
    }

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.price || !newProduct.stock) {
            addToast('Please fill in all required fields', 'error')
            return
        }

        const productData = {
            name: newProduct.name,
            sku: newProduct.sku || `SKU${Date.now()}`,
            // Backend API fields (primary)
            selling_price: parseFloat(newProduct.price),
            cost_price: parseFloat(newProduct.price) * 0.8,
            current_stock: parseInt(newProduct.stock),
            min_stock_alert: parseInt(newProduct.minStock) || 10,
            unit: newProduct.unit || 'kg',
            category: newProduct.category || 'Essentials',
            category_id: null,
            description: newProduct.description || '',
            expiry_date: newProduct.expiryDate || null,
        }

        try {
            // Always use real API - no more demo mode
            const result = await api.createProduct(productData)

            // Map the result to our frontend format
            const mappedResult = {
                ...result,
                id: result.id,
                price: result.selling_price || parseFloat(newProduct.price),
                stock: result.current_stock ?? parseInt(newProduct.stock),
                minStock: result.min_stock_alert || parseInt(newProduct.minStock) || 10,
                category: result.category?.name || newProduct.category || 'General',
                dailySales: 2,
                trend: 'stable'
            }

            // Add to local state immediately for instant feedback
            setProducts(prevProducts => [mappedResult, ...prevProducts])
            addToast('✅ Product added successfully!', 'success')

            setShowAddModal(false)
            setNewProduct({ name: '', sku: '', price: '', unit: 'kg', stock: '', minStock: '', category: 'General', expiryDate: '' })

            // Refresh products list to ensure sync with backend
            setTimeout(() => loadProducts(), 500)
        } catch (error) {
            console.error('Failed to add product:', error)
            addToast(error.message || 'Failed to add product. Please try again.', 'error')
        }
    }

    const handleUpdateStock = async (id, newStock) => {
        try {
            await api.updateProduct(id, { stock: Math.max(0, newStock) })
            setProducts(products.map(p =>
                p.id === id ? { ...p, stock: Math.max(0, newStock) } : p
            ))
            addToast('Stock updated!', 'success')
        } catch (error) {
            addToast(error.message || 'Failed to update stock', 'error')
        }
    }

    const handleDeleteProduct = async (id) => {
        try {
            await api.deleteProduct(id)
            setProducts(products.filter(p => p.id !== id))
            addToast('Product deleted', 'info')
        } catch (error) {
            addToast(error.message || 'Failed to delete product', 'error')
        }
    }

    // Stock adjustment with audit trail
    const handleStockAdjustment = async (product, newStock, reason) => {
        const oldStock = product.stock
        try {
            await api.updateProduct(product.id, { current_stock: Math.max(0, newStock) })
            setProducts(products.map(p =>
                p.id === product.id ? { ...p, stock: Math.max(0, newStock) } : p
            ))
            // Save audit log
            const logs = JSON.parse(localStorage.getItem('kadai_stock_audit') || '[]')
            logs.unshift({
                id: Date.now(),
                product_name: product.name,
                product_id: product.id,
                old_stock: oldStock,
                new_stock: newStock,
                change: newStock - oldStock,
                reason: reason || 'Manual adjustment',
                user: localStorage.getItem('kadai_user_name') || 'Unknown',
                timestamp: new Date().toISOString()
            })
            // Keep last 200 entries
            localStorage.setItem('kadai_stock_audit', JSON.stringify(logs.slice(0, 200)))
            addToast(`Stock updated: ${product.name} ${oldStock} → ${newStock}`, 'success')
        } catch (error) {
            addToast(error.message || 'Failed to update stock', 'error')
        }
    }

    const getAuditLogs = () => JSON.parse(localStorage.getItem('kadai_stock_audit') || '[]')

    return (
        <div className="products-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📦 Inventory Management</h1>
                    <p className="page-subtitle">Track stock levels and manage your products</p>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowAuditLog(true)} style={{ marginRight: 8 }}>
                    📋 Audit Log
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} /> Add Product
                </button>
            </div>

            {/* Stats Cards */}
            <div className="inventory-stats">
                <div className="stat-card">
                    <Package size={24} />
                    <div>
                        <span className="stat-value">{products.length}</span>
                        <span className="stat-label">Total Products</span>
                    </div>
                </div>
                <div className="stat-card">
                    <BarChart3 size={24} />
                    <div>
                        <span className="stat-value">₹{totalValue.toLocaleString('en-IN')}</span>
                        <span className="stat-label">Inventory Value</span>
                    </div>
                </div>
                <div className="stat-card warning" onClick={() => setShowLowStock(!showLowStock)} style={{ cursor: 'pointer' }}>
                    <AlertTriangle size={24} />
                    <div>
                        <span className="stat-value">{lowStockProducts.length}</span>
                        <span className="stat-label">Low Stock Alerts</span>
                    </div>
                </div>
                <div className="stat-card error">
                    <TrendingDown size={24} />
                    <div>
                        <span className="stat-value">{outOfStock}</span>
                        <span className="stat-label">Out of Stock</span>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert Banner */}
            {lowStockProducts.length > 0 && (
                <div className="alert-banner">
                    <AlertTriangle size={20} />
                    <span><strong>{lowStockProducts.length} products</strong> need restocking: {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}{lowStockProducts.length > 3 ? '...' : ''}</span>
                    <button className="btn btn-sm btn-warning" onClick={() => setShowLowStock(true)}>View All</button>
                </div>
            )}

            {/* Filters */}
            <div className="card filters-bar">
                <div className="search-input">
                    <Search size={18} className="icon" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search products by name or SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="category-filters">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`category-btn ${category === cat ? 'active' : ''}`}
                            onClick={() => setCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <button className="btn btn-ghost" onClick={loadProducts}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
                <EmptyState
                    type="products"
                    onAction={() => setShowAddModal(true)}
                />
            ) : (
                <div className="products-grid">
                    {filteredProducts.map(product => {
                        const stockStatus = getStockStatus(product)
                        const daysLeft = getDaysUntilStockout(product)

                        return (
                            <div key={product.id} className={`product-card ${stockStatus.status}`}>
                                <div className="product-header">
                                    <span className="product-category">{product.category}</span>
                                    <span className={`stock-badge ${stockStatus.color}`}>{stockStatus.label}</span>
                                </div>

                                <h3 className="product-name">{product.name}</h3>
                                <p className="product-sku">{product.sku}</p>

                                <div className="product-price">
                                    <span className="price">₹{product.price}</span>
                                    <span className="unit">/{product.unit}</span>
                                </div>

                                <div className="stock-info">
                                    <div className="stock-bar-container">
                                        <div
                                            className={`stock-bar ${stockStatus.color}`}
                                            style={{ width: `${Math.min(100, (product.stock / (product.minStock || 10)) * 50)}%` }}
                                        ></div>
                                    </div>
                                    <div className="stock-numbers">
                                        <span className={`current ${product.stock === 0 ? 'out-of-stock' : product.stock <= product.minStock ? 'low-stock' : ''}`}>
                                            {product.stock} {product.unit}
                                            {product.stock <= product.minStock && product.stock > 0 && ' ⚠️'}
                                            {product.stock === 0 && ' ❌'}
                                        </span>
                                        <span className={`min ${product.stock <= product.minStock ? 'critical' : ''}`}>
                                            Min: {product.minStock || 10}
                                        </span>
                                    </div>
                                </div>

                                <div className="product-prediction">
                                    <div className={`trend ${product.trend}`}>
                                        {product.trend === 'up' ? <TrendingUp size={14} /> : product.trend === 'down' ? <TrendingDown size={14} /> : '→'}
                                        <span>{product.dailySales || 0}/day</span>
                                    </div>
                                    <div className={`days-left ${daysLeft !== '∞' && parseInt(daysLeft) <= 7 ? 'critical' : ''}`}>
                                        {daysLeft === '∞' ? 'No sales data' : `${daysLeft} days left`}
                                    </div>
                                </div>

                                <div className="product-actions">
                                    <div className="quick-stock">
                                        <button onClick={() => setStockAdjust({ product, newStock: product.stock - 1, reason: '' })}>−</button>
                                        <span style={{ cursor: 'pointer' }} onClick={() => setStockAdjust({ product, newStock: product.stock, reason: '' })}>{product.stock}</span>
                                        <button onClick={() => setStockAdjust({ product, newStock: product.stock + 1, reason: '' })}>+</button>
                                    </div>
                                    <div className="action-btns">
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditProduct(product)}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteProduct(product.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {products.length > 0 && filteredProducts.length === 0 && (
                <div className="empty-state">
                    <Package size={64} />
                    <h3>No products found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            )}

            {/* Add Product Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Product</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Product Name *</label>
                                    <input type="text" className="form-input" placeholder="e.g., Basmati Rice"
                                        value={newProduct.name} onChange={(e) => {
                                            const name = e.target.value
                                            const autoCategory = detectCategory(name)
                                            setNewProduct({ ...newProduct, name, category: autoCategory })
                                        }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SKU</label>
                                    <input type="text" className="form-input" placeholder="e.g., SKU001"
                                        value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Price (₹) *</label>
                                    <input type="number" className="form-input" placeholder="0"
                                        value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unit</label>
                                    <select className="form-input" value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}>
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="L">L</option>
                                        <option value="ml">ml</option>
                                        <option value="pcs">pcs</option>
                                        <option value="pack">pack</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Current Stock *</label>
                                    <input type="number" className="form-input" placeholder="0"
                                        value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Minimum Stock Level</label>
                                    <input type="number" className="form-input" placeholder="10"
                                        value={newProduct.minStock} onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-input" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}>
                                    {categories.filter(c => c !== 'All').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Expiry Date <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>(optional)</span></label>
                                <input type="date" className="form-input"
                                    value={newProduct.expiryDate}
                                    onChange={(e) => setNewProduct({ ...newProduct, expiryDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                {newProduct.expiryDate && (() => {
                                    const daysLeft = Math.ceil((new Date(newProduct.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
                                    return daysLeft <= 30 ? (
                                        <span style={{ fontSize: '0.75rem', color: daysLeft <= 7 ? '#ef4444' : '#f59e0b', marginTop: 4, display: 'block' }}>
                                            ⚠️ {daysLeft <= 0 ? 'Already expired!' : `Expires in ${daysLeft} days`}
                                        </span>
                                    ) : null
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddProduct} disabled={!newProduct.name || !newProduct.price}>
                                <Save size={18} /> Add Product
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Product Modal */}
            {editProduct && (
                <div className="modal-overlay" onClick={() => setEditProduct(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">✏️ Edit Product</h3>
                            <button className="modal-close" onClick={() => setEditProduct(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Product Name *</label>
                                    <input type="text" className="form-input"
                                        value={editProduct.name}
                                        onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SKU</label>
                                    <input type="text" className="form-input"
                                        value={editProduct.sku || ''}
                                        onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Price (₹) *</label>
                                    <input type="number" className="form-input"
                                        value={editProduct.price || editProduct.selling_price || ''}
                                        onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unit</label>
                                    <select className="form-input" value={editProduct.unit || 'kg'} onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })}>
                                        <option value="kg">kg</option>
                                        <option value="g">g</option>
                                        <option value="L">L</option>
                                        <option value="ml">ml</option>
                                        <option value="pcs">pcs</option>
                                        <option value="pack">pack</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Current Stock *</label>
                                    <input type="number" className="form-input"
                                        value={editProduct.stock ?? editProduct.current_stock ?? ''}
                                        onChange={(e) => setEditProduct({ ...editProduct, stock: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Minimum Stock</label>
                                    <input type="number" className="form-input"
                                        value={editProduct.minStock ?? editProduct.min_stock_alert ?? 10}
                                        onChange={(e) => setEditProduct({ ...editProduct, minStock: parseInt(e.target.value) || 10 })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select className="form-input" value={editProduct.category || 'General'} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}>
                                    {categories.filter(c => c !== 'All').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditProduct(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={async () => {
                                try {
                                    await api.updateProduct(editProduct.id, {
                                        name: editProduct.name,
                                        sku: editProduct.sku,
                                        selling_price: parseFloat(editProduct.price || editProduct.selling_price),
                                        current_stock: parseInt(editProduct.stock ?? editProduct.current_stock),
                                        min_stock_alert: parseInt(editProduct.minStock ?? editProduct.min_stock_alert ?? 10),
                                        unit: editProduct.unit,
                                        category: editProduct.category,
                                    })
                                    addToast('✅ Product updated!', 'success')
                                    setEditProduct(null)
                                    loadProducts()
                                } catch (error) {
                                    addToast(error.message || 'Failed to update product', 'error')
                                }
                            }} disabled={!editProduct.name}>
                                <Save size={18} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {stockAdjust && (
                <div className="modal-overlay" onClick={() => setStockAdjust(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📦 Adjust Stock</h3>
                            <button className="modal-close" onClick={() => setStockAdjust(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <strong>{stockAdjust.product.name}</strong> — Current: {stockAdjust.product.stock} {stockAdjust.product.unit}
                            </p>
                            <div className="form-group">
                                <label className="form-label">New Stock Quantity</label>
                                <input type="number" className="form-input" min="0"
                                    value={stockAdjust.newStock}
                                    onChange={e => setStockAdjust({ ...stockAdjust, newStock: parseInt(e.target.value) || 0 })}
                                    autoFocus
                                />
                                {stockAdjust.newStock !== stockAdjust.product.stock && (
                                    <span style={{ fontSize: '0.8rem', color: stockAdjust.newStock > stockAdjust.product.stock ? '#16a34a' : '#ef4444', marginTop: 4, display: 'block' }}>
                                        {stockAdjust.newStock > stockAdjust.product.stock ? '+' : ''}{stockAdjust.newStock - stockAdjust.product.stock} {stockAdjust.product.unit}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason for Adjustment</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {['New Stock Received', 'Damaged/Expired', 'Physical Count', 'Return from Customer', 'Correction'].map(r => (
                                        <button key={r}
                                            style={{
                                                padding: '4px 10px', fontSize: '0.75rem',
                                                border: `1px solid ${stockAdjust.reason === r ? '#ea580c' : 'var(--border-subtle)'}`,
                                                borderRadius: 4, cursor: 'pointer',
                                                background: stockAdjust.reason === r ? 'rgba(234,88,12,0.1)' : 'var(--bg-primary)',
                                                color: stockAdjust.reason === r ? '#ea580c' : 'var(--text-secondary)'
                                            }}
                                            onClick={() => setStockAdjust({ ...stockAdjust, reason: r })}
                                        >{r}</button>
                                    ))}
                                </div>
                                <input type="text" className="form-input" placeholder="Or type a custom reason..."
                                    value={stockAdjust.reason} onChange={e => setStockAdjust({ ...stockAdjust, reason: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setStockAdjust(null)}>Cancel</button>
                            <button className="btn btn-primary"
                                disabled={!stockAdjust.reason || stockAdjust.newStock === stockAdjust.product.stock}
                                onClick={() => {
                                    handleStockAdjustment(stockAdjust.product, stockAdjust.newStock, stockAdjust.reason)
                                    setStockAdjust(null)
                                }}
                            >
                                <Save size={18} /> Update Stock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Audit Log Modal */}
            {showAuditLog && (
                <div className="modal-overlay" onClick={() => setShowAuditLog(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📋 Stock Adjustment Log</h3>
                            <button className="modal-close" onClick={() => setShowAuditLog(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {getAuditLogs().length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>No stock adjustments recorded yet.</p>
                            ) : (
                                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left' }}>
                                            <th style={{ padding: '8px 6px' }}>Time</th>
                                            <th style={{ padding: '8px 6px' }}>Product</th>
                                            <th style={{ padding: '8px 6px' }}>Change</th>
                                            <th style={{ padding: '8px 6px' }}>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getAuditLogs().slice(0, 50).map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <td style={{ padding: '6px', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>
                                                    {new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                                                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ padding: '6px', fontWeight: 500 }}>{log.product_name}</td>
                                                <td style={{ padding: '6px' }}>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>{log.old_stock}</span>
                                                    {' → '}
                                                    <span style={{ fontWeight: 600 }}>{log.new_stock}</span>
                                                    <span style={{ marginLeft: 6, fontSize: '0.75rem', fontWeight: 700, color: log.change > 0 ? '#16a34a' : '#ef4444' }}>
                                                        {log.change > 0 ? `+${log.change}` : log.change}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>{log.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => {
                                if (confirm('Clear all audit logs?')) {
                                    localStorage.removeItem('kadai_stock_audit')
                                    setShowAuditLog(false)
                                    addToast('Audit log cleared', 'info')
                                }
                            }}>Clear Log</button>
                            <button className="btn btn-secondary" onClick={() => setShowAuditLog(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .inventory-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        @media (max-width: 900px) { .inventory-stats { grid-template-columns: repeat(2, 1fr); } }
        .stat-card { 
          display: flex; align-items: center; gap: 16px;
          padding: 20px; background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }
        .stat-card svg { color: var(--primary-400); }
        .stat-card.warning svg { color: var(--warning); }
        .stat-card.error svg { color: var(--error); }
        .stat-value { font-size: 1.5rem; font-weight: 700; display: block; }
        .stat-label { font-size: 0.8125rem; color: var(--text-tertiary); }

        .alert-banner {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; background: rgba(245, 158, 11, 0.1);
          border: 1px solid var(--warning); border-radius: var(--radius-lg);
          margin-bottom: 20px; color: var(--warning);
        }
        .alert-banner span { flex: 1; }

        .filters-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .category-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .category-btn {
          padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md); cursor: pointer; font-size: 0.875rem;
          transition: all var(--transition-fast); color: var(--text-secondary);
        }
        .category-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .category-btn.active { background: var(--primary-500); color: white; border-color: var(--primary-500); }

        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

        .product-card {
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl); padding: 20px;
          transition: all var(--transition-fast);
        }
        .product-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .product-card.low { border-left: 3px solid var(--warning); }
        .product-card.out { border-left: 3px solid var(--error); opacity: 0.8; }

        .product-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .product-category { font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; }
        .stock-badge { font-size: 0.6875rem; padding: 4px 8px; border-radius: var(--radius-sm); font-weight: 600; }
        .stock-badge.success { background: rgba(34, 197, 94, 0.15); color: var(--success); }
        .stock-badge.warning { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
        .stock-badge.error { background: rgba(239, 68, 68, 0.15); color: var(--error); }

        .product-name { font-size: 1.125rem; font-weight: 600; margin-bottom: 4px; }
        .product-sku { font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 12px; }
        .product-price { margin-bottom: 16px; }
        .product-price .price { font-size: 1.5rem; font-weight: 700; color: var(--primary-400); }
        .product-price .unit { color: var(--text-tertiary); }

        .stock-info { margin-bottom: 16px; }
        .stock-bar-container { height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
        .stock-bar { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        .stock-bar.success { background: var(--success); }
        .stock-bar.warning { background: var(--warning); }
        .stock-bar.error { background: var(--error); animation: pulse-error 1.5s infinite; }
        @keyframes pulse-error {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .stock-numbers { display: flex; justify-content: space-between; font-size: 0.8125rem; }
        .stock-numbers .current { font-weight: 600; }
        .stock-numbers .current.low-stock { color: var(--warning); font-weight: 700; }
        .stock-numbers .current.out-of-stock { color: var(--error); font-weight: 700; animation: blink 1s infinite; }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .stock-numbers .min { color: var(--text-tertiary); }
        .stock-numbers .min.critical { color: var(--error); font-weight: 600; }

        .product-prediction { display: flex; justify-content: space-between; margin-bottom: 16px; padding: 10px; background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: 0.8125rem; }
        .trend { display: flex; align-items: center; gap: 4px; }
        .trend.up { color: var(--success); }
        .trend.down { color: var(--error); }
        .days-left { color: var(--text-secondary); }
        .days-left.critical { color: var(--error); font-weight: 600; }

        .product-actions { display: flex; justify-content: space-between; align-items: center; }
        .quick-stock { display: flex; align-items: center; gap: 8px; }
        .quick-stock button { 
          width: 32px; height: 32px; border-radius: var(--radius-md);
          background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
          cursor: pointer; font-size: 1.25rem; color: var(--text-primary);
          transition: all var(--transition-fast);
        }
        .quick-stock button:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .quick-stock span { font-weight: 600; min-width: 40px; text-align: center; }
        .action-btns { display: flex; gap: 4px; }

        .empty-state { text-align: center; padding: 60px; color: var(--text-tertiary); }
        .empty-state svg { opacity: 0.3; margin-bottom: 16px; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        /* Low stock notification badge */
        .low-stock-indicator {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 12px;
          height: 12px;
          background: var(--error);
          border-radius: 50%;
          animation: pulse-error 1.5s infinite;
        }
      `}</style>
        </div>
    )
}
