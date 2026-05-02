import { ShoppingCart, LayoutDashboard, FileText, Camera, Package, Settings, LogOut, PlusCircle, User, BarChart3, Users, Receipt, MessageCircle, Truck, Gift, X, Brain, Wallet, ClipboardList, Database, Shield } from 'lucide-react'
import NotificationCenter from './NotificationCenter'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create-bill', label: 'New Bill', icon: PlusCircle, highlight: true },
  { id: 'bills', label: 'All Bills', icon: FileText },
  { id: 'ocr', label: 'Scan Bill', icon: Camera },
  { id: 'products', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'loyalty', label: 'Loyalty', icon: Gift },
  { id: 'ai-insights', label: 'AI Insights', icon: Brain, badge: 'hot' },
  { id: 'daily-summary', label: 'Daily Report', icon: ClipboardList, badge: 'new' },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'gst', label: 'GST Reports', icon: Receipt },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'bulk-operations', label: 'Import/Export', icon: Database },
  { id: 'admin', label: 'Admin Panel', icon: Shield, badge: 'enterprise' },
]

export default function Sidebar({ currentPage, setCurrentPage, isOnline, user, onLogout, isOpen = false }) {
  const handleNavClick = (pageId) => {
    setCurrentPage(pageId)
  }

  return (
    <>
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="logo-text">
            <h1>KadaiGPT</h1>
            <span>{localStorage.getItem('kadai_store_name') || user?.store_name || 'AI Retail'}</span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="sidebar-status-bar">
          <div className={`network-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <div style={{ position: 'relative' }}>
            <NotificationCenter />
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuItems
            .filter(item => {
              // Hide admin panel from non-admin users
              if (item.id === 'admin' && localStorage.getItem('kadai_user_role') !== 'admin') {
                return false;
              }
              return true;
            })
            .map(item => (
              <button
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {item.id === 'whatsapp' && <span className="nav-badge green">New</span>}
                {item.id === 'loyalty' && <span className="nav-badge orange">New</span>}
                {item.id === 'ai-insights' && <span className="nav-badge hot">🔥 AI</span>}
                {item.id === 'daily-summary' && <span className="nav-badge blue">New</span>}
                {item.id === 'admin' && <span className="nav-badge purple">Admin</span>}
              </button>
            ))}
        </nav>

        {/* User Section */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username || 'User'}</span>
              <span className="user-role">Store Owner</span>
            </div>
          </div>
          <button
            className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={onLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

        <style>{`
        /* Status Bar */
        .sidebar-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          margin-bottom: 8px;
        }
        /* Mobile Header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          padding: 0 16px;
          align-items: center;
          justify-content: space-between;
          z-index: 1150;
        }
        .hamburger-btn {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          border-radius: var(--radius-md);
        }
        .hamburger-btn:hover {
          background: var(--bg-tertiary);
        }
        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--primary-400);
        }
        .mobile-status {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .mobile-status.online .dot {
          background: var(--success);
        }
        .mobile-status.offline .dot {
          background: var(--error);
        }
        .mobile-status .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: block;
        }

        /* Sidebar Overlay */
        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1198;
          backdrop-filter: blur(4px);
        }

        /* Sidebar Close Button */
        .sidebar-close {
          display: none;
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          background: var(--bg-tertiary);
          border: none;
          border-radius: 50%;
          color: var(--text-secondary);
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }
        .sidebar-close:hover {
          background: var(--error);
          color: white;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .logo-icon {
          width: 48px;
          height: 48px;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .logo-text h1 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
        }
        .logo-text span {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 24px;
          overflow-y: auto;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
          position: relative;
        }
        .nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: rgba(249, 115, 22, 0.1);
          color: var(--primary-400);
        }
        .nav-item.highlight {
          background: var(--gradient-primary);
          color: white;
        }
        .nav-item.highlight:hover {
          opacity: 0.9;
        }
        .nav-badge {
          margin-left: auto;
          padding: 2px 8px;
          color: white;
          font-size: 0.625rem;
          font-weight: 700;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }
        .nav-badge.green { background: #25D366; }
        .nav-badge.orange { background: var(--primary-400); }
        .nav-badge.hot { 
          background: linear-gradient(135deg, #ff6b35, #f7c94b); 
          animation: pulse-badge 2s infinite;
        }
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .nav-badge.blue { background: #3B82F6; }
        .nav-badge.purple { 
          background: linear-gradient(135deg, #8b5cf6, #7c3aed); 
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
        }
        .sidebar-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          margin-bottom: 8px;
        }
        .user-avatar {
          width: 40px;
          height: 40px;
          background: var(--bg-tertiary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }
        .user-details {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-weight: 600;
          font-size: 0.9375rem;
        }
        .user-role {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        /* Mobile Responsive */
        @media (max-width: 1024px) {
          .mobile-header {
            display: flex;
          }
          .sidebar-overlay {
            display: block;
          }
          .sidebar {
            transform: translateX(-100%);
            transition: transform var(--transition-base);
            z-index: 1199;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-close {
            display: flex;
          }
          .main-content {
            margin-left: 0;
            padding-top: 76px;
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            max-width: 320px;
          }
        }
      `}</style>
      </aside>
    </>
  )
}
