import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

// User roles with permissions
export const USER_ROLES = {
    ADMIN: 'admin',
    OWNER: 'owner',
    MANAGER: 'manager',
    STAFF: 'staff',
    CASHIER: 'cashier'
}

// Role-based permissions
export const PERMISSIONS = {
    [USER_ROLES.ADMIN]: {
        canAccessAdmin: true,
        canManageUsers: true,
        canViewAllStores: true,
        canEditSettings: true,
        canViewReports: true,
        canDeleteData: true,
        canCreateBill: true,
        canEditProducts: true,
        canViewCustomers: true,
        canManageSuppliers: true,
        canViewAnalytics: true,
        canManageLoyalty: true,
        canAccessWhatsApp: true,
        canViewExpenses: true,
        canBulkOperations: true,
    },
    [USER_ROLES.OWNER]: {
        canAccessAdmin: false,
        canManageUsers: true,
        canViewAllStores: false,
        canEditSettings: true,
        canViewReports: true,
        canDeleteData: true,
        canCreateBill: true,
        canEditProducts: true,
        canViewCustomers: true,
        canManageSuppliers: true,
        canViewAnalytics: true,
        canManageLoyalty: true,
        canAccessWhatsApp: true,
        canViewExpenses: true,
        canBulkOperations: true,
    },
    [USER_ROLES.MANAGER]: {
        canAccessAdmin: false,
        canManageUsers: false,
        canViewAllStores: false,
        canEditSettings: false,
        canViewReports: true,
        canDeleteData: false,
        canCreateBill: true,
        canEditProducts: true,
        canViewCustomers: true,
        canManageSuppliers: true,
        canViewAnalytics: true,
        canManageLoyalty: true,
        canAccessWhatsApp: false,
        canViewExpenses: true,
        canBulkOperations: false,
    },
    [USER_ROLES.STAFF]: {
        canAccessAdmin: false,
        canManageUsers: false,
        canViewAllStores: false,
        canEditSettings: false,
        canViewReports: false,
        canDeleteData: false,
        canCreateBill: true,
        canEditProducts: false,
        canViewCustomers: true,
        canManageSuppliers: false,
        canViewAnalytics: false,
        canManageLoyalty: false,
        canAccessWhatsApp: false,
        canViewExpenses: false,
        canBulkOperations: false,
    },
    [USER_ROLES.CASHIER]: {
        canAccessAdmin: false,
        canManageUsers: false,
        canViewAllStores: false,
        canEditSettings: false,
        canViewReports: false,
        canDeleteData: false,
        canCreateBill: true,
        canEditProducts: false,
        canViewCustomers: false,
        canManageSuppliers: false,
        canViewAnalytics: false,
        canManageLoyalty: false,
        canAccessWhatsApp: false,
        canViewExpenses: false,
        canBulkOperations: false,
    }
}

// Create the context
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [store, setStore] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // Get user role
    const role = user?.role || USER_ROLES.CASHIER
    const permissions = PERMISSIONS[role] || PERMISSIONS[USER_ROLES.CASHIER]

    // Check if user has permission
    const hasPermission = useCallback((permission) => {
        return permissions[permission] === true
    }, [permissions])

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            const token = api.getToken()
            if (token) {
                try {
                    const userData = await api.getProfile()
                    setUser(userData)
                    setIsAuthenticated(true)

                    // Get store info if available
                    if (userData.store_id) {
                        try {
                            const storeData = await api.getStoreSettings?.()
                            setStore(storeData)
                        } catch (e) {
                            console.log('Store settings not available')
                        }
                    }
                } catch (err) {
                    console.error('Auth check failed:', err)
                    api.logout()
                    setUser(null)
                    setIsAuthenticated(false)
                }
            }
            setLoading(false)
        }
        initAuth()
    }, [])

    // Login function
    const login = async (email, password) => {
        setError(null)
        setLoading(true)

        try {
            const result = await api.login(email, password)
            const userData = await api.getProfile()

            setUser(userData)
            setIsAuthenticated(true)
            localStorage.setItem('kadai_user_role', userData.role || 'owner')

            // Get store info
            if (userData.store_id) {
                try {
                    const storeData = await api.getStoreSettings?.()
                    setStore(storeData)
                } catch (e) {
                    console.log('Store settings not available')
                }
            }

            return { success: true, user: userData }
        } catch (err) {
            const errorMsg = err.message || 'Login failed'
            setError(errorMsg)
            return { success: false, error: errorMsg }
        } finally {
            setLoading(false)
        }
    }

    // Register function
    const register = async (data) => {
        setError(null)
        setLoading(true)

        try {
            const result = await api.register(data)

            // Auto-login after registration
            if (result.access_token) {
                api.setToken(result.access_token)

                const userData = {
                    id: result.user?.id,
                    email: result.user?.email,
                    full_name: result.user?.full_name,
                    role: result.user?.role || 'owner',
                    store_id: result.store?.id
                }

                setUser(userData)
                setIsAuthenticated(true)
                setStore(result.store)
                localStorage.setItem('kadai_user_role', userData.role)
                localStorage.setItem('kadai_store_name', result.store?.name || '')

                return { success: true, user: userData }
            }

            return { success: true }
        } catch (err) {
            const errorMsg = err.message || 'Registration failed'
            setError(errorMsg)
            return { success: false, error: errorMsg }
        } finally {
            setLoading(false)
        }
    }

    // Admin login function
    const adminLogin = async (email, password) => {
        setError(null)
        setLoading(true)

        try {
            // First do normal login
            await api.login(email, password)
            const userData = await api.getProfile()

            // Check if user is admin
            if (userData.role !== 'admin' && userData.is_superuser !== true) {
                api.logout()
                throw new Error('Access denied. Admin privileges required.')
            }

            setUser({ ...userData, role: 'admin' })
            setIsAuthenticated(true)
            localStorage.setItem('kadai_user_role', 'admin')

            return { success: true, user: userData }
        } catch (err) {
            const errorMsg = err.message || 'Admin login failed'
            setError(errorMsg)
            return { success: false, error: errorMsg }
        } finally {
            setLoading(false)
        }
    }

    // Logout function
    const logout = useCallback(() => {
        api.logout()
        setUser(null)
        setStore(null)
        setIsAuthenticated(false)
        setError(null)
        localStorage.removeItem('kadai_user_role')
        localStorage.removeItem('kadai_store_name')
        localStorage.removeItem('kadai_demo_mode')
    }, [])

    // Update user profile
    const updateProfile = async (data) => {
        try {
            const result = await api.updateProfile(data)
            setUser(prev => ({ ...prev, ...result }))
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    }

    // Context value
    const value = {
        user,
        store,
        role,
        permissions,
        loading,
        error,
        isAuthenticated,
        hasPermission,
        login,
        register,
        adminLogin,
        logout,
        updateProfile,
        setUser,
        setStore
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// Custom hook to use auth context
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// HOC for protected routes
export function withAuth(Component, requiredPermission = null) {
    return function ProtectedRoute(props) {
        const { isAuthenticated, loading, hasPermission } = useAuth()

        if (loading) {
            return (
                <div className="auth-loading">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            )
        }

        if (!isAuthenticated) {
            return null // Will be handled by App to show login
        }

        if (requiredPermission && !hasPermission(requiredPermission)) {
            return (
                <div className="access-denied">
                    <h2>Access Denied</h2>
                    <p>You don't have permission to view this page.</p>
                </div>
            )
        }

        return <Component {...props} />
    }
}

export default AuthContext
