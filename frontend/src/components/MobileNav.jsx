import { useState, useEffect } from 'react'
import { Home, ShoppingCart, Package, Users, MoreHorizontal, X, FileText, BarChart3, Settings, Wallet, ClipboardList, Truck, MessageCircle, Star, Upload, UserCog, Store, CreditCard } from 'lucide-react'
import './MobileNav.css'

// Role-specific navigation configurations
// - Cashier: Billing first, minimal navigation
// - Inventory Manager: Stock + suppliers focus
// - Manager: Full access to everything
// - Owner: Monitoring + oversight (no billing)

const ROLE_NAV_CONFIGS = {
    cashier: {
        primary: [
            { id: 'create-bill', icon: ShoppingCart, label: 'New Bill' },
            { id: 'bills', icon: FileText, label: 'Bills' },
            { id: 'products', icon: Package, label: 'Products' },
            { id: 'customers', icon: Users, label: 'Customers' },
            { id: 'more', icon: MoreHorizontal, label: 'More' },
        ],
        more: [
            { id: 'ocr', label: '📷 Scan Bill' },
            { id: 'settings', label: '⚙️ Settings' },
        ]
    },
    inventory_manager: {
        primary: [
            { id: 'products', icon: Package, label: 'Products' },
            { id: 'suppliers', icon: Truck, label: 'Suppliers' },
            { id: 'bulk-operations', icon: Upload, label: 'Import' },
            { id: 'settings', icon: Settings, label: 'Settings' },
        ],
        more: []
    },
    manager: {
        primary: [
            { id: 'dashboard', icon: Home, label: 'Dashboard' },
            { id: 'create-bill', icon: ShoppingCart, label: 'New Bill' },
            { id: 'products', icon: Package, label: 'Stock' },
            { id: 'analytics', icon: BarChart3, label: 'Reports' },
            { id: 'more', icon: MoreHorizontal, label: 'More' },
        ],
        more: [
            { id: 'bills', label: '📄 All Bills' },
            { id: 'customers', label: '👥 Customers' },
            { id: 'suppliers', label: '🚚 Suppliers' },
            { id: 'staff', label: '👨‍💼 Staff' },
            { id: 'gst', label: '📋 GST Reports' },
            { id: 'expenses', label: '💰 Expenses' },
            { id: 'daily-summary', label: '📊 Daily Report' },
            { id: 'ocr', label: '📷 Scan Bill' },
            { id: 'bulk-operations', label: '📦 Import/Export' },
            { id: 'ai-insights', label: '🤖 AI Insights' },
            { id: 'whatsapp', label: '💬 WhatsApp' },
            { id: 'loyalty', label: '⭐ Loyalty' },
            { id: 'settings', label: '⚙️ Settings' },
        ]
    },
    owner: {
        primary: [
            { id: 'dashboard', icon: Home, label: 'Home' },
            { id: 'bills', icon: FileText, label: 'Bills' },
            { id: 'products', icon: Package, label: 'Products' },
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'more', icon: MoreHorizontal, label: 'More' },
        ],
        more: [
            { id: 'customers', label: '👥 Customers' },
            { id: 'suppliers', label: '🚚 Suppliers' },
            { id: 'staff', label: '👨‍💼 Staff' },
            { id: 'stores', label: '🏬 My Stores' },
            { id: 'gst', label: '📋 GST Reports' },
            { id: 'expenses', label: '💰 Expenses' },
            { id: 'daily-summary', label: '📊 Daily Report' },
            { id: 'ai-insights', label: '🤖 AI Insights' },
            { id: 'loyalty', label: '⭐ Loyalty' },
            { id: 'whatsapp', label: '💬 WhatsApp' },
            { id: 'subscription', label: '💎 Subscription' },
            { id: 'settings', label: '⚙️ Settings' },
        ]
    }
}

// Default fallback = owner config
const getNavConfig = (role) => {
    const normalizedRole = (role || 'owner').toLowerCase()
    // Map legacy 'staff' to 'cashier'
    if (normalizedRole === 'staff') return ROLE_NAV_CONFIGS.cashier
    return ROLE_NAV_CONFIGS[normalizedRole] || ROLE_NAV_CONFIGS.owner
}

export default function MobileNav({ currentPage, setCurrentPage }) {
    const [showMore, setShowMore] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const userRole = localStorage.getItem('kadai_user_role') || 'owner'

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    if (!isMobile) return null

    const config = getNavConfig(userRole)
    const navItems = config.primary
    const moreItems = config.more

    const handleNavClick = (id) => {
        if (id === 'more') {
            setShowMore(!showMore)
        } else {
            setCurrentPage(id)
            setShowMore(false)
        }
    }

    return (
        <>
            {/* Bottom Navigation */}
            <nav className="mobile-nav" role="navigation" aria-label="Main navigation">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === 'more'
                        ? moreItems.some(m => m.id === currentPage)
                        : currentPage === item.id

                    return (
                        <button
                            key={item.id}
                            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleNavClick(item.id)}
                            aria-label={item.label}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon size={24} aria-hidden="true" />
                            <span>{item.label}</span>
                        </button>
                    )
                })}
            </nav>

            {/* More Menu Overlay */}
            {showMore && (
                <div
                    className="more-menu-overlay"
                    onClick={() => setShowMore(false)}
                    role="dialog"
                    aria-label="More options"
                >
                    <div className="more-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="more-menu-header">
                            <h3>More Options</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowMore(false)}
                                aria-label="Close menu"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="more-menu-grid">
                            {moreItems.map((item) => (
                                <button
                                    key={item.id}
                                    className={`more-menu-item ${currentPage === item.id ? 'active' : ''}`}
                                    onClick={() => handleNavClick(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
