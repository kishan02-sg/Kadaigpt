/**
 * KadaiGPT — Role Configuration
 * Single source of truth for owner vs staff navigation & permissions.
 *
 * Owner: full nav + "More" dropdown for all extra pages
 * Staff:  exactly 5 nav items, no dropdown
 */

import {
    Home, FileText, Package, BarChart3, Users, Plus, Star,
    Settings as SettingsIcon, Receipt, TrendingUp, Truck,
    Gift, Brain, Wallet, CalendarCheck, Upload,
} from 'lucide-react'

// ─────────────────────────────────────────────────────
//  OWNER  — full access to everything + More dropdown
// ─────────────────────────────────────────────────────
const OWNER = {
    label: 'Owner',
    defaultPage: 'dashboard',
    nav: [
        { id: 'dashboard',   label: 'Dashboard', icon: Home },
        { id: 'create-bill', label: 'New Bill',  icon: Plus, primary: true },
        { id: 'bills',       label: 'Bills',     icon: FileText },
        { id: 'products',    label: 'Products',  icon: Package },
        { id: 'analytics',   label: 'Analytics', icon: BarChart3 },
    ],
    moreNav: [
        { id: 'customers',       label: 'Customers',     icon: Users },
        { id: 'staff',           label: 'Staff',          icon: Users },
        { id: 'loyalty',         label: 'Loyalty',        icon: Gift },
        { id: 'suppliers',       label: 'Suppliers',      icon: Truck },
        { id: 'expenses',        label: 'Expenses',       icon: Wallet },
        { id: 'daily-summary',   label: 'Daily Summary',  icon: CalendarCheck },
        { id: 'ai-insights',     label: 'AI Insights',    icon: Brain },
        { id: 'gst',             label: 'GST Reports',    icon: Receipt },
        { id: 'bulk-operations', label: 'Import/Export',   icon: Upload },
        { id: 'settings',        label: 'Settings',       icon: SettingsIcon },
    ],
}

// ─────────────────────────────────────────────────────
//  MANAGER  — bills + analytics + staff (no More)
// ─────────────────────────────────────────────────────
const MANAGER = {
    label: 'Manager',
    defaultPage: 'dashboard',
    nav: [
        { id: 'dashboard',   label: 'Dashboard', icon: Home },
        { id: 'create-bill', label: 'New Bill',  icon: Plus, primary: true },
        { id: 'products',    label: 'Products',  icon: Package },
        { id: 'analytics',   label: 'Analytics', icon: BarChart3 },
        { id: 'staff',       label: 'Staff',     icon: Users },
    ],
    moreNav: [],
}

// ─────────────────────────────────────────────────────
//  CASHIER  — billing + customers + loyalty (no More)
// ─────────────────────────────────────────────────────
const CASHIER = {
    label: 'Cashier',
    defaultPage: 'create-bill',
    nav: [
        { id: 'create-bill', label: 'New Bill',   icon: Plus, primary: true },
        { id: 'bills',       label: 'Bills',      icon: FileText },
        { id: 'products',    label: 'Products',   icon: Package },
        { id: 'customers',   label: 'Customers',  icon: Users },
        { id: 'loyalty',     label: 'Loyalty',    icon: Star },
    ],
    moreNav: [],
}

// ─────────────────────────────────────────────────────
//  INVENTORY MANAGER  — stock, suppliers, bulk (no More)
// ─────────────────────────────────────────────────────
const INVENTORY_MANAGER = {
    label: 'Inventory',
    defaultPage: 'products',
    nav: [
        { id: 'products',        label: 'Products',     icon: Package },
        { id: 'suppliers',       label: 'Suppliers',    icon: Users },
        { id: 'bulk-operations', label: 'Import/Export', icon: FileText },
        { id: 'analytics',       label: 'Analytics',    icon: BarChart3 },
        { id: 'settings',        label: 'Settings',     icon: SettingsIcon },
    ],
    moreNav: [],
}

// ─────────────────────────────────────────────────────
//  Exported map  (key = lowercase role string)
// ─────────────────────────────────────────────────────
const ROLE_CONFIG = {
    owner: OWNER,
    manager: MANAGER,
    cashier: CASHIER,
    inventory_manager: INVENTORY_MANAGER,
}

/** All page IDs that the router should accept */
export const VALID_PAGES = [
    'dashboard', 'bills', 'create-bill', 'ocr', 'products', 'analytics',
    'customers', 'gst', 'whatsapp', 'suppliers', 'loyalty', 'ai-insights',
    'expenses', 'daily-summary', 'bulk-operations', 'admin', 'settings',
    'staff', 'stores', 'subscription', 'admin-login', 'privacy', 'terms',
]

/** Get the role config for a given role string */
export const getRoleConfig = (role) => {
    return ROLE_CONFIG[(role || 'owner').toLowerCase()] || ROLE_CONFIG.owner
}

/** Get the default landing page for a role */
export const getRoleDefaultPage = (role) => {
    return getRoleConfig(role).defaultPage
}

export default ROLE_CONFIG
