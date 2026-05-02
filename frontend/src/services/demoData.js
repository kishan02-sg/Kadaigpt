// Demo data for hackathon presentation
// This simulates real data that would come from the backend

export const demoProducts = [
    { id: 1, name: "Basmati Rice", sku: "SKU001", barcode: "8901491101219", price: 85, unit: "kg", stock: 45, minStock: 20, category: "Grains", dailySales: 5, trend: "up" },
    { id: 2, name: "Toor Dal", sku: "SKU002", barcode: "8901030865702", price: 140, unit: "kg", stock: 8, minStock: 15, category: "Pulses", dailySales: 3, trend: "stable" },
    { id: 3, name: "Sugar", sku: "SKU003", barcode: "8901030865703", price: 45, unit: "kg", stock: 120, minStock: 50, category: "Essentials", dailySales: 8, trend: "up" },
    { id: 4, name: "Sunflower Oil", sku: "SKU004", barcode: "8906002470150", price: 180, unit: "L", stock: 25, minStock: 15, category: "Oils", dailySales: 4, trend: "up" },
    { id: 5, name: "Salt", sku: "SKU005", barcode: "8902519002267", price: 20, unit: "kg", stock: 5, minStock: 20, category: "Essentials", dailySales: 2, trend: "down" },
    { id: 6, name: "Wheat Flour", sku: "SKU006", barcode: "8901491101220", price: 55, unit: "kg", stock: 60, minStock: 30, category: "Grains", dailySales: 6, trend: "stable" },
    { id: 7, name: "Tea Powder", sku: "SKU007", barcode: "8901030865707", price: 280, unit: "kg", stock: 15, minStock: 10, category: "Beverages", dailySales: 2, trend: "up" },
    { id: 8, name: "Coffee", sku: "SKU008", barcode: "8901030865708", price: 450, unit: "kg", stock: 10, minStock: 8, category: "Beverages", dailySales: 1, trend: "stable" },
    { id: 9, name: "Milk", sku: "SKU009", barcode: "8901030865709", price: 60, unit: "L", stock: 100, minStock: 50, category: "Dairy", dailySales: 20, trend: "up" },
    { id: 10, name: "Butter", sku: "SKU010", barcode: "8901725133108", price: 55, unit: "pcs", stock: 40, minStock: 20, category: "Dairy", dailySales: 3, trend: "stable" },
    { id: 11, name: "Maggi Noodles", sku: "SKU011", barcode: "8901030535581", price: 14, unit: "pcs", stock: 150, minStock: 50, category: "Packaged", dailySales: 12, trend: "up" },
    { id: 12, name: "Parle-G Biscuits", sku: "SKU012", barcode: "8901058851837", price: 10, unit: "pcs", stock: 200, minStock: 80, category: "Snacks", dailySales: 15, trend: "up" },
    { id: 13, name: "Britannia Good Day", sku: "SKU013", barcode: "8901030865701", price: 35, unit: "pcs", stock: 85, minStock: 30, category: "Snacks", dailySales: 6, trend: "stable" },
    { id: 14, name: "Surf Excel", sku: "SKU014", barcode: "8901063090774", price: 245, unit: "kg", stock: 20, minStock: 10, category: "Household", dailySales: 2, trend: "stable" },
    { id: 15, name: "Colgate Toothpaste", sku: "SKU015", barcode: "8901063090775", price: 85, unit: "pcs", stock: 45, minStock: 20, category: "Personal Care", dailySales: 3, trend: "up" },
]

export const demoBills = [
    { id: 1, bill_number: "INV-2026-0047", customer_name: "Rajesh Kumar", customer_phone: "9876543210", items: [{ product_name: "Basmati Rice", quantity: 2, unit_price: 85 }, { product_name: "Toor Dal", quantity: 1, unit_price: 140 }], subtotal: 310, tax: 15.5, total: 325.5, payment_mode: "UPI", created_at: new Date().toISOString(), status: "completed" },
    { id: 2, bill_number: "INV-2026-0046", customer_name: "Priya Sharma", customer_phone: "9876543211", items: [{ product_name: "Sugar", quantity: 3, unit_price: 45 }, { product_name: "Salt", quantity: 2, unit_price: 20 }], subtotal: 175, tax: 8.75, total: 183.75, payment_mode: "Cash", created_at: new Date(Date.now() - 1800000).toISOString(), status: "completed" },
    { id: 3, bill_number: "INV-2026-0045", customer_name: "Walk-in Customer", customer_phone: "", items: [{ product_name: "Sunflower Oil", quantity: 2, unit_price: 180 }], subtotal: 360, tax: 18, total: 378, payment_mode: "Cash", created_at: new Date(Date.now() - 3600000).toISOString(), status: "completed" },
    { id: 4, bill_number: "INV-2026-0044", customer_name: "Amit Patel", customer_phone: "9876543212", items: [{ product_name: "Tea Powder", quantity: 1, unit_price: 280 }, { product_name: "Coffee", quantity: 1, unit_price: 450 }], subtotal: 730, tax: 36.5, total: 766.5, payment_mode: "Card", created_at: new Date(Date.now() - 7200000).toISOString(), status: "completed" },
    { id: 5, bill_number: "INV-2026-0043", customer_name: "Sunita Verma", customer_phone: "9876543213", items: [{ product_name: "Wheat Flour", quantity: 5, unit_price: 55 }, { product_name: "Milk", quantity: 10, unit_price: 60 }], subtotal: 875, tax: 43.75, total: 918.75, payment_mode: "UPI", created_at: new Date(Date.now() - 14400000).toISOString(), status: "completed" },
    { id: 6, bill_number: "INV-2026-0042", customer_name: "Mohan Singh", customer_phone: "9876543214", items: [{ product_name: "Maggi Noodles", quantity: 10, unit_price: 14 }, { product_name: "Parle-G Biscuits", quantity: 5, unit_price: 10 }], subtotal: 190, tax: 9.5, total: 199.5, payment_mode: "Cash", created_at: new Date(Date.now() - 28800000).toISOString(), status: "completed" },
    { id: 7, bill_number: "INV-2026-0041", customer_name: "Kavita Reddy", customer_phone: "9876543215", items: [{ product_name: "Butter", quantity: 2, unit_price: 55 }, { product_name: "Milk", quantity: 5, unit_price: 60 }], subtotal: 410, tax: 20.5, total: 430.5, payment_mode: "UPI", created_at: new Date(Date.now() - 43200000).toISOString(), status: "completed" },
]

export const demoCustomers = [
    { id: 1, name: "Rajesh Kumar", phone: "9876543210", credit: 2500, lastPurchase: "2026-01-30", totalPurchases: 45600, isPaid: false, visits: 45 },
    { id: 2, name: "Priya Sharma", phone: "9876543211", credit: 0, lastPurchase: "2026-01-29", totalPurchases: 23400, isPaid: true, visits: 32 },
    { id: 3, name: "Amit Patel", phone: "9876543212", credit: 1850, lastPurchase: "2026-01-28", totalPurchases: 67800, isPaid: false, visits: 56 },
    { id: 4, name: "Sunita Verma", phone: "9876543213", credit: 500, lastPurchase: "2026-01-27", totalPurchases: 12300, isPaid: false, visits: 18 },
    { id: 5, name: "Mohan Singh", phone: "9876543214", credit: 0, lastPurchase: "2026-01-25", totalPurchases: 34500, isPaid: true, visits: 28 },
    { id: 6, name: "Kavita Reddy", phone: "9876543215", credit: 3200, lastPurchase: "2026-01-24", totalPurchases: 52100, isPaid: false, visits: 41 },
    { id: 7, name: "Venkat Rao", phone: "9876543216", credit: 0, lastPurchase: "2026-01-23", totalPurchases: 18900, isPaid: true, visits: 15 },
]

export const demoSuppliers = [
    { id: 1, name: "Metro Wholesale", contact: "Ajay Kumar", phone: "9876543210", address: "Kuniyamuthur, Coimbatore", category: "Grains", rating: 4.5, totalOrders: 45, pendingAmount: 12500, email: "metro@wholesale.com" },
    { id: 2, name: "Reliance Fresh B2B", contact: "Suresh Menon", phone: "9876543211", address: "RS Puram, Coimbatore", category: "Dairy", rating: 4.8, totalOrders: 32, pendingAmount: 0, email: "reliance@fresh.com" },
    { id: 3, name: "Udaan India", contact: "Priya Verma", phone: "9876543212", address: "Gandhipuram, Coimbatore", category: "General", rating: 4.2, totalOrders: 28, pendingAmount: 8500, email: "support@udaan.in" },
    { id: 4, name: "JioMart Business", contact: "Rahul Sharma", phone: "9876543213", address: "Saibaba Colony, Coimbatore", category: "FMCG", rating: 4.6, totalOrders: 15, pendingAmount: 0, email: "business@jiomart.com" },
]

export const demoAnalytics = {
    todaySales: 24580,
    todayBills: 47,
    avgBillValue: 523,
    lowStockCount: 5,
    weeklySales: [24580, 28450, 22100, 26780, 31200, 38500, 29800],
    weeklyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    hourlyData: [
        { hour: '9AM', sales: 2500, customers: 5 },
        { hour: '10AM', sales: 4200, customers: 9 },
        { hour: '11AM', sales: 6800, customers: 15 },
        { hour: '12PM', sales: 5100, customers: 12 },
        { hour: '1PM', sales: 3200, customers: 8 },
        { hour: '2PM', sales: 2800, customers: 6 },
        { hour: '3PM', sales: 3500, customers: 8 },
        { hour: '4PM', sales: 4800, customers: 11 },
        { hour: '5PM', sales: 5500, customers: 13 },
        { hour: '6PM', sales: 6200, customers: 14 },
        { hour: '7PM', sales: 4500, customers: 10 },
        { hour: '8PM', sales: 2900, customers: 7 },
    ],
    topProducts: [
        { name: "Basmati Rice", sales: 45, revenue: 3825, trend: 12 },
        { name: "Toor Dal", sales: 38, revenue: 5320, trend: 8 },
        { name: "Sunflower Oil", sales: 32, revenue: 5760, trend: -3 },
        { name: "Sugar", sales: 28, revenue: 1260, trend: 5 },
        { name: "Maggi Noodles", sales: 150, revenue: 2100, trend: 20 },
    ],
    categoryBreakdown: [
        { name: "Grains", percentage: 28, revenue: 68500 },
        { name: "Pulses", percentage: 22, revenue: 53900 },
        { name: "Oils", percentage: 18, revenue: 44100 },
        { name: "Dairy", percentage: 15, revenue: 36750 },
        { name: "Packaged", percentage: 10, revenue: 24500 },
        { name: "Others", percentage: 7, revenue: 17150 },
    ]
}

export const demoGSTData = {
    summary: {
        totalSales: 245680,
        taxableAmount: 233981,
        cgst: 5849.52,
        sgst: 5849.52,
        totalGST: 11699.04,
        exemptSales: 11699
    },
    breakdown: [
        { category: "Grains & Cereals", sales: 85000, gstRate: 0, cgst: 0, sgst: 0 },
        { category: "Pulses & Dal", sales: 45000, gstRate: 5, cgst: 1125, sgst: 1125 },
        { category: "Cooking Oils", sales: 38000, gstRate: 5, cgst: 950, sgst: 950 },
        { category: "Packaged Foods", sales: 32000, gstRate: 12, cgst: 1920, sgst: 1920 },
        { category: "Beverages", sales: 25680, gstRate: 18, cgst: 2311.2, sgst: 2311.2 },
        { category: "Dairy Products", sales: 20000, gstRate: 0, cgst: 0, sgst: 0 },
    ],
    monthly: [
        { month: "Jan 2026", sales: 245680, gst: 11699.04, filed: true },
        { month: "Dec 2025", sales: 228450, gst: 10892.14, filed: true },
        { month: "Nov 2025", sales: 215320, gst: 10253.24, filed: true },
        { month: "Oct 2025", sales: 198760, gst: 9465.16, filed: true },
    ],
    invoices: [
        { invoiceNo: "INV-2026-0047", date: "2026-01-31", customerGstin: "33AABCU9603R1ZM", taxableAmount: 310, cgst: 7.75, sgst: 7.75, total: 325.5 },
        { invoiceNo: "INV-2026-0046", date: "2026-01-31", customerGstin: null, taxableAmount: 175, cgst: 4.38, sgst: 4.38, total: 183.75 },
        { invoiceNo: "INV-2026-0045", date: "2026-01-30", customerGstin: null, taxableAmount: 360, cgst: 9, sgst: 9, total: 378 },
        { invoiceNo: "INV-2026-0044", date: "2026-01-30", customerGstin: "33AABCU9603R1ZN", taxableAmount: 730, cgst: 18.25, sgst: 18.25, total: 766.5 },
        { invoiceNo: "INV-2026-0043", date: "2026-01-29", customerGstin: null, taxableAmount: 875, cgst: 21.88, sgst: 21.88, total: 918.75 },
    ]
}

// Barcode lookup database
export const barcodeDatabase = {
    '8901030865701': { name: 'Britannia Good Day', price: 35, unit: 'pcs', id: 13 },
    '8901058851837': { name: 'Parle-G Biscuits', price: 10, unit: 'pcs', id: 12 },
    '8902519002267': { name: 'Tata Salt 1kg', price: 28, unit: 'pcs', id: 5 },
    '8901491101219': { name: 'Aashirvaad Atta 5kg', price: 280, unit: 'pcs', id: 6 },
    '8901725133108': { name: 'Amul Butter 100g', price: 55, unit: 'pcs', id: 10 },
    '8901030535581': { name: 'Maggi Noodles', price: 14, unit: 'pcs', id: 11 },
    '8906002470150': { name: 'Fortune Oil 1L', price: 180, unit: 'pcs', id: 4 },
    '8901063090774': { name: 'Surf Excel 1kg', price: 245, unit: 'pcs', id: 14 },
}

// Store info for demo
export const demoStoreInfo = {
    name: 'KadaiGPT Demo Store',
    address: 'Kuniyamuthur, Coimbatore, Tamil Nadu',
    phone: '9876543210',
    gstin: '33AABCU9603R1ZM',
    email: 'demo@KadaiGPT.in',
    website: 'www.KadaiGPT.in'
}

// Activity feed
export const demoActivity = [
    { id: 1, type: 'sale', message: 'New bill #INV-2026-0047 created', time: '2 min ago', amount: 325.5 },
    { id: 2, type: 'stock', message: 'Low stock alert: Salt (5 kg left)', time: '15 min ago' },
    { id: 3, type: 'payment', message: 'Payment received from Amit Patel', time: '1 hour ago', amount: 1000 },
    { id: 4, type: 'sale', message: 'New bill #INV-2026-0046 created', time: '2 hours ago', amount: 183.75 },
    { id: 5, type: 'ocr', message: 'Handwritten bill scanned successfully', time: '3 hours ago' },
    { id: 6, type: 'customer', message: 'New customer Kavita Reddy added', time: '4 hours ago' },
]

export default {
    products: demoProducts,
    bills: demoBills,
    customers: demoCustomers,
    suppliers: demoSuppliers,
    analytics: demoAnalytics,
    gst: demoGSTData,
    barcodes: barcodeDatabase,
    store: demoStoreInfo,
    activity: demoActivity,
}
