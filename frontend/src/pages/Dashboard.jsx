import { useState, useEffect } from 'react'
import { TrendingUp, ShoppingBag, Users, AlertTriangle, IndianRupee, FileText, Package, Plus, RefreshCw, ArrowUpRight, UserPlus, Settings, Store, ChevronRight } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function Dashboard({ addToast, setCurrentPage }) {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayBills: 0,
    avgBillValue: 0,
    lowStockCount: 0,
    totalCustomers: 0,
    creditPending: 0
  })
  const [products, setProducts] = useState([])
  const [bills, setBills] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const userRole = localStorage.getItem('kadai_user_role') || 'owner'
  const storeName = localStorage.getItem('kadai_store_name') || 'My Store'
  const userPlan = localStorage.getItem('kadai_plan') || 'free'

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const [statsData, productsData, billsData] = await Promise.all([
        realDataService.getDashboardStats().catch(() => ({})),
        realDataService.getProducts().catch(() => []),
        realDataService.getBills({ limit: 5 }).catch(() => [])
      ])

      setStats({
        todaySales: statsData.todaySales || 0,
        todayBills: statsData.todayBills || billsData.length || 0,
        avgBillValue: statsData.avgBillValue || 0,
        lowStockCount: Array.isArray(productsData) ? productsData.filter(p => p.stock <= p.minStock).length : 0,
        totalCustomers: statsData.totalCustomers || 0,
        creditPending: statsData.creditPending || 0
      })

      setProducts(Array.isArray(productsData) ? productsData : [])
      setBills(Array.isArray(billsData) ? billsData : [])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (n) => `₹${(n || 0).toLocaleString('en-IN')}`
  const formatTime = () => currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const formatDate = () => currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

  const lowStockProducts = products.filter(p => p.stock <= (p.minStock || 5))

  const refresh = () => {
    setIsRefreshing(true)
    realDataService.invalidateCache()
    loadDashboardData().finally(() => {
      setIsRefreshing(false)
      addToast('Dashboard refreshed', 'success')
    })
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const getGreetingEmoji = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return '☀️'
    if (hour < 17) return '🌤️'
    return '🌙'
  }

  return (
    <div className="dash">
      {/* Header — "Aaj Ka Hisaab" design */}
      <header className="dash-header">
        <div>
          <h1>{getGreeting()}! {getGreetingEmoji()}</h1>
          <p>{storeName} • {formatDate()}</p>
        </div>
        <div className="dash-time">
          <span>{formatTime()}</span>
          <button onClick={refresh} className={isRefreshing ? 'spinning' : ''} aria-label="Refresh dashboard">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Hero Revenue Card — ONE big number (UX Rule: Owner mental model) */}
      {(userRole === 'owner' || userRole === 'admin' || userRole === 'manager') && (
        <div className="revenue-hero" style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRadius: '20px', padding: '28px 24px', color: 'white',
          marginBottom: '16px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '4px', fontWeight: 500 }}>
              📊 Today's Sales
            </p>
            <div className="currency-display currency-big" style={{ color: '#fbbf24', fontSize: '40px', fontWeight: 800 }}>
              {formatCurrency(stats.todaySales)}
            </div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '14px', opacity: 0.9 }}>
              <span>🧾 {stats.todayBills} bills</span>
              <span>📊 Avg {formatCurrency(stats.avgBillValue)}</span>
            </div>
          </div>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: '-30px', right: '-30px',
            width: '120px', height: '120px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-20px', right: '40px',
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }} />
        </div>
      )}

      {/* Low Stock Alert Banner */}
      {lowStockProducts.length > 0 && (
        <div className="low-stock-alert">
          <div className="alert-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="alert-content">
            <strong>⚠️ {lowStockProducts.length} items are low on stock!</strong>
            <span>{lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}{lowStockProducts.length > 3 ? ` +${lowStockProducts.length - 3} more` : ''}</span>
          </div>
          <button className="alert-btn" onClick={() => setCurrentPage('products')} aria-label="View low stock products">
            Reorder →
          </button>
        </div>
      )}

      {/* Quick Access - Only items NOT in navbar */}
      <section className="role-quick-access">
        {/* Cashier - Just quick New Bill */}
        {(userRole === 'cashier' || userRole === 'staff') && (
          <div className="quick-access-inline">
            <button className="qa-btn-inline primary" onClick={() => setCurrentPage('create-bill')}>
              <Plus size={18} /> New Bill
            </button>
            <span className="qa-hint">Use navbar for Products, Customers, Bills</span>
          </div>
        )}

        {/* Manager - Staff access */}
        {userRole === 'manager' && (
          <div className="quick-access-inline">
            <button className="qa-btn-inline primary" onClick={() => setCurrentPage('create-bill')}>
              <Plus size={18} /> New Bill
            </button>
            <button className="qa-btn-inline" onClick={() => setCurrentPage('staff')}>
              <UserPlus size={18} /> Staff
            </button>
          </div>
        )}

        {/* Owner - Staff, Stores, Upgrade only */}
        {(userRole === 'owner' || userRole === 'admin') && (
          <div className="quick-access-inline owner">
            <span className="role-label">👑 Owner</span>
            <span className={`plan-badge ${userPlan}`}>{userPlan.toUpperCase()}</span>
            <div className="qa-buttons">
              <button className="qa-btn-inline" onClick={() => setCurrentPage('staff')}>
                <UserPlus size={18} /> Staff
              </button>
              <button className="qa-btn-inline" onClick={() => setCurrentPage('stores')}>
                <Store size={18} /> Stores
              </button>
              {userPlan === 'free' && (
                <button className="qa-btn-inline upgrade" onClick={() => setCurrentPage('subscription')}>
                  <ChevronRight size={18} /> Upgrade
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="dash-stats">
        <div className="stat-card green">
          <IndianRupee size={20} />
          <div>
            <strong>{formatCurrency(stats.todaySales)}</strong>
            <span>Today's Sales</span>
          </div>
          <ArrowUpRight className="trend" size={16} />
        </div>
        <div className="stat-card blue">
          <ShoppingBag size={20} />
          <div>
            <strong>{stats.todayBills}</strong>
            <span>Bills Today</span>
          </div>
        </div>
        <div className="stat-card purple">
          <TrendingUp size={20} />
          <div>
            <strong>{formatCurrency(stats.avgBillValue)}</strong>
            <span>Avg Bill</span>
          </div>
        </div>
        {stats.lowStockCount > 0 && (
          <div className="stat-card red clickable" onClick={() => setCurrentPage('products')}>
            <AlertTriangle size={20} />
            <div>
              <strong>{stats.lowStockCount}</strong>
              <span>Low Stock</span>
            </div>
          </div>
        )}
      </section>

      {/* Main Grid */}
      <section className="dash-grid">
        {/* Recent Bills */}
        <div className="dash-card">
          <div className="card-head">
            <h3><FileText size={16} /> Recent Bills</h3>
            <button onClick={() => setCurrentPage('bills')}>View All</button>
          </div>
          {bills.length > 0 ? (
            <div className="bills-list">
              {bills.slice(0, 5).map(bill => (
                <div key={bill.id} className="bill-row">
                  <div>
                    <strong>#{bill.bill_number || bill.id}</strong>
                    <span>{bill.customer_name || 'Walk-in'}</span>
                  </div>
                  <div className="bill-amt">
                    <strong>{formatCurrency(bill.total || bill.amount)}</strong>
                    <span className={`badge ${(bill.payment_mode || 'cash').toLowerCase()}`}>
                      {bill.payment_mode || 'Cash'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <FileText size={40} />
              <p>No bills yet</p>
              <button onClick={() => setCurrentPage('create-bill')}>Create First Bill</button>
            </div>
          )}
        </div>

        {/* Low Stock */}
        {lowStockProducts.length > 0 && (
          <div className="dash-card warning">
            <div className="card-head">
              <h3><AlertTriangle size={16} /> Low Stock</h3>
              <span className="count">{lowStockProducts.length}</span>
            </div>
            <div className="stock-list">
              {lowStockProducts.slice(0, 5).map(p => (
                <div key={p.id} className="stock-row">
                  <span>{p.name}</span>
                  <span className={p.stock === 0 ? 'out' : 'low'}>{p.stock} left</span>
                </div>
              ))}
              {lowStockProducts.length > 5 && (
                <button className="more" onClick={() => setCurrentPage('products')}>
                  +{lowStockProducts.length - 5} more items
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <style>{`
        .dash { max-width: 1200px; margin: 0 auto; }

        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .dash-header h1 { font-size: 1.75rem; margin: 0 0 4px; }
        .dash-header p { color: var(--text-secondary); margin: 0; }
        .dash-time { display: flex; align-items: center; gap: 12px; }
        .dash-time span { font-size: 1.5rem; font-weight: 600; }
        .dash-time button {
          width: 36px; height: 36px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }
        .dash-time button:hover { background: var(--primary-500); color: white; border-color: var(--primary-500); }
        .dash-time button.spinning svg { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Low Stock Alert Banner */
        .low-stock-alert {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06));
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 14px;
          margin-bottom: 20px;
        }
        .alert-icon {
          width: 40px;
          height: 40px;
          background: rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
        }
        .alert-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .alert-content strong { color: #ef4444; font-size: 0.95rem; }
        .alert-content span { color: var(--text-secondary); font-size: 0.8rem; }
        .alert-btn {
          padding: 10px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .alert-btn:hover { background: #dc2626; }

        /* Simple Inline Quick Access */
        .role-quick-access {
          margin-bottom: 20px;
        }
        .quick-access-inline {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          flex-wrap: wrap;
        }
        .quick-access-inline.owner {
          border-color: rgba(251, 146, 60, 0.3);
          background: linear-gradient(135deg, var(--bg-card), rgba(251, 146, 60, 0.03));
        }
        .role-label {
          font-weight: 700;
          font-size: 0.9rem;
        }
        .qa-hint {
          font-size: 0.8rem;
          color: var(--text-tertiary);
        }
        .qa-buttons {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        .qa-btn-inline {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary);
          transition: all 0.2s;
        }
        .qa-btn-inline:hover {
          border-color: var(--primary-400);
          background: var(--primary-500);
          color: white;
        }
        .qa-btn-inline.primary {
          background: var(--primary-500);
          border-color: var(--primary-500);
          color: white;
        }
        .qa-btn-inline.upgrade {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border-color: #8b5cf6;
          color: white;
        }
        .qa-btn.upgrade small { color: rgba(255,255,255,0.8); }

        .dash-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .dash-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .dash-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .dash-btn.primary {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          border: none;
        }
        .dash-btn.primary:hover { opacity: 0.9; transform: translateY(-1px); }

        .dash-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
        }
        .stat-card svg:first-child {
          width: 44px; height: 44px;
          padding: 10px;
          border-radius: 12px;
        }
        .stat-card.green svg:first-child { background: #22c55e20; color: #22c55e; }
        .stat-card.blue svg:first-child { background: #3b82f620; color: #3b82f6; }
        .stat-card.purple svg:first-child { background: #8b5cf620; color: #8b5cf6; }
        .stat-card.red svg:first-child { background: #ef444420; color: #ef4444; }
        .stat-card div { display: flex; flex-direction: column; }
        .stat-card strong { font-size: 1.5rem; }
        .stat-card span { font-size: 0.8rem; color: var(--text-tertiary); }
        .stat-card .trend { position: absolute; top: 16px; right: 16px; color: #22c55e; }
        .stat-card.clickable { cursor: pointer; }
        .stat-card.clickable:hover { border-color: #ef4444; }

        .dash-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) { .dash-grid { grid-template-columns: 1fr; } }

        .dash-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 20px;
        }
        .dash-card.warning { border-color: #f59e0b50; }
        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .card-head h3 { display: flex; align-items: center; gap: 8px; font-size: 1rem; margin: 0; }
        .card-head button { background: none; border: none; color: var(--primary-400); cursor: pointer; font-size: 0.8rem; }
        .card-head .count { background: #ef4444; color: white; padding: 2px 10px; border-radius: 10px; font-size: 0.8rem; }

        .bills-list { display: flex; flex-direction: column; gap: 10px; }
        .bill-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 10px;
        }
        .bill-row > div { display: flex; flex-direction: column; }
        .bill-row strong { font-size: 0.9rem; }
        .bill-row span { font-size: 0.75rem; color: var(--text-tertiary); }
        .bill-amt { text-align: right; }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .badge.cash { background: #22c55e20; color: #22c55e; }
        .badge.upi { background: #3b82f620; color: #3b82f6; }
        .badge.card { background: #f59e0b20; color: #f59e0b; }

        .stock-list { display: flex; flex-direction: column; gap: 8px; }
        .stock-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          font-size: 0.875rem;
        }
        .stock-row .low { color: #f59e0b; font-weight: 600; }
        .stock-row .out { color: #ef4444; font-weight: 600; }
        .more { background: none; border: none; color: var(--primary-400); cursor: pointer; padding: 8px; }

        .empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-tertiary);
        }
        .empty svg { margin-bottom: 12px; opacity: 0.3; }
        .empty p { margin-bottom: 16px; }
        .empty button {
          background: var(--primary-500);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
        }

        .owner-section {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(234, 88, 12, 0.04));
          border: 1px solid rgba(249, 115, 22, 0.2);
          border-radius: 16px;
          padding: 20px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .section-header h3 { margin: 0; font-size: 1rem; }
        .plan-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .plan-badge.free { background: #71717a; color: white; }
        .plan-badge.pro { background: linear-gradient(135deg, #f97316, #ea580c); color: white; }
        .plan-badge.business { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
        .plan-badge.enterprise { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .owner-section h3 { margin: 0 0 16px; font-size: 1rem; }
        .owner-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .owner-btns button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
        }
        .owner-btns button:hover { border-color: var(--primary-400); color: var(--primary-400); }

        @media (max-width: 640px) {
          .dash-header { flex-direction: column; gap: 12px; }
          .dash-time { width: 100%; justify-content: space-between; }
          .dash-stats { grid-template-columns: 1fr 1fr; }
          .stat-card { padding: 14px; }
          .stat-card strong { font-size: 1.2rem; }
          .dash-btn { padding: 10px 16px; font-size: 0.8rem; }
        }
      `}</style>
    </div>
  )
}
