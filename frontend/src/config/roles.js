/**
 * KadaiGPT — Role Configuration
 * Single source of truth for owner vs staff navigation & permissions.
 *
 * Owner: full nav + "More" dropdown for all extra pages
 * Staff:  exactly 5 nav items, no dropdown
 *
 * Labels use i18n translation keys (e.g. 'nav.dashboard') so they
 * automatically switch when the user changes language.
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
        { id: 'dashboard',   labelKey: 'nav.dashboard',  label: 'Dashboard', icon: Home },
        { id: 'create-bill', labelKey: 'nav.newBill',    label: 'New Bill',  icon: Plus, primary: true },
        { id: 'staff',       labelKey: 'nav.staff',      label: 'Staff',     icon: Users },
        { id: 'bills',       labelKey: 'nav.bills',      label: 'Bills',     icon: FileText },
        { id: 'products',    labelKey: 'nav.products',   label: 'Products',  icon: Package },
        { id: 'customers',   labelKey: 'nav.customers',  label: 'Customers', icon: Users },
    ],
    moreNav: [
        { id: 'analytics',       labelKey: 'nav.analytics',       label: 'Analytics',      icon: BarChart3 },
        { id: 'loyalty',         labelKey: 'nav.loyalty',         label: 'Loyalty',         icon: Gift },
        { id: 'suppliers',       labelKey: 'nav.suppliers',       label: 'Suppliers',       icon: Truck },
        { id: 'expenses',        labelKey: 'nav.expenses',        label: 'Expenses',        icon: Wallet },
        { id: 'daily-summary',   labelKey: 'nav.dailySummary',   label: 'Daily Summary',   icon: CalendarCheck },
        { id: 'ai-insights',     labelKey: 'nav.aiInsights',     label: 'AI Insights',     icon: Brain },
        { id: 'gst',             labelKey: 'nav.gst',             label: 'GST Reports',     icon: Receipt },
        { id: 'bulk-operations', labelKey: 'nav.bulkOperations', label: 'Import/Export',    icon: Upload },
        { id: 'settings',        labelKey: 'nav.settings',       label: 'Settings',        icon: SettingsIcon },
    ],
}

// ─────────────────────────────────────────────────────
//  MANAGER  — bills + analytics + staff (no More)
// ─────────────────────────────────────────────────────
const MANAGER = {
    label: 'Manager',
    defaultPage: 'dashboard',
    nav: [
        { id: 'dashboard',   labelKey: 'nav.dashboard',  label: 'Dashboard', icon: Home },
        { id: 'create-bill', labelKey: 'nav.newBill',    label: 'New Bill',  icon: Plus, primary: true },
        { id: 'bills',       labelKey: 'nav.bills',      label: 'Bills',     icon: FileText },
        { id: 'products',    labelKey: 'nav.products',   label: 'Products',  icon: Package },
        { id: 'customers',   labelKey: 'nav.customers',  label: 'Customers', icon: Users },
        { id: 'staff',       labelKey: 'nav.staff',      label: 'Staff',     icon: Users },
    ],
    moreNav: [
        { id: 'analytics',   labelKey: 'nav.analytics',  label: 'Analytics',  icon: BarChart3 },
        { id: 'suppliers',   labelKey: 'nav.suppliers',   label: 'Suppliers',  icon: Truck },
        { id: 'expenses',    labelKey: 'nav.expenses',    label: 'Expenses',   icon: Wallet },
        { id: 'settings',    labelKey: 'nav.settings',    label: 'Settings',   icon: SettingsIcon },
    ],
}

// ─────────────────────────────────────────────────────
//  CASHIER  — billing + customers + loyalty (no More)
// ─────────────────────────────────────────────────────
const CASHIER = {
    label: 'Cashier',
    defaultPage: 'create-bill',
    nav: [
        { id: 'create-bill', labelKey: 'nav.newBill',    label: 'New Bill',   icon: Plus, primary: true },
        { id: 'bills',       labelKey: 'nav.bills',      label: 'Bills',      icon: FileText },
        { id: 'products',    labelKey: 'nav.products',   label: 'Products',   icon: Package },
        { id: 'customers',   labelKey: 'nav.customers',  label: 'Customers',  icon: Users },
        { id: 'loyalty',     labelKey: 'nav.loyalty',    label: 'Loyalty',    icon: Star },
    ],
    moreNav: [],
}

// ─────────────────────────────────────────────────────
//  INVENTORY MANAGER  — stock, suppliers, bulk (no More)
// ─────────────────────────────────────────────────────
const INVENTORY_MANAGER = {
    label: 'Inventory',
    defaultPage: 'dashboard',
    nav: [
        { id: 'dashboard',       labelKey: 'nav.dashboard',       label: 'Dashboard',    icon: Home },
        { id: 'products',        labelKey: 'nav.products',        label: 'Products',     icon: Package },
        { id: 'suppliers',       labelKey: 'nav.suppliers',       label: 'Suppliers',    icon: Truck },
        { id: 'bulk-operations', labelKey: 'nav.bulkOperations',  label: 'Import/Export', icon: FileText },
        { id: 'analytics',       labelKey: 'nav.analytics',       label: 'Analytics',    icon: BarChart3 },
    ],
    moreNav: [
        { id: 'settings',        labelKey: 'nav.settings',        label: 'Settings',     icon: SettingsIcon },
    ],
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
