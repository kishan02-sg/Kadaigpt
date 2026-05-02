/**
 * Real Data Service - Fetches real data from backend APIs
 * No more demo/dummy data - everything comes from the actual backend
 */

import api from './api'

class RealDataService {
    constructor() {
        this.cache = new Map()
        this.cacheTimeout = 60000 // 1 minute cache
    }

    // Clear all cache
    clearCache() {
        this.cache.clear()
    }

    // Invalidate specific cache keys (e.g., after creating a bill)
    invalidateCache(...keys) {
        if (keys.length === 0) {
            this.cache.clear()
        } else {
            keys.forEach(key => this.cache.delete(key))
        }
    }

    // Get cached data or fetch new
    async getCached(key, fetchFn) {
        const cached = this.cache.get(key)
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data
        }

        const data = await fetchFn()
        this.cache.set(key, { data, timestamp: Date.now() })
        return data
    }

    // ==================== DASHBOARD DATA ====================
    async getDashboardStats() {
        try {
            const stats = await api.getDashboardStats()
            return {
                todaySales: stats?.today_sales || stats?.todaySales || 0,
                todayBills: stats?.today_bills || stats?.todayBills || 0,
                avgBillValue: stats?.avg_bill_value || stats?.avgBillValue || 0,
                lowStockCount: stats?.low_stock_count || stats?.lowStockCount || 0,
                customerCount: stats?.customer_count || 0,
                pendingOrders: stats?.pending_orders || 0
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error)
            return {
                todaySales: 0,
                todayBills: 0,
                avgBillValue: 0,
                lowStockCount: 0,
                customerCount: 0,
                pendingOrders: 0
            }
        }
    }

    async getDashboardActivity() {
        try {
            const activity = await api.getDashboardActivity()
            return Array.isArray(activity) ? activity : []
        } catch (error) {
            console.error('Failed to fetch activity:', error)
            return []
        }
    }

    // Smart category detection from product name (when backend sends category_id only)
    _detectCategory(name) {
        const n = (name || '').toLowerCase()
        const map = {
            Grains: ['rice', 'wheat', 'atta', 'maida', 'rava', 'sooji', 'ragi', 'bajra', 'jowar', 'corn', 'flour', 'basmati', 'sella', 'ponni', 'idli'],
            Pulses: ['dal', 'toor', 'chana', 'moong', 'urad', 'masoor', 'rajma', 'lentil', 'chickpea', 'peas', 'beans'],
            Oils: ['oil', 'ghee', 'butter', 'vanaspati', 'sunflower', 'mustard', 'sesame', 'groundnut'],
            Dairy: ['milk', 'curd', 'paneer', 'cheese', 'yogurt', 'cream', 'buttermilk', 'lassi'],
            Beverages: ['tea', 'coffee', 'juice', 'water', 'soda', 'cola', 'pepsi', 'sprite', 'drink'],
            Essentials: ['salt', 'sugar', 'jaggery', 'turmeric', 'chilli', 'pepper', 'cumin', 'coriander', 'masala', 'spice'],
            Snacks: ['chips', 'biscuit', 'cookie', 'namkeen', 'mixture', 'murukku', 'cake', 'chocolate', 'candy'],
            Packaged: ['noodle', 'maggi', 'pasta', 'sauce', 'ketchup', 'jam', 'pickle', 'papad'],
            Household: ['soap', 'detergent', 'cleaner', 'broom', 'mop', 'tissue', 'foil', 'candle', 'match'],
            'Personal Care': ['shampoo', 'toothpaste', 'brush', 'lotion', 'powder', 'deodorant', 'razor'],
        }
        for (const [cat, kws] of Object.entries(map)) {
            if (kws.some(kw => n.includes(kw))) return cat
        }
        return 'General'
    }

    // ==================== PRODUCTS DATA ====================
    async getProducts(includeDemoFallback = false) {
        try {
            const response = await api.getProducts()
            const products = response?.products || response || []

            // Normalize product data
            const normalizedProducts = products.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku || '',
                barcode: p.barcode || '',
                price: p.selling_price || p.price || 0,
                costPrice: p.cost_price || p.costPrice || 0,
                stock: p.current_stock || p.stock || 0,
                minStock: p.min_stock_alert || p.minStock || 10,
                unit: p.unit || 'piece',
                // Use backend category name if available, else auto-detect from product name
                category: p.category?.name || (typeof p.category === 'string' && p.category !== 'General' ? p.category : null) || this._detectCategory(p.name),
                categoryId: p.category_id || null,
                isActive: p.is_active !== false,
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }))

            return normalizedProducts
        } catch (error) {
            console.error('Failed to fetch products:', error)
            return []
        }
    }

    async getLowStockProducts() {
        try {
            const products = await this.getProducts()
            return products.filter(p => p.stock <= p.minStock)
        } catch (error) {
            return []
        }
    }

    // ==================== BILLS DATA ====================
    async getBills(params = {}) {
        try {
            const response = await api.getBills(params)
            const bills = response?.bills || response || []

            return bills.map(b => ({
                id: b.id,
                billNumber: b.bill_number || `BILL-${b.id}`,
                bill_number: b.bill_number || `BILL-${b.id}`,
                customerName: b.customer_name || b.customer?.name || 'Walk-in',
                customer_name: b.customer_name || b.customer?.name || 'Walk-in',
                customer_phone: b.customer_phone || '',
                customerId: b.customer_id,
                // Backend BillSummary returns total_amount, BillResponse returns total_amount
                total: b.total_amount || b.total || 0,
                total_amount: b.total_amount || b.total || 0,
                subtotal: b.subtotal || b.total_amount || b.total || 0,
                tax: b.tax_amount || b.tax || 0,
                discount: b.discount_amount || b.discount || 0,
                // Backend uses payment_method enum
                paymentMethod: b.payment_method || b.payment_mode || 'cash',
                payment_mode: b.payment_method || b.payment_mode || 'cash',
                status: b.status || 'completed',
                // BillSummary has items_count (integer), not items array
                items: b.items || [],
                items_count: b.items_count || b.items?.length || 0,
                createdAt: b.created_at,
                created_at: b.created_at,
                createdBy: b.created_by
            }))
        } catch (error) {
            console.error('Failed to fetch bills:', error)
            return []
        }
    }

    // Get a single bill with full details (including items)
    async getBillById(billId) {
        try {
            const response = await api.request(`/bills/${billId}`)
            const b = response
            return {
                id: b.id,
                bill_number: b.bill_number,
                customer_name: b.customer_name || 'Walk-in',
                customer_phone: b.customer_phone || '',
                total: b.total_amount || 0,
                subtotal: b.subtotal || 0,
                tax: b.tax_amount || 0,
                discount: b.discount_amount || 0,
                payment_mode: b.payment_method || 'cash',
                status: b.status || 'completed',
                items: (b.items || []).map(item => ({
                    product_name: item.product_name,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total: item.total,
                    subtotal: item.subtotal,
                    tax_amount: item.tax_amount,
                    discount_amount: item.discount_amount
                })),
                created_at: b.created_at,
                amount_paid: b.amount_paid || 0,
                change_amount: b.change_amount || 0
            }
        } catch (error) {
            console.error('Failed to fetch bill details:', error)
            return null
        }
    }

    async getTodayBills() {
        const today = new Date().toISOString().split('T')[0]
        return this.getBills({ date: today })
    }

    // ==================== CUSTOMERS DATA ====================
    async getCustomers() {
        try {
            const response = await api.getCustomers()
            const customers = response?.customers || response || []

            return customers.map(c => ({
                id: c.id,
                name: c.name || c.full_name || '',
                phone: c.phone || '',
                email: c.email || '',
                address: c.address || '',
                credit: c.credit || c.outstanding || c.pending_amount || 0,
                totalPurchases: c.total_purchases || 0,
                total_purchases: c.total_purchases || 0,
                totalSpent: c.total_spent || 0,
                loyaltyPoints: c.loyalty_points || 0,
                lastVisit: c.last_visit || c.updated_at,
                last_purchase: c.last_purchase || c.last_visit || c.updated_at,
                createdAt: c.created_at
            }))
        } catch (error) {
            console.error('Failed to fetch customers:', error)
            return []
        }
    }

    // ==================== ANALYTICS DATA ====================
    async getAnalytics(period = 'week') {
        try {
            // First try API
            const response = await api.getAnalytics?.(period)
            if (response && response.total_sales > 0) {
                return {
                    totalSales: response.total_sales || 0,
                    totalBills: response.total_bills || 0,
                    avgBillValue: response.avg_bill_value || 0,
                    growth: response.growth || 0,
                    topProducts: response.top_products || [],
                    salesByDay: response.sales_by_day || [],
                    salesByHour: response.sales_by_hour || [],
                    paymentBreakdown: response.payment_breakdown || { cash: 0, upi: 0, card: 0, credit: 0 }
                }
            }

            // Fallback: Compute from bills
            const bills = await this.getBills()
            const now = new Date()
            const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365
            const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

            const filteredBills = bills.filter(b => new Date(b.createdAt || b.created_at) >= startDate)
            const totalSales = filteredBills.reduce((sum, b) => sum + (b.total || 0), 0)
            const totalBills = filteredBills.length
            const avgBillValue = totalBills > 0 ? totalSales / totalBills : 0

            // Calculate payment breakdown
            const paymentBreakdown = { cash: 0, upi: 0, card: 0, credit: 0 }
            filteredBills.forEach(bill => {
                const mode = (bill.payment_mode || bill.paymentMode || 'cash').toLowerCase()
                paymentBreakdown[mode] = (paymentBreakdown[mode] || 0) + (bill.total || 0)
            })

            // Calculate sales by day of week
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const salesByDayMap = {}
            dayNames.forEach(d => salesByDayMap[d] = 0)
            filteredBills.forEach(bill => {
                const day = dayNames[new Date(bill.createdAt || bill.created_at).getDay()]
                salesByDayMap[day] += bill.total || 0
            })
            const salesByDay = dayNames.map(day => ({ day, sales: salesByDayMap[day] }))

            // Calculate sales by hour
            const salesByHourMap = {}
            for (let h = 0; h < 24; h++) salesByHourMap[h] = 0
            filteredBills.forEach(bill => {
                const hour = new Date(bill.createdAt || bill.created_at).getHours()
                salesByHourMap[hour] += bill.total || 0
            })
            const salesByHour = Object.entries(salesByHourMap)
                .filter(([_, sales]) => sales > 0)
                .map(([hour, sales]) => ({ hour: `${hour}:00`, sales }))

            // Calculate top products from bill items
            const productSales = {}
            filteredBills.forEach(bill => {
                (bill.items || []).forEach(item => {
                    const name = item.product_name || item.name || 'Unknown'
                    productSales[name] = (productSales[name] || 0) + (item.quantity || 1)
                })
            })
            const topProducts = Object.entries(productSales)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, qty]) => ({ name, quantity: qty }))

            // Calculate growth (compare to previous period)
            const prevStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000)
            const prevBills = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= prevStart && date < startDate
            })
            const prevSales = prevBills.reduce((sum, b) => sum + (b.total || 0), 0)
            const growth = prevSales > 0 ? ((totalSales - prevSales) / prevSales * 100) : 0

            return {
                totalSales,
                totalBills,
                avgBillValue,
                growth: parseFloat(growth.toFixed(1)),
                topProducts,
                salesByDay,
                salesByHour,
                paymentBreakdown,
                // AI Predictions based on data
                predictions: {
                    nextWeekSales: Math.round(totalSales * 1.1),
                    peakDay: salesByDay.sort((a, b) => b.sales - a.sales)[0]?.day || 'Saturday',
                    peakHour: salesByHour.sort((a, b) => b.sales - a.sales)[0]?.hour || '11:00',
                    suggestedRestock: topProducts.slice(0, 3).map(p => p.name)
                }
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
            return {
                totalSales: 0,
                totalBills: 0,
                avgBillValue: 0,
                growth: 0,
                topProducts: [],
                salesByDay: [],
                salesByHour: [],
                paymentBreakdown: { cash: 0, upi: 0, card: 0, credit: 0 },
                predictions: { nextWeekSales: 0, peakDay: 'N/A', peakHour: 'N/A', suggestedRestock: [] }
            }
        }
    }

    async getTopProducts(limit = 10) {
        try {
            const analytics = await this.getAnalytics()
            return analytics.topProducts.slice(0, limit)
        } catch (error) {
            return []
        }
    }

    // ==================== EXPENSES DATA ====================
    async getExpenses(params = {}) {
        try {
            const response = await api.getExpenses?.(params) || []
            return Array.isArray(response) ? response : response.expenses || []
        } catch (error) {
            console.error('Failed to fetch expenses:', error)
            return []
        }
    }

    async getExpenseSummary() {
        try {
            const expenses = await this.getExpenses()
            const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
            const byCategory = expenses.reduce((acc, e) => {
                const cat = e.category || 'Other'
                acc[cat] = (acc[cat] || 0) + (e.amount || 0)
                return acc
            }, {})

            return { total, byCategory, count: expenses.length }
        } catch (error) {
            return { total: 0, byCategory: {}, count: 0 }
        }
    }

    // ==================== SUPPLIERS DATA ====================
    async getSuppliers() {
        try {
            const response = await api.getSuppliers?.() || []
            return Array.isArray(response) ? response : response.suppliers || []
        } catch (error) {
            console.error('Failed to fetch suppliers:', error)
            return []
        }
    }

    // ==================== AI INSIGHTS ====================
    async getAIInsights() {
        try {
            const insights = await api.getAIInsights?.()
            return insights?.insights || []
        } catch (error) {
            return []
        }
    }

    async getAgentSuggestions() {
        try {
            const response = await api.getAgentSuggestions?.()
            return response?.suggestions || []
        } catch (error) {
            return []
        }
    }

    // ==================== DAILY SUMMARY ====================
    async getDailySummary(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0]
            const [stats, bills, expenses] = await Promise.all([
                this.getDashboardStats(),
                this.getBills({ date: targetDate }),
                this.getExpenses({ date: targetDate })
            ])

            return {
                date: targetDate,
                totalSales: stats.todaySales,
                billCount: bills.length,
                avgBillValue: bills.length > 0
                    ? bills.reduce((sum, b) => sum + b.total, 0) / bills.length
                    : 0,
                totalExpenses: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
                netProfit: stats.todaySales - expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
                topSellingProducts: await this.getTopProducts(5),
                paymentBreakdown: this.calculatePaymentBreakdown(bills)
            }
        } catch (error) {
            console.error('Failed to get daily summary:', error)
            return null
        }
    }

    calculatePaymentBreakdown(bills) {
        return bills.reduce((acc, bill) => {
            const method = bill.paymentMethod || 'cash'
            acc[method] = (acc[method] || 0) + bill.total
            return acc
        }, { cash: 0, upi: 0, card: 0, credit: 0 })
    }

    // ==================== STORE SETTINGS ====================
    async getStoreSettings() {
        try {
            return await api.getStoreSettings?.() || {}
        } catch (error) {
            return {}
        }
    }

    // ==================== LOYALTY & REWARDS ====================
    async getLoyaltyProgram() {
        try {
            return await api.getLoyaltyProgram?.() || {
                pointsPerRupee: 1,
                pointsValue: 0.1,
                tiers: []
            }
        } catch (error) {
            return { pointsPerRupee: 1, pointsValue: 0.1, tiers: [] }
        }
    }

    // ==================== ADVANCED AI PREDICTIONS ====================
    async getAIPredictions() {
        try {
            const [bills, products, customers] = await Promise.all([
                this.getBills(),
                this.getProducts(),
                this.getCustomers()
            ])

            const now = new Date()
            const dayOfWeek = now.getDay()
            const hour = now.getHours()

            // Calculate trends from last 30 days
            const last30Days = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= new Date(now - 30 * 24 * 60 * 60 * 1000)
            })

            const last7Days = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= new Date(now - 7 * 24 * 60 * 60 * 1000)
            })

            // Daily averages
            const avg30Day = last30Days.reduce((sum, b) => sum + (b.total || 0), 0) / 30
            const avg7Day = last7Days.reduce((sum, b) => sum + (b.total || 0), 0) / 7

            // Growth trend
            const weeklyGrowth = avg30Day > 0 ? ((avg7Day - avg30Day) / avg30Day * 100) : 0

            // Day-wise analysis for seasonality
            const dayWiseSales = {}
            last30Days.forEach(bill => {
                const day = new Date(bill.createdAt || bill.created_at).getDay()
                dayWiseSales[day] = (dayWiseSales[day] || 0) + (bill.total || 0)
            })
            const peakDay = Object.entries(dayWiseSales).sort((a, b) => b[1] - a[1])[0]
            const slowDay = Object.entries(dayWiseSales).sort((a, b) => a[1] - b[1])[0]
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

            // Hour-wise analysis
            const hourWiseSales = {}
            last30Days.forEach(bill => {
                const h = new Date(bill.createdAt || bill.created_at).getHours()
                hourWiseSales[h] = (hourWiseSales[h] || 0) + (bill.total || 0)
            })
            const peakHour = Object.entries(hourWiseSales).sort((a, b) => b[1] - a[1])[0]

            // Customer segmentation
            const customerSpending = {}
            last30Days.forEach(bill => {
                const phone = bill.customer_phone || bill.customerPhone || 'walkin'
                customerSpending[phone] = (customerSpending[phone] || 0) + (bill.total || 0)
            })
            const sortedCustomers = Object.entries(customerSpending).sort((a, b) => b[1] - a[1])
            const vipCustomers = sortedCustomers.slice(0, 5)
            const totalFromVIP = vipCustomers.reduce((sum, [_, val]) => sum + val, 0)
            const totalSales30 = last30Days.reduce((sum, b) => sum + (b.total || 0), 0)

            // Product predictions
            const productSales = {}
            last30Days.forEach(bill => {
                (bill.items || []).forEach(item => {
                    const name = item.product_name || item.name
                    productSales[name] = (productSales[name] || 0) + (item.quantity || 1)
                })
            })
            const fastMoving = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5)
            const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5))

            // Revenue forecast using weighted moving average
            const weights = [0.4, 0.3, 0.2, 0.1] // More recent = higher weight
            const weeklyRevenues = []
            for (let w = 0; w < 4; w++) {
                const start = new Date(now - (w + 1) * 7 * 24 * 60 * 60 * 1000)
                const end = new Date(now - w * 7 * 24 * 60 * 60 * 1000)
                const weekRev = bills.filter(b => {
                    const d = new Date(b.createdAt || b.created_at)
                    return d >= start && d < end
                }).reduce((sum, b) => sum + (b.total || 0), 0)
                weeklyRevenues.push(weekRev)
            }
            const forecastNextWeek = weeklyRevenues.reduce((sum, rev, i) => sum + rev * (weights[i] || 0.1), 0) * 1.05
            const forecastNextMonth = forecastNextWeek * 4.2

            return {
                summary: {
                    weeklyGrowth: parseFloat(weeklyGrowth.toFixed(1)),
                    trend: weeklyGrowth >= 0 ? 'up' : 'down',
                    avgDailySales: Math.round(avg7Day),
                    totalBillsLast30Days: last30Days.length
                },
                seasonality: {
                    peakDay: dayNames[parseInt(peakDay?.[0]) || 6],
                    peakDayRevenue: Math.round(peakDay?.[1] || 0),
                    slowDay: dayNames[parseInt(slowDay?.[0]) || 0],
                    slowDayRevenue: Math.round(slowDay?.[1] || 0),
                    peakHour: `${peakHour?.[0] || 11}:00`,
                    peakHourRevenue: Math.round(peakHour?.[1] || 0)
                },
                customerInsights: {
                    vipCustomerCount: vipCustomers.length,
                    vipContribution: totalSales30 > 0 ? Math.round((totalFromVIP / totalSales30) * 100) : 0,
                    avgTransactionValue: last30Days.length > 0 ? Math.round(totalSales30 / last30Days.length) : 0
                },
                inventory: {
                    fastMovingProducts: fastMoving.map(([name, qty]) => ({ name, quantity: qty })),
                    lowStockCount: lowStock.length,
                    stockAlerts: lowStock.slice(0, 5).map(p => p.name),
                    reorderSuggestions: fastMoving.filter(([name]) =>
                        lowStock.some(ls => ls.name === name)
                    ).map(([name]) => name)
                },
                forecasts: {
                    nextWeekRevenue: Math.round(forecastNextWeek),
                    nextMonthRevenue: Math.round(forecastNextMonth),
                    confidence: last30Days.length >= 30 ? 'high' : last30Days.length >= 14 ? 'medium' : 'low'
                },
                actionItems: this._generateActionItems(weeklyGrowth, lowStock, peakDay, vipCustomers, avg7Day)
            }
        } catch (error) {
            console.error('AI Predictions failed:', error)
            return {
                summary: { weeklyGrowth: 0, trend: 'neutral', avgDailySales: 0 },
                forecasts: { nextWeekRevenue: 0, confidence: 'low' },
                actionItems: ['Start creating bills to unlock AI predictions!']
            }
        }
    }

    _generateActionItems(growth, lowStock, peakDay, vipCustomers, avgDaily) {
        const items = []

        if (growth < -10) {
            items.push('📉 Sales declining - consider running a promotion!')
        } else if (growth > 20) {
            items.push('🚀 Great growth! Consider stocking up on fast-moving items.')
        }

        if (lowStock.length > 3) {
            items.push(`⚠️ ${lowStock.length} products need restocking urgently!`)
        }

        if (vipCustomers.length > 0) {
            items.push('💎 Send loyalty rewards to your top 5 customers.')
        }

        if (avgDaily < 1000 && avgDaily > 0) {
            items.push('💡 Tip: Offer combo deals to increase average bill value.')
        }

        if (items.length === 0) {
            items.push('✨ Business running smoothly! Keep up the great work.')
        }

        return items
    }

    // ==================== BUSINESS HEALTH SCORE ====================
    async getBusinessHealthScore() {
        try {
            const [bills, products, customers] = await Promise.all([
                this.getBills(),
                this.getProducts(),
                this.getCustomers()
            ])

            const now = new Date()

            // Last 30 days bills
            const last30Days = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= new Date(now - 30 * 24 * 60 * 60 * 1000)
            })

            const last7Days = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= new Date(now - 7 * 24 * 60 * 60 * 1000)
            })

            const metrics = {}
            let totalScore = 0
            let maxScore = 0

            // 1. Sales Growth Score (0-15 points)
            const weeklyRevenue = last7Days.reduce((sum, b) => sum + (b.total || 0), 0)
            const prevWeekRevenue = bills.filter(b => {
                const date = new Date(b.createdAt || b.created_at)
                return date >= new Date(now - 14 * 24 * 60 * 60 * 1000) && date < new Date(now - 7 * 24 * 60 * 60 * 1000)
            }).reduce((sum, b) => sum + (b.total || 0), 0)

            const growthRate = prevWeekRevenue > 0 ? ((weeklyRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : 0
            const growthScore = Math.min(15, Math.max(0, 7.5 + (growthRate * 0.5)))
            metrics.growth = { score: growthScore, max: 15, value: `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`, status: growthRate >= 10 ? 'excellent' : growthRate >= 0 ? 'good' : 'needs_attention' }
            totalScore += growthScore
            maxScore += 15

            // 2. Inventory Health (0-15 points)
            const totalProducts = products.length
            const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 5)).length
            const outOfStockProducts = products.filter(p => (p.stock || 0) === 0).length
            const inventoryScore = totalProducts > 0 ? Math.max(0, 15 - (lowStockProducts * 2) - (outOfStockProducts * 5)) : 15
            metrics.inventory = { score: Math.min(15, inventoryScore), max: 15, value: `${lowStockProducts} low, ${outOfStockProducts} out`, status: outOfStockProducts === 0 && lowStockProducts <= 3 ? 'excellent' : lowStockProducts <= 5 ? 'good' : 'needs_attention' }
            totalScore += Math.min(15, inventoryScore)
            maxScore += 15

            // 3. Customer Retention (0-15 points)
            const repeatCustomers = customers.filter(c => (c.visit_count || c.visits || 0) > 1).length
            const retentionRate = customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0
            const retentionScore = (retentionRate / 100) * 15
            metrics.retention = { score: retentionScore, max: 15, value: `${retentionRate.toFixed(0)}%`, status: retentionRate >= 60 ? 'excellent' : retentionRate >= 30 ? 'good' : 'needs_attention' }
            totalScore += retentionScore
            maxScore += 15

            // 4. Average Bill Value (0-10 points)
            const avgBill = last30Days.length > 0 ? last30Days.reduce((sum, b) => sum + (b.total || 0), 0) / last30Days.length : 0
            const avgBillScore = Math.min(10, avgBill / 50) // ₹500+ gets full score
            metrics.avgBill = { score: avgBillScore, max: 10, value: `₹${avgBill.toFixed(0)}`, status: avgBill >= 400 ? 'excellent' : avgBill >= 200 ? 'good' : 'needs_attention' }
            totalScore += avgBillScore
            maxScore += 10

            // 5. Transaction Frequency (0-10 points)
            const dailyTransactions = last30Days.length / 30
            const frequencyScore = Math.min(10, dailyTransactions * 2) // 5+ transactions/day = full score
            metrics.frequency = { score: frequencyScore, max: 10, value: `${dailyTransactions.toFixed(1)}/day`, status: dailyTransactions >= 5 ? 'excellent' : dailyTransactions >= 2 ? 'good' : 'needs_attention' }
            totalScore += frequencyScore
            maxScore += 10

            // 6. Payment Collection (0-10 points)
            const creditBills = last30Days.filter(b => b.payment_mode === 'credit' || b.payment_mode === 'Credit').length
            const creditRatio = last30Days.length > 0 ? (creditBills / last30Days.length) * 100 : 0
            const collectionScore = Math.max(0, 10 - (creditRatio * 0.5))
            metrics.collection = { score: collectionScore, max: 10, value: `${creditRatio.toFixed(0)}% credit`, status: creditRatio <= 10 ? 'excellent' : creditRatio <= 30 ? 'good' : 'needs_attention' }
            totalScore += collectionScore
            maxScore += 10

            // 7. Product Diversity (0-10 points)
            const uniqueProductsSold = new Set()
            last30Days.forEach(bill => {
                (bill.items || []).forEach(item => {
                    uniqueProductsSold.add(item.product_id || item.product_name)
                })
            })
            const diversityRatio = totalProducts > 0 ? (uniqueProductsSold.size / totalProducts) * 100 : 0
            const diversityScore = (diversityRatio / 100) * 10
            metrics.diversity = { score: diversityScore, max: 10, value: `${uniqueProductsSold.size}/${totalProducts}`, status: diversityRatio >= 50 ? 'excellent' : diversityRatio >= 25 ? 'good' : 'needs_attention' }
            totalScore += diversityScore
            maxScore += 10

            // 8. Customer Credit Health (0-10 points)
            const customersWithCredit = customers.filter(c => (c.credit || 0) > 0)
            const totalCredit = customersWithCredit.reduce((sum, c) => sum + (c.credit || 0), 0)
            const creditHealthScore = Math.max(0, 10 - (customersWithCredit.length * 0.5))
            metrics.creditHealth = { score: creditHealthScore, max: 10, value: `₹${totalCredit.toLocaleString()}`, status: customersWithCredit.length <= 3 ? 'excellent' : customersWithCredit.length <= 10 ? 'good' : 'needs_attention' }
            totalScore += creditHealthScore
            maxScore += 10

            // 9. Consistency Score (0-5 points)
            const daysWithSales = new Set(last30Days.map(b => new Date(b.createdAt || b.created_at).toDateString())).size
            const consistencyRatio = daysWithSales / 30
            const consistencyScore = consistencyRatio * 5
            metrics.consistency = { score: consistencyScore, max: 5, value: `${daysWithSales}/30 days`, status: daysWithSales >= 25 ? 'excellent' : daysWithSales >= 15 ? 'good' : 'needs_attention' }
            totalScore += consistencyScore
            maxScore += 5

            // Calculate overall score
            const overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

            // Determine grade
            let grade, gradeColor, recommendation
            if (overallScore >= 90) {
                grade = 'A+'
                gradeColor = '#22c55e'
                recommendation = 'Exceptional! Your business is thriving. Focus on scaling and expansion.'
            } else if (overallScore >= 80) {
                grade = 'A'
                gradeColor = '#22c55e'
                recommendation = 'Excellent performance! Minor optimizations can push you to A+.'
            } else if (overallScore >= 70) {
                grade = 'B'
                gradeColor = '#84cc16'
                recommendation = 'Good health! Focus on areas marked as "needs attention".'
            } else if (overallScore >= 60) {
                grade = 'C'
                gradeColor = '#f59e0b'
                recommendation = 'Fair performance. Prioritize inventory and customer retention.'
            } else if (overallScore >= 50) {
                grade = 'D'
                gradeColor = '#f97316'
                recommendation = 'Needs improvement. Focus on increasing daily transactions.'
            } else {
                grade = 'F'
                gradeColor = '#ef4444'
                recommendation = 'Critical! Immediate action required on multiple fronts.'
            }

            return {
                score: overallScore,
                grade,
                gradeColor,
                recommendation,
                metrics,
                lastUpdated: new Date().toISOString(),
                dataPoints: last30Days.length
            }
        } catch (error) {
            console.error('Failed to calculate business health:', error)
            return {
                score: 0,
                grade: 'N/A',
                gradeColor: '#6b7280',
                recommendation: 'Start creating bills to calculate your business health score!',
                metrics: {},
                lastUpdated: new Date().toISOString(),
                dataPoints: 0
            }
        }
    }
}

// Export singleton instance
const realDataService = new RealDataService()
export default realDataService

// Named exports for specific data
export const {
    getDashboardStats,
    getDashboardActivity,
    getProducts,
    getLowStockProducts,
    getBills,
    getCustomers,
    getAnalytics,
    getExpenses,
    getSuppliers,
    getAIInsights,
    getDailySummary,
    getStoreSettings
} = realDataService
