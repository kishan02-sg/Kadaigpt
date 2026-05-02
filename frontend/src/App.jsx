import { useState, useEffect, lazy, Suspense } from 'react'
import { ShoppingCart, Home, FileText, Package, BarChart3, Users, Settings as SettingsIcon, Plus, Command, LogOut, Menu, X, Bell, User, ChevronDown } from 'lucide-react'
import MobileNav from './components/MobileNav'
import OnboardingWizard from './components/OnboardingWizard'
import CommandPalette from './components/CommandPalette'
import UnifiedAIAssistant from './components/UnifiedAIAssistant'
import OfflineIndicator from './components/OfflineIndicator'
import LoadingScreen from './components/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary'
import CelebrationEngine from './components/CelebrationEngine'
import LanguageSwitcher from './components/LanguageSwitcher'
import errorTracker from './services/errorTracker'
// ═══════════════════════════════════════════════════════════════
// Code-Split Page Imports (React.lazy for route-based splitting)
// Reduces initial bundle by ~60% — pages load on-demand
// ═══════════════════════════════════════════════════════════════
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Bills = lazy(() => import('./pages/Bills'))
const OCRCapture = lazy(() => import('./pages/OCRCapture'))
const Products = lazy(() => import('./pages/Products'))
const CreateBill = lazy(() => import('./pages/CreateBill'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const Customers = lazy(() => import('./pages/Customers'))
const GSTReports = lazy(() => import('./pages/GSTReports'))
const WhatsAppIntegration = lazy(() => import('./pages/WhatsAppIntegration'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const LoyaltyRewards = lazy(() => import('./pages/LoyaltyRewards'))
const AIInsights = lazy(() => import('./pages/AIInsights'))
const ExpenseTracker = lazy(() => import('./pages/ExpenseTracker'))
const DailySummary = lazy(() => import('./pages/DailySummary'))
const BulkOperations = lazy(() => import('./pages/BulkOperations'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Subscription = lazy(() => import('./pages/Subscription'))
const StaffManagement = lazy(() => import('./pages/StaffManagement'))
const StoreManager = lazy(() => import('./pages/StoreManager'))
const LegalPages = lazy(() => import('./pages/LegalPages'))
// Auth pages stay eagerly loaded (critical path)
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import api from './services/api'
import { warmup } from './services/warmup'
import { demoProducts } from './services/demoData'
import offlineSync from './services/offlineSync'
import './i18n'
import './App.css'
import './styles/mobile.css'
import './styles/enhancements.css'
import './styles/ux-rules.css'

// Initialize error tracking on app load
errorTracker.init()

function App() {
    // Role-specific default pages (mental model alignment)
    // Cashier: goes straight to billing (their only job)
    // Accountant: goes to GST reports (their primary task)
    // Warehouse: goes to inventory (stock in/out)
    // Owner/Manager: dashboard overview
    const getRoleDefaultPage = (role) => {
        const defaults = {
            cashier: 'create-bill',
            staff: 'create-bill',
            accountant: 'gst',
            warehouse: 'products',
            manager: 'dashboard',
            owner: 'dashboard',
        }
        return defaults[(role || 'owner').toLowerCase()] || 'dashboard'
    }

    const getInitialPage = () => {
        const hash = window.location.hash.replace('#', '')
        const validPages = ['dashboard', 'bills', 'create-bill', 'ocr', 'products', 'analytics', 'customers', 'gst', 'whatsapp', 'suppliers', 'loyalty', 'ai-insights', 'expenses', 'daily-summary', 'bulk-operations', 'admin', 'settings', 'staff', 'stores', 'subscription', 'admin-login', 'privacy', 'terms']
        const savedRole = localStorage.getItem('kadai_user_role') || 'owner'
        return validPages.includes(hash) ? hash : getRoleDefaultPage(savedRole)
    }

    const [currentPage, setCurrentPageState] = useState(getInitialPage)
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [toasts, setToasts] = useState([])
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(localStorage.getItem('kadai_user_role') || 'owner')
    const [loading, setLoading] = useState(true)
    const [products] = useState(demoProducts)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [warmupStatus, setWarmupStatus] = useState({ status: 'checking', message: '' })
    const [notifications, setNotifications] = useState([
        { id: 1, type: 'warning', message: 'Sugar stock is low (3 left)', time: '5 min ago', read: false },
        { id: 2, type: 'info', message: 'New bill #1234 created', time: '10 min ago', read: false },
        { id: 3, type: 'success', message: 'Daily backup completed', time: '1 hour ago', read: true },
    ])

    const setCurrentPage = (page) => {
        setCurrentPageState(page)
        window.location.hash = page
        setMobileMenuOpen(false)
    }

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '')
            if (hash && hash !== currentPage) {
                setCurrentPageState(hash)
            }
        }
        window.addEventListener('hashchange', handleHashChange)
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [currentPage])

    useEffect(() => {
        // Start backend warmup + auth check in parallel
        const unsub = warmup.onStatusChange((status, message) => {
            setWarmupStatus({ status, message })
        })

        const init = async () => {
            // Run warmup and auth check in parallel
            const [warmupResult] = await Promise.allSettled([
                warmup.ensureReady(),
                checkAuthAsync()
            ])

            // If warmup failed, still allow the app to load (offline mode)
            if (warmupResult.status === 'fulfilled' && !warmupResult.value.ready) {
                console.warn('[App] Backend warmup failed, app may work in offline mode')
            }

            setLoading(false)

            if (!localStorage.getItem('kadai_onboarding_complete') && !localStorage.getItem('kadai_demo_mode')) {
                setShowOnboarding(true)
            }
        }

        const checkAuthAsync = async () => {
            const token = api.getToken()
            if (token) {
                try {
                    const userData = await api.getProfile()
                    setUser(userData)
                } catch {
                    api.logout()
                }
            }
        }

        init()

        const handleKeyboard = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setShowCommandPalette(prev => !prev)
                return
            }
            if (e.key === 'Escape') setShowCommandPalette(false)
        }
        window.addEventListener('keydown', handleKeyboard)
        return () => {
            window.removeEventListener('keydown', handleKeyboard)
            unsub()
        }
    }, [])

    useEffect(() => {
        // Register Service Worker for offline support
        offlineSync.registerServiceWorker()

        const handleOnline = () => {
            setIsOnline(true)
            const pending = offlineSync.getPendingCount()
            if (pending > 0) {
                addToast(`Back online! Syncing ${pending} queued items...`, 'success')
                offlineSync.processQueue().then(results => {
                    if (results?.success > 0) {
                        addToast(`✅ Synced ${results.success} items successfully`, 'success')
                    }
                })
            } else {
                addToast('Back online!', 'success')
            }
        }
        const handleOffline = () => {
            setIsOnline(false)
            addToast('📡 You are offline. Changes will sync when connected.', 'warning')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const addToast = (message, type = 'info') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 4000)
    }

    const handleLogin = (userData) => {
        if (!userData.isDemo) {
            localStorage.removeItem('kadai_demo_mode')
        }
        setUser(userData)
        addToast(`Welcome, ${userData.username || userData.full_name || 'User'}!`, 'success')
    }

    const handleLogout = () => {
        api.logout()
        localStorage.removeItem('kadai_demo_mode')
        setUser(null)
        setCurrentPage('dashboard')
        addToast('Logged out successfully', 'info')
    }

    const renderPage = () => {
        // ═══════════════════════════════════════════════════
        // 🔐 ROLE-BASED PAGE ACCESS (BUG-003 fix)
        // Prevent users from accessing pages above their role level
        // ═══════════════════════════════════════════════════
        const ownerOnlyPages = ['analytics', 'gst', 'whatsapp', 'suppliers', 'loyalty', 'ai-insights', 'expenses', 'daily-summary', 'bulk-operations', 'admin', 'subscription', 'stores']
        const managerPages = ['analytics', 'gst', 'expenses', 'daily-summary', 'staff']
        const cashierPages = ['dashboard', 'create-bill', 'bills', 'products', 'customers', 'ocr', 'settings']

        if (userRole === 'cashier' || userRole === 'staff') {
            if (!cashierPages.includes(currentPage)) {
                addToast('🔒 Permission denied. Redirecting to your dashboard...', 'warning')
                setTimeout(() => setCurrentPage(getRoleDefaultPage(userRole)), 100)
                return null
            }
        } else if (userRole === 'manager') {
            const managerAllowed = [...cashierPages, ...managerPages]
            if (!managerAllowed.includes(currentPage) && ownerOnlyPages.includes(currentPage)) {
                addToast('🔒 This feature requires owner access.', 'warning')
                setTimeout(() => setCurrentPage('dashboard'), 100)
                return null
            }
        }
        // ═══════════════════════════════════════════════════

        switch (currentPage) {
            case 'dashboard': return <Dashboard addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'bills': return <Bills addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'create-bill': return <CreateBill addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'ocr': return <OCRCapture addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'products': return <Products addToast={addToast} />
            case 'analytics': return <Analytics addToast={addToast} />
            case 'customers': return <Customers addToast={addToast} />
            case 'gst': return <GSTReports addToast={addToast} />
            case 'whatsapp': return <WhatsAppIntegration addToast={addToast} />
            case 'suppliers': return <Suppliers addToast={addToast} />
            case 'loyalty': return <LoyaltyRewards addToast={addToast} />
            case 'ai-insights': return <AIInsights addToast={addToast} />
            case 'expenses': return <ExpenseTracker addToast={addToast} />
            case 'daily-summary': return <DailySummary addToast={addToast} />
            case 'bulk-operations': return <BulkOperations addToast={addToast} />
            case 'admin': return <AdminPanel addToast={addToast} />
            case 'subscription': return <Subscription addToast={addToast} />
            case 'staff': return <StaffManagement addToast={addToast} />
            case 'stores': return <StoreManager addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'settings': return <Settings addToast={addToast} />
            case 'privacy': return <LegalPages page="privacy" onBack={() => setCurrentPage('settings')} />
            case 'terms': return <LegalPages page="terms" onBack={() => setCurrentPage('settings')} />
            default: return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Page Not Found</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>The page you're looking for doesn't exist.</p>
                    <button onClick={() => setCurrentPage('dashboard')} style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--primary, #6366f1)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>← Go to Dashboard</button>
                </div>
            )
        }
    }

    // Role-based navigation items
    const getNavItems = () => {
        const baseItems = [
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'create-bill', label: 'New Bill', icon: Plus, primary: true },
            { id: 'bills', label: 'Bills', icon: FileText },
            { id: 'products', label: 'Products', icon: Package },
        ]

        // Cashier sees basic items + Customers
        if (userRole === 'staff' || userRole === 'cashier') {
            return [
                ...baseItems,
                { id: 'customers', label: 'Customers', icon: Users },
            ]
        }

        // Manager sees more + can manage staff
        if (userRole === 'manager') {
            return [
                ...baseItems,
                { id: 'customers', label: 'Customers', icon: Users },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ]
        }

        // Owner sees everything
        return [
            ...baseItems,
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        ]
    }

    const getMoreItems = () => {
        // Cashier sees nothing in more menu
        if (userRole === 'staff' || userRole === 'cashier') {
            return []
        }

        // Manager sees some items + staff management
        if (userRole === 'manager') {
            return [
                { id: 'staff', label: 'Staff Management' },
                { id: 'gst', label: 'GST Reports' },
                { id: 'expenses', label: 'Expenses' },
                { id: 'daily-summary', label: 'Daily Report' },
            ]
        }

        // Owner sees all features
        const ownerItems = [
            { id: 'staff', label: 'Staff Management' },
            { id: 'stores', label: 'My Stores' },
            { id: 'gst', label: 'GST Reports' },
            { id: 'suppliers', label: 'Suppliers' },
            { id: 'expenses', label: 'Expenses' },
            { id: 'daily-summary', label: 'Daily Report' },
            { id: 'ai-insights', label: 'AI Insights' },
            { id: 'whatsapp', label: 'WhatsApp' },
            { id: 'loyalty', label: 'Loyalty' },
            { id: 'bulk-operations', label: 'Import/Export' },
            { id: 'subscription', label: 'Subscription' },
        ]

        return ownerItems
    }

    const navItems = getNavItems()
    const moreItems = getMoreItems()

    if (loading) {
        return <LoadingScreen status={warmupStatus.status} message={warmupStatus.message} />
    }


    // Admin login - separate URL
    if (!user && currentPage === 'admin-login') {
        return <AdminLogin onLogin={handleLogin} />
    }

    if (!user) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <div className={`app-layout no-sidebar role-${userRole}`}>
            {/* Offline Status Indicator */}
            <OfflineIndicator />

            {/* Onboarding Wizard */}
            {showOnboarding && (
                <OnboardingWizard
                    onComplete={() => {
                        setShowOnboarding(false)
                        addToast('Welcome aboard! 🚀 Your store is ready.', 'success')
                    }}
                />
            )}

            {/* Command Palette */}
            {showCommandPalette && (
                <CommandPalette
                    onClose={() => setShowCommandPalette(false)}
                    onNavigate={(page) => {
                        setCurrentPage(page)
                        setShowCommandPalette(false)
                    }}
                    addToast={addToast}
                />
            )}

            {/* TOP NAVBAR - Main Navigation */}
            <header className="top-navbar">
                <div className="navbar-left">
                    <div className="brand" onClick={() => setCurrentPage('dashboard')}>
                        <div className="brand-icon">
                            <ShoppingCart size={22} />
                        </div>
                        <span className="brand-name">KadaiGPT</span>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="nav-links desktop-only" role="navigation" aria-label="Primary navigation">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                className={`nav-link ${currentPage === item.id ? 'active' : ''} ${item.primary ? 'primary' : ''}`}
                                onClick={() => setCurrentPage(item.id)}
                                aria-label={item.label}
                                aria-current={currentPage === item.id ? 'page' : undefined}
                            >
                                <item.icon size={18} />
                                <span>{item.label}</span>
                            </button>
                        ))}

                        {/* More Dropdown */}
                        <div className="nav-dropdown">
                            <button className="nav-link">
                                More <ChevronDown size={14} />
                            </button>
                            <div className="dropdown-menu">
                                {moreItems.map(item => (
                                    <button
                                        key={item.id}
                                        className="dropdown-item"
                                        onClick={() => setCurrentPage(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </nav>
                </div>

                <div className="navbar-right">
                    {/* Online Status */}
                    <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        <span className="status-text">{isOnline ? 'Online' : 'Offline'}</span>
                    </div>

                    {/* Language Switcher */}
                    <LanguageSwitcher compact />

                    {/* Command Palette Trigger */}
                    <button className="icon-btn" onClick={() => setShowCommandPalette(true)} title="Quick Actions (Ctrl+K)">
                        <Command size={18} />
                    </button>

                    {/* Notifications */}
                    <div className="notification-wrapper">
                        <button
                            className={`icon-btn ${notifications.filter(n => !n.read).length > 0 ? 'has-notifications' : ''}`}
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell size={18} />
                            {notifications.filter(n => !n.read).length > 0 && (
                                <span className="notification-badge">{notifications.filter(n => !n.read).length}</span>
                            )}
                        </button>
                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="notification-header">
                                    <span>Notifications</span>
                                    <button onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}>
                                        Mark all read
                                    </button>
                                </div>
                                <div className="notification-list">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} className={`notification-item ${n.type} ${n.read ? 'read' : ''}`}>
                                            <div className="notification-dot"></div>
                                            <div className="notification-content">
                                                <p>{n.message}</p>
                                                <span>{n.time}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="no-notifications">No notifications</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="user-menu-wrapper">
                        <button className="user-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                            <div className="user-avatar">
                                <User size={16} />
                            </div>
                            <div className="user-info">
                                <span className="user-name">{user?.username || 'User'}</span>
                                <span className="user-role">{userRole}</span>
                            </div>
                            <ChevronDown size={14} />
                        </button>

                        {showUserMenu && (
                            <div className="user-dropdown">
                                <div className="dropdown-header">
                                    <span className="store-name">{localStorage.getItem('kadai_store_name') || 'My Store'}</span>
                                </div>
                                <button onClick={() => { setCurrentPage('settings'); setShowUserMenu(false); }}>
                                    <SettingsIcon size={16} /> Settings
                                </button>
                                {userRole === 'admin' && (
                                    <button onClick={() => { setCurrentPage('admin'); setShowUserMenu(false); }}>
                                        <User size={16} /> Admin Panel
                                    </button>
                                )}
                                <hr />
                                <button onClick={handleLogout} className="logout-btn">
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="mobile-menu-btn mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
                    <nav className="mobile-menu" onClick={e => e.stopPropagation()}>
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                className={`mobile-nav-link ${currentPage === item.id ? 'active' : ''}`}
                                onClick={() => setCurrentPage(item.id)}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                        <hr />
                        {moreItems.map(item => (
                            <button
                                key={item.id}
                                className={`mobile-nav-link ${currentPage === item.id ? 'active' : ''}`}
                                onClick={() => setCurrentPage(item.id)}
                            >
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            {/* Main Content — Suspense boundary for code-split pages */}
            <main className="main-content no-sidebar">
                <Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                        <div className="spinner" />
                    </div>
                }>
                    {renderPage()}
                </Suspense>
            </main>

            {/* AI Assistant — Single unified FAB (merged Help + AI + Voice) */}
            <UnifiedAIAssistant addToast={addToast} setCurrentPage={setCurrentPage} products={products} />

            {/* Toast Notifications */}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Mobile Bottom Nav */}
            <MobileNav currentPage={currentPage} setCurrentPage={setCurrentPage} />

            {/* Offline Banner */}
            {!isOnline && (
                <div className="offline-banner-subtle" role="status" aria-live="polite">
                    <span className="sync-status-dot offline"></span>
                    <span>Offline — Bills saved locally, will sync when online</span>
                </div>
            )}
        </div>
    )
}

// Wrap App in ErrorBoundary for production crash safety
export default function AppWithErrorBoundary() {
    return (
        <ErrorBoundary>
            <CelebrationEngine>
                <App />
            </CelebrationEngine>
        </ErrorBoundary>
    )
}
