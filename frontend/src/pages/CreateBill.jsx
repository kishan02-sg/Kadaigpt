import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, Printer, Save, ShoppingCart, X, Eye, Loader2, MessageSquare, Send, Package, Scale } from 'lucide-react'
import realDataService from '../services/realDataService'
import whatsappService from '../services/whatsapp'
import api from '../services/api'
import { trackBillCreated } from '../components/CelebrationEngine'
import { demoProducts } from '../services/demoData'

const categories = ["All", "Grains", "Pulses", "Essentials", "Oils", "Beverages", "Dairy", "General", "Snacks", "Packaged", "Household", "Personal Care"]

export default function CreateBill({ addToast, setCurrentPage }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [showPayment, setShowPayment] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [billNumber, setBillNumber] = useState('')
  const [printing, setPrinting] = useState(false)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('percentage')
  const [gstRate, setGstRate] = useState(parseInt(localStorage.getItem('kadai_default_gst_rate') || '5'))
  const [existingCustomer, setExistingCustomer] = useState(null)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false)
  const [usingDemoData, setUsingDemoData] = useState(false)
  const [showQtyModal, setShowQtyModal] = useState(null)
  const [showBarcodeInput, setShowBarcodeInput] = useState(false)
  const [allCustomers, setAllCustomers] = useState([])
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    loadProducts()
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const customers = await api.getCustomers?.() || []
      setAllCustomers(Array.isArray(customers) ? customers : [])
    } catch (e) {
      console.log('Could not preload customers:', e)
    }
  }

  const handleCustomerNameChange = (value) => {
    setCustomer({ ...customer, name: value })
    if (value.length >= 2 && allCustomers.length > 0) {
      const matches = allCustomers.filter(c =>
        (c.name || '').toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5)
      setCustomerSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setCustomerSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectCustomerSuggestion = (c) => {
    setCustomer({ name: c.name, phone: c.phone || '' })
    setExistingCustomer(c)
    setCustomerSuggestions([])
    setShowSuggestions(false)
    addToast?.(`Welcome back, ${c.name}! ${c.loyalty_points || 0} points available`, 'success')
  }

  const loadProducts = async () => {
    setLoading(true)
    setUsingDemoData(false)

    try {
      // Try to fetch from real API first
      const productList = await realDataService.getProducts()

      if (Array.isArray(productList) && productList.length > 0) {
        setProducts(productList)
        console.log('✅ Loaded', productList.length, 'products from API')
      } else {
        // Fallback to demo products if API returns empty
        console.log('⚠️ No products from API, using demo data')
        setProducts(demoProducts.map(p => ({
          ...p,
          stock: p.stock || 100,
          isDemo: true
        })))
        setUsingDemoData(true)
        addToast?.('Using demo products. Add real products in Products page.', 'info')
      }
    } catch (error) {
      console.error('Error loading products:', error)
      // Fallback to demo products on error
      console.log('⚠️ API error, using demo data')
      setProducts(demoProducts.map(p => ({
        ...p,
        stock: p.stock || 100,
        isDemo: true
      })))
      setUsingDemoData(true)
      addToast?.('Using demo products. Login to access your inventory.', 'warning')
    } finally {
      setLoading(false)
    }
  }

  // Filter by search AND category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const productCategory = (p.category || 'General').toLowerCase()
    const matchesCategory = selectedCategory === 'All' || productCategory === selectedCategory.toLowerCase()
    return matchesSearch && matchesCategory
  })

  const addToCart = (product) => {
    // Real-time stock check (BUG-001)
    const currentStock = product.stock || product.current_stock || 0
    const existing = cart.find(item => item.id === product.id)
    const currentCartQty = existing ? existing.quantity : 0

    if (currentStock <= 0) {
      addToast(`❌ ${product.name} is out of stock`, 'error')
      return
    }
    if (currentCartQty + 1 > currentStock) {
      addToast(`⚠️ Only ${currentStock} ${product.unit || 'units'} of ${product.name} available`, 'warning')
      return
    }

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
    // BUG-006: No toast for trivial cart additions — visual feedback in cart UI is enough
  }

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0.1, parseFloat((item.quantity + delta).toFixed(2)))
        return { ...item, quantity: newQty }
      }
      return item
    }).filter(item => item.quantity >= 0.1))
  }

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
    setCustomer({ name: '', phone: '' })
    setBillNumber('')
    setDiscount(0)
    setExistingCustomer(null)
    setRedeemPoints(0)
  }

  // Add to cart with custom quantity (for weight-based items)
  const addToCartWithQty = (product, qty) => {
    const quantity = parseFloat(qty) || 1
    if (quantity <= 0) {
      addToast('Please enter a valid quantity', 'error')
      return
    }

    // Real-time stock check (BUG-001)
    const currentStock = product.stock || product.current_stock || 0
    const existing = cart.find(item => item.id === product.id)
    const currentCartQty = existing ? existing.quantity : 0

    if (currentStock <= 0) {
      addToast(`❌ ${product.name} is out of stock`, 'error')
      setShowQtyModal(null)
      return
    }
    if (currentCartQty + quantity > currentStock) {
      addToast(`⚠️ Only ${currentStock} ${product.unit || 'units'} of ${product.name} available (already ${currentCartQty} in cart)`, 'warning')
      setShowQtyModal(null)
      return
    }

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity }])
    }
    // BUG-006: No toast for trivial cart additions
    setShowQtyModal(null)
  }

  // Lookup customer by phone number
  const lookupCustomer = async (phone) => {
    if (!phone || phone.length < 10) {
      setExistingCustomer(null)
      return
    }

    setLookingUpCustomer(true)
    try {
      const customers = await api.getCustomers?.() || []
      const found = customers.find(c => c.phone === phone || c.phone === `+91${phone}`)
      if (found) {
        setExistingCustomer(found)
        setCustomer({ ...customer, name: found.name })
        addToast(`Welcome back, ${found.name}! ${found.loyalty_points || 0} points available`, 'success')
      } else {
        setExistingCustomer(null)
      }
    } catch (error) {
      console.log('Customer lookup failed:', error)
    } finally {
      setLookingUpCustomer(false)
    }
  }

  // Proper billing calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discountAmount = discountType === 'percentage'
    ? Math.round((subtotal * discount) / 100)
    : Math.min(discount, subtotal)
  const pointsDiscount = Math.floor(redeemPoints / 10) // 10 points = ₹1
  const taxableAmount = Math.max(0, subtotal - discountAmount - pointsDiscount)
  const cgst = Math.round((taxableAmount * gstRate) / 200) // Half of GST rate for CGST
  const sgst = Math.round((taxableAmount * gstRate) / 200) // Half of GST rate for SGST
  const tax = cgst + sgst
  const total = taxableAmount + tax
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  // Generate 4-digit invoice number
  const generateInvoiceNumber = () => {
    const lastNum = parseInt(localStorage.getItem('kadai_last_invoice') || '0')
    const newNum = (lastNum + 1) % 10000 // Reset after 9999
    localStorage.setItem('kadai_last_invoice', newNum.toString())
    return `INV-${newNum.toString().padStart(4, '0')}`
  }

  const getBillData = () => ({
    // For preview/print - 4 digit invoice number
    bill_number: billNumber || generateInvoiceNumber(),
    store_name: localStorage.getItem('kadai_store_name') || 'KadaiGPT Store',
    store_address: localStorage.getItem('kadai_store_address') || '',
    store_phone: localStorage.getItem('kadai_store_phone') || '',
    gstin: localStorage.getItem('kadai_gstin') || '',

    // Customer info
    customer_name: customer.name || 'Walk-in Customer',
    customer_phone: customer.phone || '',

    // API requires payment_method enum (lowercase) — Due maps to credit
    payment_method: paymentMode.toLowerCase() === 'due' ? 'credit' : paymentMode.toLowerCase(),
    amount_paid: total,

    // Items in API format
    items: cart.map(item => ({
      product_id: item.id && typeof item.id === 'number' ? item.id : null,
      product_name: item.name,
      product_sku: item.sku || '',
      unit_price: parseFloat(item.price) || 0,
      quantity: parseFloat(item.quantity) || 1,
      discount_percent: 0,
      tax_rate: gstRate || 0
    })),

    // Legacy fields for print/preview
    subtotal,
    discount: discountAmount,
    discount_type: discountType,
    discount_value: discount,
    taxable_amount: taxableAmount,
    cgst,
    sgst,
    gst_rate: gstRate,
    tax,
    total,
    payment_mode: paymentMode,
    use_thermal: localStorage.getItem('kadai_thermal') !== 'false'
  })

  const handlePreview = async () => {
    if (cart.length === 0) {
      addToast('Add items to cart first', 'error')
      return
    }

    try {
      const data = await api.previewReceipt(getBillData())
      setPreviewContent(data.preview)
      setShowPreview(true)
    } catch (err) {
      // Fallback preview
      const bill = getBillData()
      let preview = '================================\n'
      preview += `        ${bill.store_name}\n`
      preview += '================================\n'
      preview += `Bill No: ${bill.bill_number}\n`
      preview += `Date: ${new Date().toLocaleString()}\n`
      preview += `Customer: ${bill.customer_name}\n`
      preview += '--------------------------------\n'
      cart.forEach(item => {
        preview += `${item.name.substring(0, 16).padEnd(16)} ${item.quantity.toString().padStart(4)} ${(item.price * item.quantity).toFixed(2).padStart(10)}\n`
      })
      preview += '--------------------------------\n'
      preview += `${'Subtotal'.padEnd(20)} ₹${subtotal.toFixed(2)}\n`
      preview += `${'GST (5%)'.padEnd(20)} ₹${tax.toFixed(2)}\n`
      preview += '================================\n'
      preview += `${'TOTAL'.padEnd(20)} ₹${total.toFixed(2)}\n`
      preview += '================================\n'
      preview += '        Thank You!\n'
      preview += '    Powered by KadaiGPT\n'
      setPreviewContent(preview)
      setShowPreview(true)
    }
  }

  const handleSaveBill = async () => {
    if (cart.length === 0) {
      addToast('Add items to cart first', 'error')
      return
    }

    const billData = getBillData()
    console.log('📝 Creating bill with payment mode:', paymentMode)
    console.log('📝 Bill data:', billData)
    console.log('📝 Using demo data:', usingDemoData)

    // Credit/Due limit enforcement
    if (paymentMode === 'Credit' || paymentMode === 'Due') {
      if (!customer.phone) {
        addToast('⚠️ Customer phone is required for credit sales', 'error')
        return
      }
      const creditLimit = parseFloat(localStorage.getItem('kadai_credit_limit') || '5000')
      if (total > creditLimit) {
        addToast(`⚠️ Bill ₹${total} exceeds credit limit of ₹${creditLimit}. Please use another payment method.`, 'error')
        return
      }
    }

    // Generate bill number first
    const newBillNumber = billData.bill_number || `INV-${Date.now().toString().slice(-6)}`
    setBillNumber(newBillNumber)

    // If using demo data, just show success and clear cart
    if (usingDemoData) {
      // Update local stock for demo products
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id)
        if (cartItem) {
          return { ...p, stock: Math.max(0, (p.stock || 0) - cartItem.quantity) }
        }
        return p
      }))

      addToast(`✅ Bill ${newBillNumber} created - ₹${total.toFixed(2)} (Demo Mode)`, 'success')

      // Invalidate cache so Bills page gets fresh data
      realDataService.invalidateCache()

      // Open WhatsApp if phone provided
      if (customer.phone && customer.phone.length >= 10) {
        const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'
        const loyaltyPoints = Math.floor(total / 100) * 10
        const itemsList = cart.map(i => `• ${i.name} x${i.quantity} = ₹${i.price * i.quantity}`).join('\n')
        const whatsappMessage = `🧾 *BILL - ${newBillNumber}*\n📍 ${storeName}\n\n${itemsList}\n\n💰 *Total: ₹${total.toFixed(2)}*\n📱 Payment: ${paymentMode}\n⭐ Loyalty Points: +${loyaltyPoints}\n\nThank you! 🙏\n_Powered by KadaiGPT_`

        const waUrl = `https://wa.me/91${customer.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
        window.open(waUrl, '_blank')
      }

      setTimeout(() => {
        clearCart()
        addToast('Redirecting to All Bills...', 'info')
        setTimeout(() => setCurrentPage?.('bills'), 500)
      }, 1500)
      return
    }

    try {
      // Save bill to API - backend handles stock updates via inventory_agent
      const result = await api.createBill(billData)
      console.log('✅ Bill created:', result)
      trackBillCreated() // Trigger celebration milestones

      const apiNewBillNumber = result.bill_number || newBillNumber
      setBillNumber(apiNewBillNumber)

      // Update local products state for immediate UI feedback
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id)
        if (cartItem) {
          const newStock = Math.max(0, (p.stock || p.current_stock || 0) - cartItem.quantity)
          return { ...p, stock: newStock, current_stock: newStock }
        }
        return p
      }))

      // ADD OR UPDATE CUSTOMER
      if (customer.phone && customer.phone.length >= 10) {
        console.log('👤 Processing customer:', customer.phone)
        try {
          const loyaltyPointsEarned = Math.floor(total / 100) * 10
          const pointsToDeduct = redeemPoints || 0

          // Fetch existing customers
          let existingCustomers = []
          try {
            existingCustomers = await api.getCustomers() || []
            console.log('👥 Found', existingCustomers.length, 'existing customers')
          } catch (e) {
            console.log('Could not fetch customers:', e)
          }

          // Match by phone (with or without country code)
          const matchedCustomer = existingCustomers.find(c =>
            c.phone === customer.phone ||
            c.phone === `+91${customer.phone}` ||
            c.phone?.replace(/\D/g, '') === customer.phone.replace(/\D/g, '')
          )

          if (matchedCustomer) {
            console.log('👤 Updating existing customer:', matchedCustomer.id)
            const creditToAdd = (paymentMode.toLowerCase() === 'credit' || paymentMode.toLowerCase() === 'due') ? total : 0
            const newLoyalty = Math.max(0, (matchedCustomer.loyalty_points || 0) + loyaltyPointsEarned - pointsToDeduct)

            await api.updateCustomer(matchedCustomer.id, {
              total_purchases: (matchedCustomer.total_purchases || 0) + total,
              credit: (matchedCustomer.credit || 0) + creditToAdd,
              loyalty_points: newLoyalty,
              last_purchase: new Date().toISOString()
            })
            console.log('✅ Customer updated')
            addToast(`+${loyaltyPointsEarned} points earned!`, 'success')
          } else {
            console.log('👤 Creating new customer')
            const creditAmount = (paymentMode.toLowerCase() === 'credit' || paymentMode.toLowerCase() === 'due') ? total : 0

            const newCustomer = await api.createCustomer({
              name: customer.name || 'Walk-in Customer',
              phone: customer.phone,
              email: '',
              address: '',
              credit: creditAmount,
              loyalty_points: loyaltyPointsEarned,
              total_purchases: total,
              last_purchase: new Date().toISOString()
            })
            console.log('✅ Customer created:', newCustomer)
            addToast(`New customer added with ${loyaltyPointsEarned} points!`, 'success')
          }
        } catch (custError) {
          console.error('❌ Customer operation failed:', custError)
          addToast('Customer will be synced later', 'warning')
        }
      }

      // BUG-007 FIX: Show bill preview modal immediately instead of redirecting
      setShowPayment(true)
      addToast(`✅ Bill ${apiNewBillNumber} created - ₹${total.toFixed(2)} (${paymentMode})`, 'success')

      // Invalidate cache so Bills/Dashboard pages get fresh data immediately
      realDataService.invalidateCache()

      // Re-fetch products in background to get accurate stock from server
      setTimeout(() => loadProducts(), 1500)

    } catch (error) {
      console.error('❌ Error saving bill:', error)

      // Handle insufficient stock error (BUG-001)
      try {
        const errorDetail = typeof error.message === 'string' && error.message.includes('insufficient_stock')
          ? JSON.parse(error.message)
          : null

        if (errorDetail?.error === 'insufficient_stock' || error.message?.includes('insufficient stock')) {
          const items = errorDetail?.items || []
          if (items.length > 0) {
            const itemMessages = items.map(i => `• ${i.product_name}: only ${i.available} available (need ${i.requested})`).join('\n')
            addToast(`❌ Insufficient stock:\n${itemMessages}`, 'error')
          } else {
            addToast('❌ Some items have insufficient stock. Please check quantities.', 'error')
          }
          return // Don't clear cart — let user fix quantities
        }
      } catch (parseErr) {
        // Not a stock error, fall through
      }

      // Handle 409 conflict (race condition)
      if (error.message?.includes('changed during transaction')) {
        addToast('⚠️ Stock changed. Please try again.', 'warning')
        loadProducts() // Refresh product stock  
        return
      }

      // Offline fallback
      const newBillNumber = `INV-${Date.now().toString().slice(-6)}`
      setBillNumber(newBillNumber)
      addToast('Bill saved locally - will sync when connected', 'warning')
      clearCart()
    }
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      // Try API print first (for connected printers)
      await api.printReceipt(getBillData())
      addToast('Bill printed successfully!', 'success')
    } catch (err) {
      // Fallback: Use browser print dialog (works without physical printer)
      const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'
      const printContent = `
                <html>
                <head>
                    <title>Bill ${billNumber}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 20px; }
                        h2 { text-align: center; margin-bottom: 5px; }
                        .store-info { text-align: center; font-size: 12px; margin-bottom: 15px; }
                        hr { border: 1px dashed #000; }
                        .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
                        .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
                        .footer { text-align: center; font-size: 10px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h2>${storeName}</h2>
                    <p class="store-info">Bill No: ${billNumber}<br/>Date: ${new Date().toLocaleString('en-IN')}</p>
                    <hr/>
                    ${cart.map(item => `<div class="item"><span>${item.name} x${item.quantity}</span><span>₹${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
                    <hr/>
                    <div class="item"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
                    <div class="item"><span>GST (${gstRate}%)</span><span>₹${tax.toFixed(2)}</span></div>
                    <div class="item total"><span>TOTAL</span><span>₹${total.toFixed(2)}</span></div>
                    <hr/>
                    <p class="footer">Thank you for shopping!<br/>Powered by KadaiGPT</p>
                </body>
                </html>
            `
      const printWindow = window.open('', '_blank')
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
      addToast('Print preview opened!', 'success')
    } finally {
      setPrinting(false)
      clearCart()
      setShowPayment(false)
      setCurrentPage('bills')
    }
  }

  // Send bill via WhatsApp
  const handleSendWhatsApp = () => {
    if (!customer.phone) {
      addToast('Please enter customer phone number', 'error')
      return
    }

    const billData = getBillData()
    const storeName = localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'

    // Build bill object for WhatsApp
    const bill = {
      bill_number: billNumber || billData.bill_number,
      created_at: new Date().toISOString(),
      items: cart.map(item => ({
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price
      })),
      subtotal: subtotal,
      tax: tax,
      total: total,
      payment_mode: paymentMode
    }

    whatsappService.sendBill(bill, customer.phone, storeName)
    addToast('Opening WhatsApp...', 'success')
  }

  return (
    <div className="create-bill">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">🧾 Create New Bill</h1>
          <p className="page-subtitle">
            Add products and generate invoice
            {usingDemoData && (
              <span className="demo-badge" style={{
                marginLeft: '12px',
                padding: '2px 8px',
                background: 'rgba(249, 115, 22, 0.15)',
                color: '#f97316',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                Demo Mode
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCurrentPage?.('dashboard')}
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="bill-layout">
        {/* Products Section */}
        <div className="products-section">
          {/* Search & Category Filters */}
          <div className="product-filters">
            <div className="search-input large">
              <Search size={20} className="icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search products by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="barcode-scan-btn"
                onClick={() => setShowBarcodeInput(true)}
                title="Scan barcode"
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'var(--primary-500)', color: 'white', border: 'none',
                  borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                📷 Scan
              </button>
            </div>
            <div className="category-tabs">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid - Larger cards */}
          <div className="products-grid">
            {filteredProducts.length === 0 ? (
              <div className="no-products">
                <Package size={48} />
                <p>No products found</p>
                <span>{selectedCategory !== 'All' ? `Try "All" category` : 'Add products to get started'}</span>
              </div>
            ) : (
              filteredProducts.map(product => (
                <div key={product.id} className="product-item" onClick={() => addToCart(product)}>
                  <div className="product-category-tag">{product.category || 'General'}</div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">₹{product.price}<span>/{product.unit}</span></div>
                  <div className="product-stock">{product.stock} in stock</div>
                  <button className="add-btn" onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
                    <Plus size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ═══ CART PANEL — POS-Optimized: Items are KING ═══ */}
        <div className="cart-panel">
          {/* Compact Header — 40px */}
          <div className="cart-header">
            <span>🛒 Cart · {cart.length} items · {itemCount} qty</span>
            {cart.length > 0 && <button onClick={clearCart}>Clear</button>}
          </div>

          {/* Customer — SINGLE ROW — 44px */}
          <div className="cart-customer-row">
            <input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10}
              placeholder="📱 Phone (10 digits)" value={customer.phone}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                setCustomer({ ...customer, phone: cleaned })
                if (cleaned.length >= 10) lookupCustomer(cleaned)
              }}
              style={customer.phone.length > 0 && customer.phone.length < 10 ? { borderColor: '#f59e0b' } : customer.phone.length === 10 ? { borderColor: '#22c55e' } : {}}
            />
            <div className="name-suggest-wrap" style={{ position: 'relative', flex: 1 }}>
              <input type="text" placeholder="👤 Name" value={customer.name}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true) }}
              />
              {showSuggestions && customerSuggestions.length > 0 && (
                <div className="customer-suggestions">
                  {customerSuggestions.map(c => (
                    <div key={c.id || c.phone} className="suggest-item" onMouseDown={() => selectCustomerSuggestion(c)}>
                      <div className="suggest-name">{c.name}</div>
                      <div className="suggest-meta">
                        {c.phone && <span>📱 {c.phone}</span>}
                        <span>⭐ {c.loyalty_points || 0} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {existingCustomer && <span className="loyalty-tag">⭐{existingCustomer.loyalty_points || 0}</span>}
          </div>

          {/* ═══ ITEMS LIST — THE HERO AREA ═══ takes ALL remaining space */}
          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <ShoppingCart size={36} style={{ opacity: 0.15 }} />
                <span>Click products to add →</span>
              </div>
            ) : cart.map((item, idx) => (
              <div key={item.id} className="cart-item">
                <div className="ci-top">
                  <span className="ci-num">{idx + 1}</span>
                  <span className="ci-name">{item.name}</span>
                  <span className="ci-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                  <button className="ci-del" onClick={() => removeFromCart(item.id)}><Trash2 size={13} /></button>
                </div>
                <div className="ci-bottom">
                  <span className="ci-rate">₹{item.price}/{item.unit || 'pcs'}</span>
                  <div className="ci-qty">
                    <button onClick={() => updateQuantity(item.id, -(item.unit === 'kg' || item.unit === 'L' ? 0.1 : 1))}>−</button>
                    <input type="number" value={item.quantity} min="0.1"
                      step={item.unit === 'kg' || item.unit === 'L' ? '0.1' : '1'}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) setCart(cart.map(c => c.id === item.id ? { ...c, quantity: Math.max(0.1, v) } : c)); }}
                    />
                    <button onClick={() => updateQuantity(item.id, item.unit === 'kg' || item.unit === 'L' ? 0.1 : 1)}>+</button>
                    <select value={item.unit || 'pcs'} onChange={(e) => setCart(cart.map(c => c.id === item.id ? { ...c, unit: e.target.value } : c))}>
                      <option value="pcs">pcs</option><option value="kg">kg</option><option value="g">g</option><option value="L">L</option><option value="ml">ml</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ═══ COMPACT FOOTER — ~180px max ═══ */}
          {cart.length > 0 && (
            <div className="cart-footer-compact">
              {/* Row 1: Disc + GST inline */}
              <div className="cf-controls">
                <label>Disc <input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="percentage">%</option><option value="fixed">₹</option></select>
                </label>
                <label>GST <select value={gstRate} onChange={(e) => setGstRate(parseInt(e.target.value))}>
                  <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                </select></label>
              </div>
              {/* Row 2: Subtotal / Discount / Tax — compact */}
              <div className="cf-summary">
                <span>Sub ₹{subtotal.toLocaleString()}</span>
                {discountAmount > 0 && <span className="cf-disc">−₹{discountAmount}</span>}
                <span>Tax ₹{tax}</span>
              </div>
              {/* Discount Input Row */}
              <div className="cf-discount-row">
                <div className="cf-discount-quick">
                  {[5, 10, 15].map(pct => (
                    <button
                      key={pct}
                      className={discount === pct && discountType === 'percentage' ? 'active' : ''}
                      onClick={() => { setDiscount(discount === pct && discountType === 'percentage' ? 0 : pct); setDiscountType('percentage') }}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    className="cf-discount-input"
                    placeholder="₹ Flat"
                    min="0"
                    value={discountType === 'flat' && discount > 0 ? discount : ''}
                    onChange={e => { setDiscount(parseInt(e.target.value) || 0); setDiscountType('flat') }}
                    style={{ width: '70px', padding: '4px 6px', fontSize: '0.75rem', textAlign: 'center', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                  {discount > 0 && (
                    <button className="cf-disc-clear" onClick={() => setDiscount(0)} title="Clear discount">&times;</button>
                  )}
                </div>
              </div>
              {/* Row 3: TOTAL — prominent but compact */}
              <div className="cf-total">
                <span>TOTAL</span>
                <span className="cf-total-amt">₹{total.toLocaleString()}</span>
              </div>
              {/* Row 4: Payment pills — tiny */}
              <div className="cf-pay">
                {['Cash', 'UPI', 'Card', 'Due'].map(m => (
                  <button key={m} className={paymentMode === m ? 'active' : ''} onClick={() => setPaymentMode(m)}>{m}</button>
                ))}
              </div>
              {/* Row 5: Generate */}
              <button className="cf-generate" onClick={handleSaveBill}>
                💾 BILL · ₹{total.toLocaleString()} · {paymentMode}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Quantity Modal */}
      {showQtyModal && (
        <div className="modal-overlay" onClick={() => setShowQtyModal(null)}>
          <div className="modal qty-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><Scale size={20} /> Enter Quantity</h3>
              <button className="modal-close" onClick={() => setShowQtyModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="qty-product-info">
                <strong>{showQtyModal.name}</strong>
                <span>₹{showQtyModal.price} per {showQtyModal.unit}</span>
              </div>
              <div className="qty-input-section">
                <label>Quantity / Weight:</label>
                <div className="qty-input-row">
                  <input
                    type="number"
                    id="custom-qty-input"
                    min="0.1"
                    step="0.1"
                    defaultValue="1"
                    autoFocus
                    className="qty-input-large"
                  />
                  <span className="unit-label">{showQtyModal.unit}</span>
                </div>
                <div className="qty-presets">
                  {[0.25, 0.5, 1, 2, 5, 10].map(qty => (
                    <button key={qty} onClick={() => {
                      document.getElementById('custom-qty-input').value = qty
                    }}>
                      {qty} {showQtyModal.unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowQtyModal(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const qty = document.getElementById('custom-qty-input').value
                  addToCartWithQty(showQtyModal, qty)
                }}
              >
                <Plus size={18} /> Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Receipt Preview</h3>
              <button className="modal-close" onClick={() => setShowPreview(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="receipt-preview">
                <pre>{previewContent}</pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setShowPreview(false); handleSaveBill(); }}>
                <Save size={18} /> Create Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(false)}>
          <div className="modal payment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🎉 Bill Created!</h3>
              <button className="modal-close" onClick={() => setShowPayment(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="bill-success">
                <div className="success-icon">✓</div>
                <h4>Invoice Generated</h4>
                <p className="bill-number">{billNumber}</p>
                <div className="bill-amount">₹{total}</div>
              </div>

              <div className="payment-options">
                <label className="form-label">Payment Method</label>
                <div className="payment-buttons">
                  {['Cash', 'UPI', 'Card', 'Due'].map(mode => (
                    <button
                      key={mode}
                      className={`payment-btn ${paymentMode === mode ? 'active' : ''}`}
                      onClick={() => setPaymentMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Calculator — shows when Cash selected */}
              {paymentMode === 'Cash' && (
                <div className="cash-calc" style={{ marginTop: 16, padding: 14, background: 'var(--bg-tertiary)', borderRadius: 12 }}>
                  <label className="form-label" style={{ marginBottom: 8 }}>💵 Cash Received</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[10, 20, 50, 100, 200, 500, 1000, 2000].map(amt => (
                      <button
                        key={amt}
                        style={{
                          padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
                          border: '1px solid var(--border-subtle)', borderRadius: 6,
                          background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer'
                        }}
                        onClick={() => {
                          const input = document.getElementById('cash-received-input')
                          const current = parseFloat(input?.value) || 0
                          input.value = current + amt
                          input.dispatchEvent(new Event('input', { bubbles: true }))
                        }}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      id="cash-received-input"
                      type="number"
                      className="form-input"
                      placeholder="₹ Amount received"
                      defaultValue={total}
                      style={{ flex: 1, fontSize: '1.1rem', fontWeight: 700 }}
                      onInput={(e) => {
                        const received = parseFloat(e.target.value) || 0
                        const changeEl = document.getElementById('cash-change-display')
                        if (changeEl) {
                          const change = received - total
                          changeEl.textContent = change >= 0 ? `₹${change.toFixed(2)}` : `₹${Math.abs(change).toFixed(2)} short`
                          changeEl.style.color = change >= 0 ? '#16a34a' : '#ef4444'
                        }
                      }}
                    />
                    <button
                      style={{ padding: '8px 14px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                      onClick={() => {
                        const input = document.getElementById('cash-received-input')
                        input.value = total
                        input.dispatchEvent(new Event('input', { bubbles: true }))
                      }}
                    >
                      Exact
                    </button>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: 600 }}>Change to Return:</span>
                    <span id="cash-change-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>₹0.00</span>
                  </div>
                </div>
              )}

              {/* UPI QR Code — shows when UPI selected */}
              {paymentMode === 'UPI' && (
                <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-tertiary)', borderRadius: 12, textAlign: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 8 }}>📱 Scan to Pay</label>
                  <div style={{
                    width: 180, height: 180, margin: '12px auto',
                    background: 'white', borderRadius: 12, padding: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--border-subtle)'
                  }}>
                    {/* Generate UPI QR using Google Charts API */}
                    <img
                      src={`https://chart.googleapis.com/chart?cht=qr&chs=150x150&chl=${encodeURIComponent(
                        `upi://pay?pa=${localStorage.getItem('kadai_upi_id') || 'store@upi'}&pn=${localStorage.getItem('kadai_store_name') || 'KadaiGPT Store'}&am=${total}&cu=INR&tn=${billNumber || 'Payment'}`
                      )}`}
                      alt="UPI QR Code"
                      style={{ width: 150, height: 150 }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
                    />
                    <div style={{ display: 'none', color: '#666', fontSize: '0.85rem' }}>
                      QR unavailable offline.<br />Use UPI ID directly.
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                    UPI ID: <strong>{localStorage.getItem('kadai_upi_id') || 'store@upi'}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Amount: ₹{total} • Set UPI ID in Settings
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowPayment(false); clearCart(); }}>
                New Bill
              </button>
              <button
                className="btn btn-success"
                onClick={handleSendWhatsApp}
                disabled={!customer.phone}
                title={!customer.phone ? 'Add customer phone to send via WhatsApp' : 'Send bill via WhatsApp'}
              >
                <MessageSquare size={18} /> WhatsApp
              </button>
              <button className="btn btn-primary" onClick={handlePrint} disabled={printing}>
                {printing ? <><Loader2 size={18} className="spin" /> Printing...</> : <><Printer size={18} /> Print Receipt</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Input Modal */}
      {showBarcodeInput && (
        <div className="modal-overlay" onClick={() => setShowBarcodeInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">📷 Scan / Enter Barcode</h3>
              <button className="modal-close" onClick={() => setShowBarcodeInput(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Scan with a barcode reader or type the barcode/SKU number manually.
              </p>
              <input
                type="text"
                className="form-input"
                placeholder="Scan or type barcode here..."
                autoFocus
                style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'center', letterSpacing: 2 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const code = e.target.value.trim()
                    if (!code) return
                    // Search by barcode or SKU
                    const found = products.find(p =>
                      p.barcode === code || p.sku === code ||
                      p.barcode?.toLowerCase() === code.toLowerCase() ||
                      p.sku?.toLowerCase() === code.toLowerCase()
                    )
                    if (found) {
                      addToCart(found)
                      addToast(`✅ ${found.name} added via barcode`, 'success')
                      e.target.value = ''
                      // Don't close — allow scanning multiple items
                    } else {
                      // Try partial name match as fallback
                      const nameMatch = products.find(p => p.name.toLowerCase().includes(code.toLowerCase()))
                      if (nameMatch) {
                        addToCart(nameMatch)
                        addToast(`✅ ${nameMatch.name} added (matched by name)`, 'success')
                        e.target.value = ''
                      } else {
                        addToast(`❌ No product found for barcode: ${code}`, 'error')
                      }
                    }
                  }
                }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', width: '100%' }}>
                  💡 Tip: Press Enter after scanning. Scanner stays open for multiple items.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBarcodeInput(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ====================================================
           KADAIGPT CREATE BILL - SPLIT LAYOUT
           LEFT: Cart (fixed width) | RIGHT: Products (flex)
           Designed for shop owners who need speed & clarity
           ==================================================== */
        
        .create-bill {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 76px);
          overflow: hidden;
          padding: 0;
        }
        
        /* Page header - minimal */
        .page-header {
          display: none; /* Hide header to maximize billing space */
        }
        
        /* ── MAIN SPLIT LAYOUT ── */
        .bill-layout { 
          display: flex; 
          gap: 0;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          height: 100%;
        }
        
        /* ================================================
           CART PANEL — POS OPTIMIZED
           Goal: Items get MAXIMUM space, footer is COMPACT
           Header: 40px | Customer: 44px | Items: FLEX | Footer: ~170px
           ================================================ */
        .cart-panel {
          width: 420px;
          min-width: 420px;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-card);
          border-right: 2px solid var(--border-subtle);
          overflow: hidden;
          flex-shrink: 0;
          order: -1;
        }
        
        /* Header — 40px */
        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .cart-header button {
          background: rgba(255,255,255,0.2);
          border: none; color: white;
          padding: 4px 12px; border-radius: 6px;
          cursor: pointer; font-size: 0.72rem; font-weight: 600;
        }
        .cart-header button:hover { background: rgba(255,255,255,0.35); }
        
        /* Customer — SINGLE ROW — 44px */
        .cart-customer-row {
          display: flex;
          gap: 6px;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          align-items: center;
        }
        .cart-customer-row input {
          flex: 1; min-width: 0;
          padding: 8px 10px;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.82rem;
        }
        .cart-customer-row input:focus { border-color: var(--primary-400); outline: none; }
        .loyalty-tag {
          background: rgba(34,197,94,0.15); color: #16a34a;
          padding: 4px 8px; border-radius: 6px;
          font-size: 0.7rem; font-weight: 700;
          white-space: nowrap; flex-shrink: 0;
        }
        .name-suggest-wrap input { width: 100%; }
        .customer-suggestions {
          position: absolute; top: 100%; left: 0; right: 0;
          background: var(--bg-card); border: 1px solid var(--primary-400);
          border-radius: 10px; z-index: 50; max-height: 200px;
          overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          margin-top: 4px;
        }
        .suggest-item {
          padding: 10px 14px; cursor: pointer;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
        }
        .suggest-item:last-child { border-bottom: none; }
        .suggest-item:hover { background: var(--bg-tertiary); }
        .suggest-name { font-weight: 600; font-size: 0.85rem; }
        .suggest-meta {
          display: flex; gap: 12px; font-size: 0.72rem;
          color: var(--text-tertiary); margin-top: 2px;
        }
        
        /* ═══ ITEMS LIST — HERO AREA — flex:1 ═══ */
        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 8px 10px;
          min-height: 120px; /* guarantee: at least 2 items visible */
        }
        .cart-items::-webkit-scrollbar { width: 5px; }
        .cart-items::-webkit-scrollbar-track { background: transparent; }
        .cart-items::-webkit-scrollbar-thumb { background: var(--primary-400); border-radius: 5px; }
        
        .cart-empty {
          height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: var(--text-tertiary); gap: 8px; font-size: 0.85rem;
        }
        
        /* Individual item — compact 2-line card */
        .cart-item {
          background: var(--bg-secondary);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 6px;
          border: 1px solid var(--border-subtle);
          transition: border-color 0.2s;
        }
        .cart-item:hover { border-color: var(--primary-400); }
        
        .ci-top {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 6px;
        }
        .ci-num {
          font-size: 0.68rem; font-weight: 700;
          color: var(--text-tertiary);
          background: var(--bg-tertiary);
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 5px; flex-shrink: 0;
        }
        .ci-name {
          flex: 1; font-weight: 700; font-size: 0.92rem;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ci-price {
          font-weight: 800; font-size: 0.95rem;
          color: var(--primary-400); white-space: nowrap;
        }
        .ci-del {
          background: transparent; border: none;
          color: var(--text-tertiary); cursor: pointer;
          padding: 4px; border-radius: 6px; display: flex;
          transition: all 0.15s; flex-shrink: 0;
        }
        .ci-del:hover { color: #dc2626; background: rgba(220,38,38,0.08); }
        
        .ci-bottom {
          display: flex; align-items: center; gap: 8px;
        }
        .ci-rate {
          font-size: 0.75rem; color: var(--text-tertiary);
          min-width: 60px; font-weight: 500;
        }
        .ci-qty {
          display: flex; align-items: center; gap: 4px;
          flex: 1; justify-content: flex-end;
        }
        .ci-qty button {
          width: 32px; height: 32px;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 1.1rem; font-weight: 700;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .ci-qty button:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .ci-qty button:active { transform: scale(0.9); }
        .ci-qty input {
          width: 48px; padding: 5px 2px;
          text-align: center;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.88rem; font-weight: 700;
          -moz-appearance: textfield;
        }
        .ci-qty input::-webkit-outer-spin-button,
        .ci-qty input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .ci-qty input:focus { border-color: var(--primary-400); outline: none; }
        .ci-qty select {
          padding: 5px 3px;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.72rem; cursor: pointer;
        }
        
        /* ═══ COMPACT FOOTER — ~170px total ═══ */
        .cart-footer-compact {
          flex-shrink: 0;
          padding: 8px 12px;
          background: var(--bg-secondary);
          border-top: 2px solid var(--primary-400);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        /* Row 1: Disc + GST — single inline row ~34px */
        .cf-controls {
          display: flex;
          gap: 12px;
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
        .cf-controls label {
          display: flex; align-items: center; gap: 4px; font-weight: 600;
        }
        .cf-controls input {
          width: 40px; padding: 4px;
          border: 1px solid var(--border-subtle);
          border-radius: 5px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.78rem; text-align: center;
        }
        .cf-controls select {
          padding: 4px;
          border: 1px solid var(--border-subtle);
          border-radius: 5px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 0.78rem;
        }
        
        /* Row 2: Summary chips — 22px */
        .cf-summary {
          display: flex;
          gap: 10px;
          font-size: 0.76rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .cf-disc { color: #16a34a; font-weight: 700; }
        
        /* Discount Row */
        .cf-discount-row { padding: 4px 14px; }
        .cf-discount-quick {
          display: flex; gap: 6px; align-items: center;
        }
        .cf-discount-quick button {
          padding: 3px 10px; font-size: 0.7rem; font-weight: 600;
          border: 1px solid var(--border-subtle); border-radius: 4px;
          background: var(--bg-primary); color: var(--text-secondary);
          cursor: pointer; transition: all 0.15s;
        }
        .cf-discount-quick button.active {
          background: #16a34a; color: white; border-color: #16a34a;
        }
        .cf-discount-quick button:hover:not(.active) {
          border-color: #16a34a; color: #16a34a;
        }
        .cf-disc-clear {
          background: none !important; border: none !important;
          color: var(--text-tertiary) !important; font-size: 1.1rem;
          cursor: pointer; padding: 2px 6px !important;
        }
        .cf-disc-clear:hover { color: #ef4444 !important; }

        /* Row 3: TOTAL — 40px, prominent but compact */
        .cf-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(234, 88, 12, 0.12));
          color: var(--primary-400);
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(249, 115, 22, 0.25);
          font-weight: 700;
          font-size: 0.88rem;
        }
        .cf-total-amt {
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        
        /* Row 4: Payment pills — 32px */
        .cf-pay {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        .cf-pay button {
          padding: 6px 2px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s;
        }
        .cf-pay button:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .cf-pay button.active {
          background: var(--primary-500);
          border-color: var(--primary-500);
          color: white;
        }
        
        /* Row 5: Generate — 42px */
        .cf-generate {
          width: 100%;
          padding: 11px;
          font-size: 0.95rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary-500), #ea580c);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(249, 115, 22, 0.4);
          transition: all 0.2s;
          letter-spacing: 0.3px;
        }
        .cf-generate:hover { transform: translateY(-1px); box-shadow: 0 5px 18px rgba(249, 115, 22, 0.5); }
        .cf-generate:active { transform: scale(0.98); }
        
        /* ================================================
           RIGHT SIDE: PRODUCTS BROWSING AREA
           ================================================ */
        .products-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          padding: 16px 20px 16px 16px;
        }
        
        .product-filters {
          flex-shrink: 0;
          margin-bottom: 12px;
        }
        
        .search-input.large {
          margin-bottom: 10px;
        }
        .search-input.large input {
          padding: 14px 16px 14px 48px;
          font-size: 1rem;
        }
        .search-input.large .icon {
          left: 16px;
        }
        
        .category-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .cat-tab {
          padding: 7px 14px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          border-radius: 20px;
          font-size: 0.8rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .cat-tab:hover {
          border-color: var(--primary-400);
          color: var(--primary-400);
        }
        .cat-tab.active {
          background: var(--primary-500);
          border-color: var(--primary-500);
          color: white;
        }
        
        /* Products Grid */
        .products-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); 
          gap: 10px;
          overflow-y: auto;
          flex: 1;
          padding: 4px;
          align-content: start;
        }
        .products-grid::-webkit-scrollbar { width: 4px; }
        .products-grid::-webkit-scrollbar-track { background: transparent; }
        .products-grid::-webkit-scrollbar-thumb { background: var(--primary-400); border-radius: 4px; }
        
        .no-products {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: var(--text-tertiary);
          text-align: center;
        }
        .no-products p { font-size: 1rem; margin: 12px 0 4px; color: var(--text-secondary); }
        .no-products span { font-size: 0.85rem; }
        
        .product-item {
          background: var(--bg-card); 
          border: 1px solid var(--border-subtle);
          border-radius: 12px; 
          padding: 12px; 
          transition: all 0.2s;
          cursor: pointer;
          position: relative;
        }
        .product-item:hover { 
          border-color: var(--primary-400); 
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        
        .product-category-tag {
          display: inline-block;
          padding: 2px 8px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          font-size: 0.6rem;
          color: var(--text-tertiary);
          margin-bottom: 6px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .product-name { font-weight: 600; margin-bottom: 4px; font-size: 0.85rem; line-height: 1.2; }
        .product-price { color: var(--primary-400); font-weight: 700; font-size: 0.95rem; }
        .product-price span { font-weight: 500; font-size: 0.7rem; color: var(--text-tertiary); }
        .product-stock { font-size: 0.65rem; color: var(--text-tertiary); margin-top: 3px; }
        
        .add-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--primary-500);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .add-btn:hover { background: var(--primary-600); transform: scale(1.15); }
        
        /* ── HEADER (Hidden but kept for structure) ── */
        .header-left { flex: 1; }
        .header-left .page-title { margin-bottom: 0; font-size: 1.3rem; }
        .header-left .page-subtitle { font-size: 0.8rem; margin-top: 2px; }
        .header-actions { display: flex; align-items: center; gap: 12px; }
        
        .cart-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
          color: white;
          padding: 8px 16px;
          border-radius: var(--radius-lg);
          font-weight: 600;
        }
        .badge-count { background: white; color: var(--primary-600); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; }
        .badge-total { font-size: 1rem; }
        
        /* ── Modals ── */
        .qty-modal { max-width: 400px; }
        .qty-product-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px;
          background: var(--bg-tertiary);
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .qty-product-info strong { font-size: 1.1rem; }
        .qty-product-info span { color: var(--primary-400); }
        .qty-input-section label { display: block; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px; }
        .qty-input-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .qty-input-large {
          flex: 1; padding: 16px; font-size: 1.5rem; font-weight: 700; text-align: center;
          border: 2px solid var(--border-default); border-radius: 12px;
          background: var(--bg-secondary); color: var(--text-primary);
        }
        .qty-input-large:focus { border-color: var(--primary-400); outline: none; }
        .unit-label { font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); min-width: 60px; }
        .qty-presets { display: flex; flex-wrap: wrap; gap: 8px; }
        .qty-presets button {
          padding: 8px 14px; border: 1px solid var(--border-subtle); background: var(--bg-card);
          border-radius: 8px; font-size: 0.8rem; cursor: pointer; color: var(--text-secondary);
        }
        .qty-presets button:hover { border-color: var(--primary-400); color: var(--primary-400); }
        
        .preview-modal { max-width: 400px; }
        .receipt-preview { background: #1a1a1a; padding: 20px; border-radius: var(--radius-lg); overflow-x: auto; }
        .receipt-preview pre { font-family: 'Courier New', monospace; font-size: 0.75rem; color: #e5e5e5; white-space: pre; margin: 0; }
        
        .payment-modal { max-width: 460px; width: 90vw; }
        .bill-success { text-align: center; padding: 24px 0 16px; }
        .success-icon { width: 60px; height: 60px; background: var(--success); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; margin: 0 auto 14px; box-shadow: 0 4px 16px rgba(34,197,94,0.3); }
        .bill-success h4 { margin: 0 0 4px; font-size: 1.1rem; }
        .bill-number { color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.95rem; margin: 0; }
        .bill-amount { font-size: 2rem; font-weight: 700; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-top: 8px; }
        
        .payment-options { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-subtle); }
        .payment-options .form-label { text-align: center; display: block; margin-bottom: 10px; }
        .payment-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
        .payment-btn { padding: 12px 10px; background: var(--bg-tertiary); border: 2px solid var(--border-subtle); border-radius: var(--radius-lg); font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--text-primary); font-size: 0.85rem; text-align: center; }
        .payment-btn:hover { border-color: var(--primary-400); background: rgba(249, 115, 22, 0.05); }
        .payment-btn.active { border-color: var(--primary-400); background: rgba(249, 115, 22, 0.15); color: var(--primary-400); font-weight: 700; }
        .payment-modal .modal-footer { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 16px 20px; }
        .payment-modal .modal-footer .btn { flex: 1; min-width: 100px; justify-content: center; font-size: 0.8rem; padding: 10px 14px; }
        
        /* Legacy styles kept for compatibility */
        .new-customer-badge { background: rgba(34, 197, 94, 0.1); border: 1px dashed var(--success); border-radius: var(--radius-sm); padding: 8px; font-size: 0.75rem; color: var(--success); text-align: center; }
        .empty-cart { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 150px; color: var(--text-tertiary); }
        .empty-cart svg { opacity: 0.3; margin-bottom: 8px; }
        .empty-cart p { font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; }
        .empty-cart span { font-size: 0.75rem; }
        .cart-actions { display: none; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* ================================================
           MOBILE LAYOUT (<900px): Stack vertically
           ================================================ */
        @media (max-width: 900px) {
          .create-bill {
            height: auto;
            overflow: visible;
            padding-bottom: 0;
          }
          
          .bill-layout { 
            flex-direction: column;
            overflow: visible;
            height: auto;
          }
          
          .page-header {
            display: flex !important;
            padding: 12px 16px;
          }
          .header-left .page-title { font-size: 1.1rem; }
          
          /* Products on top, scrollable */
          .products-section {
            overflow: visible;
            padding: 10px 12px;
            padding-bottom: 320px;
          }

          .product-filters { margin-bottom: 8px; }

          .search-input.large input {
            padding: 12px 12px 12px 42px;
            font-size: 0.9rem;
          }

          .category-tabs {
            overflow-x: auto;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
          }
          .category-tabs::-webkit-scrollbar { display: none; }
          .cat-tab {
            white-space: nowrap;
            flex-shrink: 0;
            padding: 7px 14px;
            font-size: 0.75rem;
          }
          
          .products-grid {
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 8px;
            overflow: visible;
            max-height: none;
          }

          .product-item { padding: 10px; }
          .product-name { font-size: 0.8rem; }
          .product-price { font-size: 0.85rem; }
          .product-stock { font-size: 0.6rem; }
          .product-category-tag { font-size: 0.55rem; padding: 1px 6px; }
          .add-btn { width: 28px; height: 28px; top: 6px; right: 6px; }
          
          /* Cart: fixed above mobile nav bar */
          .cart-panel {
            position: fixed;
            bottom: 56px;
            left: 0;
            right: 0;
            width: 100%;
            min-width: unset;
            height: auto;
            max-height: 55vh;
            z-index: 100;
            border-right: none;
            border-top: 2px solid var(--primary-400);
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -6px 30px rgba(0,0,0,0.35);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .cart-header {
            padding: 8px 14px;
            font-size: 0.82rem;
            border-radius: 20px 20px 0 0;
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--bg-card);
          }

          .cart-customer-row {
            padding: 6px 10px;
            gap: 4px;
          }
          .cart-customer-row input {
            padding: 8px;
            font-size: 0.8rem;
          }
          
          .cart-items {
            max-height: 150px;
            padding: 6px 8px;
            overflow-y: auto;
          }

          .cart-item { padding: 8px 10px; margin-bottom: 5px; }
          .ci-name { font-size: 0.82rem; }
          .ci-price { font-size: 0.85rem; }
          .ci-rate { font-size: 0.7rem; }
          .ci-qty button { width: 32px; height: 32px; font-size: 1rem; }
          .ci-qty input { width: 42px; font-size: 0.82rem; }
          .ci-qty select { font-size: 0.68rem; }

          .cart-footer-compact { padding: 6px 10px; gap: 4px; }
          .cf-controls { font-size: 0.7rem; gap: 8px; }
          .cf-controls input { width: 40px; padding: 4px; font-size: 0.72rem; }
          .cf-controls select { padding: 4px; font-size: 0.72rem; }
          .cf-summary { font-size: 0.72rem; }
          .cf-total { padding: 6px 12px; font-size: 0.82rem; }
          .cf-total-amt { font-size: 1.15rem; }
          .cf-pay { gap: 4px; }
          .cf-pay button { padding: 6px 4px; font-size: 0.72rem; min-height: 34px; }
          .cf-generate { 
            padding: 12px; 
            font-size: 0.9rem;
            position: sticky;
            bottom: 0;
            z-index: 2;
            border-radius: 0;
          }

          /* Modals: slide up from bottom on mobile */
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .modal { 
            margin: 0 !important; 
            max-width: 100vw !important; 
            width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            max-height: 90vh;
            overflow-y: auto;
          }
          .payment-modal, .preview-modal, .qty-modal { 
            max-width: 100vw !important; 
            width: 100% !important;
          }
          .payment-modal .modal-body { padding: 16px; }
          .payment-buttons { grid-template-columns: repeat(4, 1fr); gap: 8px; }
          .payment-btn { padding: 12px 8px; font-size: 0.8rem; }
          .payment-modal .modal-footer { 
            flex-wrap: wrap; 
            gap: 8px; 
            padding: 12px 16px;
            position: sticky;
            bottom: 0;
            background: var(--bg-card);
            border-top: 1px solid var(--border-subtle);
          }
          .payment-modal .modal-footer .btn { 
            flex: 1 1 calc(33% - 6px); 
            min-width: 80px;
            font-size: 0.75rem; 
            padding: 10px 8px; 
          }
          .bill-success { padding: 16px 0 12px; }
          .bill-amount { font-size: 1.75rem; }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .products-grid {
            grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));
            gap: 6px;
          }
          .product-item { padding: 8px; }
          .product-name { font-size: 0.75rem; }
          .product-price { font-size: 0.8rem; }
          .cart-panel { max-height: 60vh; bottom: 56px; }
          .cart-items { max-height: 130px; }
          .products-section { padding-bottom: 340px; }
        }
      `}</style>
    </div>
  )
}

