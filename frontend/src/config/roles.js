/**
 * KadaiGPT — Role Configuration
 * Single source of truth for owner vs staff navigation & permissions.
 *
 * To add a new role:  add a key here, the app picks it up automatically.
 * To change nav order: reorder items in the `nav` array below.
 */

import {
    Home, FileText, Package, BarChart3, Users, Plus, Star,
    Settings as SettingsIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────
//  OWNER  — monitors everything, manages staff
// ─────────────────────────────────────────────────────
const OWNER = {
    label: 'Owner',
    defaultPage: 'dashboard',
    nav: [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'bills',     label: 'Bills',     icon: FileText },
        { id: 'products',  label: 'Products',  icon: Package },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'staff',     label: 'Staff',     icon: Users },
    ],
}

// ─────────────────────────────────────────────────────
//  MANAGER  — bills + analytics + staff management
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
}

// ─────────────────────────────────────────────────────
//  CASHIER  — billing + customers + loyalty
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
}

// ─────────────────────────────────────────────────────
//  INVENTORY MANAGER  — stock, suppliers, bulk ops
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
