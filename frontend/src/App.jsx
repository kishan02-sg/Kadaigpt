import { useState, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Settings as SettingsIcon, Command, LogOut, Menu, X, Bell, User, ChevronDown, Sun, Moon } from 'lucide-react'
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
const Subscription = lazy(() => import('./pages/Subscription'))
const StaffManagement = lazy(() => import('./pages/StaffManagement'))
const StoreManager = lazy(() => import('./pages/StoreManager'))
const LegalPages = lazy(() => import('./pages/LegalPages'))
// Auth pages stay eagerly loaded (critical path)
import Login from './pages/Login'
import api from './services/api'
import { warmup } from './services/warmup'
import { demoProducts } from './services/demoData'
import offlineSync from './services/offlineSync'
import { useTheme } from './contexts/ThemeContext'
import './i18n'
import './App.css'
import './styles/mobile.css'
import './styles/enhancements.css'
import './styles/ux-rules.css'

// Initialize error tracking on app load
errorTracker.init()

import { getRoleConfig, getRoleDefaultPage, VALID_PAGES } from './config/roles'

function App() {
    const { t } = useTranslation()
    const { theme, toggleTheme } = useTheme()
    const getInitialPage = () => {
        const hash = window.location.hash.replace('#', '')
        const savedRole = localStorage.getItem('kadai_user_role') || 'owner'
        return VALID_PAGES.includes(hash) ? hash : getRoleDefaultPage(savedRole)
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
    const [notifications, setNotifications] = useState([])

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
                    setUserRole((userData.role || 'cashier').toLowerCase())
                } catch {
                    // Don't logout! Use cached role/user from localStorage
                    console.warn('[App] getProfile failed on refresh, keeping session with cached data')
                    const cachedRole = localStorage.getItem('kadai_user_role') || 'cashier'
                    setUser({ role: cachedRole, full_name: 'User' })
                    setUserRole(cachedRole)
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

    // Map a backend notification_type to a UI style class
    const mapNotifType = (t) => {
        const s = (t || '').toLowerCase()
        if (s.includes('low') || s.includes('stock') || s.includes('warn') || s.includes('due')) return 'warning'
        if (s.includes('success') || s.includes('paid') || s.includes('backup') || s.includes('complete')) return 'success'
        return 'info'
    }

    const relativeTime = (iso) => {
        if (!iso) return ''
        const diff = Date.now() - new Date(iso).getTime()
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'just now'
        if (m < 60) return `${m} min ago`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
        const d = Math.floor(h / 24)
        return `${d} day${d > 1 ? 's' : ''} ago`
    }

    const loadNotifications = async () => {
        try {
            const data = await api.getInAppNotifications(20)
            const items = (data?.notifications || []).map(n => ({
                id: n.id,
                type: mapNotifType(n.notification_type),
                message: n.title ? `${n.title}: ${n.message}` : n.message,
                time: relativeTime(n.created_at),
                read: n.is_read,
            }))
            setNotifications(items)
        } catch (e) {
            // Notifications are non-critical — fail quietly (e.g., offline / demo mode)
            console.warn('[App] Could not load notifications:', e?.message)
        }
    }

    const markAllNotificationsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))  // optimistic
        try {
            await api.markAllNotificationsRead()
        } catch (e) {
            console.warn('[App] mark-all-read failed:', e?.message)
        }
    }

    // Load notifications once the user is authenticated, then refresh periodically.
    useEffect(() => {
        if (!user) return
        loadNotifications()
        const iv = setInterval(loadNotifications, 60000)
        return () => clearInterval(iv)
    }, [user])

    const handleLogin = (userData) => {
        if (!userData.isDemo) {
            localStorage.removeItem('kadai_demo_mode')
        }
        setUser(userData)
        // Set role from login response — critical for role-based nav
        const role = (userData.role || 'owner').toLowerCase()
        setUserRole(role)
        localStorage.setItem('kadai_user_role', role)
        // Navigate to the correct default page for this role
        const defaultPage = getRoleDefaultPage(role)
        setCurrentPage(defaultPage)
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
        // 🔐 ROLE-BASED PAGE ACCESS
        // Each role has a whitelist of allowed pages
        // ═══════════════════════════════════════════════════
        const ROLE_PAGES = {
            owner: ['dashboard', 'create-bill', 'bills', 'ocr', 'products', 'customers', 'suppliers',
                    'analytics', 'gst', 'daily-summary', 'staff', 'stores',
                    'subscription', 'ai-insights', 'settings', 'whatsapp',
                    'loyalty', 'expenses', 'bulk-operations', 'privacy', 'terms'],
            manager: ['dashboard', 'create-bill', 'bills', 'ocr', 'products',
                      'customers', 'suppliers', 'analytics', 'gst', 'daily-summary',
                      'expenses', 'staff', 'whatsapp', 'loyalty', 'ai-insights',
                      'bulk-operations', 'settings', 'privacy', 'terms'],
            cashier: ['create-bill', 'bills', 'products', 'customers', 'ocr', 'settings', 'privacy', 'terms'],
            inventory_manager: ['dashboard', 'products', 'suppliers', 'bulk-operations', 'analytics', 'settings', 'privacy', 'terms'],
        }

        const role = (userRole || 'owner').toLowerCase()
        const allowedPages = ROLE_PAGES[role] || ROLE_PAGES.owner
        const defaultPage = getRoleDefaultPage(role)

        // Redirect if page not allowed for this role
        if (!allowedPages.includes(currentPage)) {
            addToast('🔒 You don\'t have access to this page.', 'warning')
            setTimeout(() => setCurrentPage(defaultPage), 100)
            return null
        }
        // ═══════════════════════════════════════════════════

        switch (currentPage) {
            case 'dashboard': return <Dashboard addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'bills': return <Bills addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'create-bill': return <CreateBill addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'ocr': return <OCRCapture addToast={addToast} setCurrentPage={setCurrentPage} />
            case 'products': return <Products addToast={addToast} userRole={userRole} />
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
                    <button onClick={() => setCurrentPage(defaultPage)} style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--primary, #6366f1)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>← Go to Dashboard</button>
                </div>
            )
        }
    }

    // Navigation — driven by config/roles.js (clean, no if-else chains)
    const roleConfig = getRoleConfig(userRole)
    const navItems = roleConfig.nav
    const moreItems = roleConfig.moreNav || [] // Owner has More dropdown, staff don't

    if (loading) {
        return <LoadingScreen status={warmupStatus.status} message={warmupStatus.message} />
    }


    if (!user) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <div className={`app-layout no-sidebar role-${userRole} ${currentPage === 'create-bill' ? 'page-create-bill' : ''}`}>
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
                                <span>{t(item.labelKey, item.label)}</span>
                            </button>
                        ))}

                        {/* More Dropdown — Owner only */}
                        {moreItems.length > 0 && (
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
                                        <item.icon size={16} />
                                        {t(item.labelKey, item.label)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        )}
                    </nav>
                </div>

                <div className="navbar-right">
                    {/* Online Status */}
                    <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        <span className="status-text">{isOnline ? t('app.online', 'Online') : t('app.offline', 'Offline')}</span>
                    </div>

                    {/* Language Switcher */}
                    <LanguageSwitcher compact />

                    {/* Theme Toggle (hidden on mobile — also available in the bottom-nav More menu) */}
                    <button className="icon-btn theme-toggle hide-on-mobile" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {/* Command Palette Trigger (desktop only) */}
                    <button className="icon-btn cmd-palette-btn hide-on-mobile" onClick={() => setShowCommandPalette(true)} title="Quick Actions (Ctrl+K)">
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
                                    <span>{t('notifications.title', 'Notifications')}</span>
                                    <button onClick={markAllNotificationsRead}>
                                        {t('notifications.markAllRead', 'Mark all read')}
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
            <MobileNav currentPage={currentPage} setCurrentPage={setCurrentPage} userRole={userRole} />

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
