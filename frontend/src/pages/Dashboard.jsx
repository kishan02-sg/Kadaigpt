import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, ShoppingBag, Users, AlertTriangle, IndianRupee, FileText, Package, Plus, RefreshCw, ArrowUpRight, UserPlus, Settings, Store, ChevronRight } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function Dashboard({ addToast, setCurrentPage }) {
  const { t } = useTranslation()
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
      addToast(t('dashboard.dashboardRefreshed', 'Dashboard refreshed'), 'success')
    })
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return t('dashboard.goodMorning', 'Good Morning')
    if (hour < 17) return t('dashboard.goodAfternoon', 'Good Afternoon')
    return t('dashboard.goodEvening', 'Good Evening')
  }

  const getGreetingEmoji = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return '☀️'
    if (hour < 17) return '🌤️'
    return '🌙'
  }

  // Dashboard CSS (shared across all role views)
  const dashStyles = `
    .dash { max-width: 1200px; margin: 0 auto; }
    .dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-subtle); }
    .dash-header h1 { font-size: 1.75rem; margin: 0 0 4px; }
    .dash-header p { color: var(--text-secondary); margin: 0; }
    .dash-time { display: flex; align-items: center; gap: 12px; }
    .dash-time span { font-size: 1.5rem; font-weight: 600; }
    .dash-time button { width: 36px; height: 36px; border: 1px solid var(--border-subtle); background: var(--bg-card); border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }
    .dash-time button:hover { background: var(--primary-500); color: white; border-color: var(--primary-500); }
    .dash-time button.spinning svg { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .low-stock-alert { display: flex; align-items: center; gap: 14px; padding: 16px 20px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06)); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 14px; margin-bottom: 20px; }
    .alert-icon { width: 40px; height: 40px; background: rgba(239, 68, 68, 0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ef4444; }
    .alert-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .alert-content strong { color: #ef4444; font-size: 0.95rem; }
    .alert-content span { color: var(--text-secondary); font-size: 0.8rem; }
    .alert-btn { padding: 10px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .alert-btn:hover { background: #dc2626; }
    .role-quick-access { margin-bottom: 20px; }
    .quick-access-inline { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; flex-wrap: wrap; }
    .quick-access-inline.owner { border-color: rgba(251, 146, 60, 0.3); background: linear-gradient(135deg, var(--bg-card), rgba(251, 146, 60, 0.03)); }
    .role-label { font-weight: 700; font-size: 0.9rem; }
    .qa-buttons { display: flex; gap: 8px; margin-left: auto; }
    .qa-btn-inline { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border-subtle); background: var(--bg-secondary); border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); transition: all 0.2s; }
    .qa-btn-inline:hover { border-color: var(--primary-400); background: var(--primary-500); color: white; }
    .qa-btn-inline.primary { background: var(--primary-500); border-color: var(--primary-500); color: white; }
    .qa-btn-inline.upgrade { background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-color: #8b5cf6; color: white; }
    .dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 14px; position: relative; }
    .stat-card svg:first-child { width: 44px; height: 44px; padding: 10px; border-radius: 12px; }
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
    .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    @media (max-width: 768px) { .dash-grid { grid-template-columns: 1fr; } }
    .dash-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 20px; }
    .dash-card.warning { border-color: #f59e0b50; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-head h3 { display: flex; align-items: center; gap: 8px; font-size: 1rem; margin: 0; }
    .card-head button { background: none; border: none; color: var(--primary-400); cursor: pointer; font-size: 0.8rem; }
    .card-head .count { background: #ef4444; color: white; padding: 2px 10px; border-radius: 10px; font-size: 0.8rem; }
    .bills-list { display: flex; flex-direction: column; gap: 10px; }
    .bill-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 10px; }
    .bill-row > div { display: flex; flex-direction: column; }
    .bill-row strong { font-size: 0.9rem; }
    .bill-row span { font-size: 0.75rem; color: var(--text-tertiary); }
    .bill-amt { text-align: right; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; text-transform: uppercase; margin-top: 4px; }
    .badge.cash { background: #22c55e20; color: #22c55e; }
    .badge.upi { background: #3b82f620; color: #3b82f6; }
    .badge.card { background: #f59e0b20; color: #f59e0b; }
    .stock-list { display: flex; flex-direction: column; gap: 8px; }
    .stock-row { display: flex; justify-content: space-between; padding: 10px 12px; background: var(--bg-tertiary); border-radius: 8px; font-size: 0.875rem; }
    .stock-row .low { color: #f59e0b; font-weight: 600; }
    .stock-row .out { color: #ef4444; font-weight: 600; }
    .more { background: none; border: none; color: var(--primary-400); cursor: pointer; padding: 8px; }
    .empty { text-align: center; padding: 40px 20px; color: var(--text-tertiary); }
    .empty svg { margin-bottom: 12px; opacity: 0.3; }
    .empty p { margin-bottom: 16px; }
    .empty button { background: var(--primary-500); color: white; border: none; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 500; }
    .plan-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
    .plan-badge.free { background: #71717a; color: white; }
    .plan-badge.pro { background: linear-gradient(135deg, #f97316, #ea580c); color: white; }
    @media (max-width: 640px) {
      .dash-header { flex-direction: column; gap: 12px; }
      .dash-time { width: 100%; justify-content: space-between; }
      .dash-stats { grid-template-columns: 1fr 1fr; }
      .stat-card { padding: 12px; gap: 10px; align-items: flex-start; }
      .stat-card svg:first-child { width: 38px; height: 38px; padding: 8px; }
      .stat-card strong { font-size: 1.15rem; }
      .stat-card span { font-size: 0.7rem; line-height: 1.2; }
      /* The decorative trend arrow crowds the label on tiny cards (clipping
         "Today's Sales" to "Today'"). Hide it on mobile so labels fit. */
      .stat-card .trend { display: none; }
    }
  `

  // ═══════════════════════════════════════════
  // ROLE-SPECIFIC DASHBOARD VIEWS
  // ═══════════════════════════════════════════

  // Inventory Manager Dashboard — Stock focused
  if (userRole === 'inventory_manager') {
    return (
      <div className="dash">
        <header className="dash-header">
          <div>
            <h1>📦 {t('dashboard.inventoryDashboard', 'Inventory Dashboard')}</h1>
            <p>{storeName} • {formatDate()}</p>
          </div>
          <div className="dash-time">
            <span>{formatTime()}</span>
            <button onClick={refresh} className={isRefreshing ? 'spinning' : ''} aria-label="Refresh"><RefreshCw size={16} /></button>
          </div>
        </header>

        {/* Stock Stats */}
        <section className="dash-stats">
          <div className="stat-card blue">
            <Package size={20} />
            <div><strong>{products.length}</strong><span>{t('dashboard.totalProducts', 'Total Products')}</span></div>
          </div>
          <div className="stat-card red">
            <AlertTriangle size={20} />
            <div><strong>{lowStockProducts.length}</strong><span>{t('dashboard.lowStock', 'Low Stock')}</span></div>
          </div>
        </section>

        {/* Low Stock Alert — prominent for inventory manager */}
        {lowStockProducts.length > 0 && (
          <div className="dash-card warning" style={{ marginBottom: '20px' }}>
            <div className="card-head">
              <h3><AlertTriangle size={16} /> ⚠️ {t('dashboard.lowStockItems', 'Low Stock Items')}</h3>
              <span className="count">{lowStockProducts.length}</span>
            </div>
            <div className="stock-list">
              {lowStockProducts.map(p => (
                <div key={p.id} className="stock-row">
                  <span>{p.name}</span>
                  <span className={p.stock === 0 ? 'out' : 'low'}>{p.stock} {t('dashboard.left', 'left')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lowStockProducts.length === 0 && (
          <div className="empty">
            <Package size={40} />
            <p>{t('dashboard.allStockHealthy', 'All stock levels are healthy! ✅')}</p>
          </div>
        )}

        <style>{dashStyles}</style>
      </div>
    )
  }

  // Cashier Dashboard — Billing focused
  if (userRole === 'cashier' || userRole === 'staff') {
    return (
      <div className="dash">
        <header className="dash-header">
          <div>
            <h1>{getGreeting()}! {getGreetingEmoji()}</h1>
            <p>{storeName} • {formatDate()}</p>
          </div>
          <div className="dash-time">
            <span>{formatTime()}</span>
          </div>
        </header>

        {/* Big New Bill Button */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary-500), #ea580c)',
          borderRadius: '20px', padding: '32px 24px', color: 'white',
          marginBottom: '20px', textAlign: 'center', cursor: 'pointer',
        }} onClick={() => setCurrentPage('create-bill')}>
          <Plus size={40} style={{ marginBottom: '8px' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>{t('dashboard.createNewBill', 'Create New Bill')}</h2>
          <p style={{ opacity: 0.9, fontSize: '0.9rem', margin: 0 }}>{t('dashboard.tapToStart', 'Tap to start billing')}</p>
        </div>

        {/* Quick Stats */}
        <section className="dash-stats">
          <div className="stat-card green">
            <IndianRupee size={20} />
            <div><strong>{formatCurrency(stats.todaySales)}</strong><span>{t('dashboard.todaySales', "Today's Sales")}</span></div>
          </div>
          <div className="stat-card blue">
            <ShoppingBag size={20} />
            <div><strong>{stats.todayBills}</strong><span>{t('dashboard.billsToday', 'Bills Today')}</span></div>
          </div>
        </section>

        {/* Recent Bills */}
        <div className="dash-card">
          <div className="card-head">
            <h3><FileText size={16} /> {t('dashboard.recentBills', 'Recent Bills')}</h3>
            <button onClick={() => setCurrentPage('bills')}>{t('dashboard.viewAll', 'View All')}</button>
          </div>
          {bills.length > 0 ? (
            <div className="bills-list">
              {bills.slice(0, 5).map(bill => (
                <div key={bill.id} className="bill-row">
                  <div>
                    <strong>#{bill.bill_number || bill.id}</strong>
                    <span>{bill.customer_name || t('dashboard.walkIn', 'Walk-in')}</span>
                  </div>
                  <div className="bill-amt">
                    <strong>{formatCurrency(bill.total || bill.amount)}</strong>
                    <span className={`badge ${(bill.payment_mode || 'cash').toLowerCase()}`}>{bill.payment_mode || 'Cash'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <FileText size={40} />
              <p>{t('dashboard.noBillsYet', 'No bills yet today')}</p>
              <button onClick={() => setCurrentPage('create-bill')}>{t('dashboard.createFirstBill', 'Create First Bill')}</button>
            </div>
          )}
        </div>

        <style>{dashStyles}</style>
      </div>
    )
  }

  // Owner & Manager Dashboard — Full monitoring
  return (
    <div className="dash">
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

      {/* Hero Revenue Card */}
      <div className="revenue-hero" style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '20px', padding: '28px 24px', color: 'white',
        marginBottom: '16px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '4px', fontWeight: 500 }}>
            📊 {t('dashboard.todaySales', "Today's Sales")}
          </p>
          <div className="currency-display currency-big" style={{ color: '#fbbf24', fontSize: '40px', fontWeight: 800 }}>
            {formatCurrency(stats.todaySales)}
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '14px', opacity: 0.9 }}>
            <span>🧾 {stats.todayBills} {t('bills.title', 'bills')}</span>
            <span>📊 {t('dashboard.avgBill', 'Avg')} {formatCurrency(stats.avgBillValue)}</span>
          </div>
        </div>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockProducts.length > 0 && (
        <div className="low-stock-alert">
          <div className="alert-icon"><AlertTriangle size={20} /></div>
          <div className="alert-content">
            <strong>⚠️ {t('dashboard.itemsLowStock', '{{count}} items are low on stock!', { count: lowStockProducts.length })}</strong>
            <span>{lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}{lowStockProducts.length > 3 ? ` +${lowStockProducts.length - 3} more` : ''}</span>
          </div>
          <button className="alert-btn" onClick={() => setCurrentPage('products')} aria-label="View low stock">{t('dashboard.reorder', 'Reorder')} →</button>
        </div>
      )}

      {/* Quick Access */}
      <section className="role-quick-access">
        {userRole === 'manager' && (
          <div className="quick-access-inline">
            <button className="qa-btn-inline primary" onClick={() => setCurrentPage('create-bill')}>
              <Plus size={18} /> {t('dashboard.newBill', 'New Bill')}
            </button>
            <button className="qa-btn-inline" onClick={() => setCurrentPage('staff')}>
              <UserPlus size={18} /> {t('dashboard.staff', 'Staff')}
            </button>
          </div>
        )}

        {(userRole === 'owner' || userRole === 'admin') && (
          <div className="quick-access-inline owner">
            <span className="role-label">👑 Owner</span>
            <span className={`plan-badge ${userPlan}`}>{userPlan.toUpperCase()}</span>
            <div className="qa-buttons">
              <button className="qa-btn-inline" onClick={() => setCurrentPage('staff')}>
                <UserPlus size={18} /> {t('dashboard.staff', 'Staff')}
              </button>
              <button className="qa-btn-inline" onClick={() => setCurrentPage('stores')}>
                <Store size={18} /> {t('dashboard.stores', 'Stores')}
              </button>
              {userPlan === 'free' && (
                <button className="qa-btn-inline upgrade" onClick={() => setCurrentPage('subscription')}>
                  <ChevronRight size={18} /> {t('dashboard.upgrade', 'Upgrade')}
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
          <div><strong>{formatCurrency(stats.todaySales)}</strong><span>{t('dashboard.todaySales', "Today's Sales")}</span></div>
          <ArrowUpRight className="trend" size={16} />
        </div>
        <div className="stat-card blue">
          <ShoppingBag size={20} />
          <div><strong>{stats.todayBills}</strong><span>{t('dashboard.billsToday', 'Bills Today')}</span></div>
        </div>
        <div className="stat-card purple">
          <TrendingUp size={20} />
          <div><strong>{formatCurrency(stats.avgBillValue)}</strong><span>{t('dashboard.avgBill', 'Avg Bill')}</span></div>
        </div>
        {stats.lowStockCount > 0 && (
          <div className="stat-card red clickable" onClick={() => setCurrentPage('products')}>
            <AlertTriangle size={20} />
            <div><strong>{stats.lowStockCount}</strong><span>{t('dashboard.lowStock', 'Low Stock')}</span></div>
          </div>
        )}
      </section>

      {/* Main Grid */}
      <section className="dash-grid">
        <div className="dash-card">
          <div className="card-head">
            <h3><FileText size={16} /> {t('dashboard.recentBills', 'Recent Bills')}</h3>
            <button onClick={() => setCurrentPage('bills')}>{t('dashboard.viewAll', 'View All')}</button>
          </div>
          {bills.length > 0 ? (
            <div className="bills-list">
              {bills.slice(0, 5).map(bill => (
                <div key={bill.id} className="bill-row">
                  <div>
                    <strong>#{bill.bill_number || bill.id}</strong>
                    <span>{bill.customer_name || t('dashboard.walkIn', 'Walk-in')}</span>
                  </div>
                  <div className="bill-amt">
                    <strong>{formatCurrency(bill.total || bill.amount)}</strong>
                    <span className={`badge ${(bill.payment_mode || 'cash').toLowerCase()}`}>{bill.payment_mode || 'Cash'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <FileText size={40} />
              <p>{t('dashboard.noBillsYetShort', 'No bills yet')}</p>
              {userRole === 'manager' && (
                <button onClick={() => setCurrentPage('create-bill')}>{t('dashboard.createFirstBill', 'Create First Bill')}</button>
              )}
            </div>
          )}
        </div>

        {lowStockProducts.length > 0 && (
          <div className="dash-card warning">
            <div className="card-head">
              <h3><AlertTriangle size={16} /> {t('dashboard.lowStock', 'Low Stock')}</h3>
              <span className="count">{lowStockProducts.length}</span>
            </div>
            <div className="stock-list">
              {lowStockProducts.slice(0, 5).map(p => (
                <div key={p.id} className="stock-row">
                  <span>{p.name}</span>
                  <span className={p.stock === 0 ? 'out' : 'low'}>{p.stock} {t('dashboard.left', 'left')}</span>
                </div>
              ))}
              {lowStockProducts.length > 5 && (
                <button className="more" onClick={() => setCurrentPage('products')}>
                  {t('dashboard.moreItems', '+{{count}} more items', { count: lowStockProducts.length - 5 })}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <style>{dashStyles}</style>
    </div>
  )
}
