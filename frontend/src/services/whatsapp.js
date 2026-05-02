// WhatsApp Business API Service
// Handles message templates, bulk messaging, and automated reminders

class WhatsAppService {
    constructor() {
        this.apiBaseUrl = 'https://wa.me'
        this.defaultCountryCode = '91' // India
    }

    // Format phone number for WhatsApp
    formatPhone(phone) {
        // Remove any non-digit characters
        let cleaned = phone.replace(/\D/g, '')

        // Add country code if not present
        if (cleaned.length === 10) {
            cleaned = this.defaultCountryCode + cleaned
        }

        return cleaned
    }

    // Open WhatsApp with message
    openWhatsApp(phone, message) {
        const formattedPhone = this.formatPhone(phone)
        const encodedMessage = encodeURIComponent(message)
        const url = `${this.apiBaseUrl}/${formattedPhone}?text=${encodedMessage}`
        window.open(url, '_blank')
        return true
    }

    // Generate bill message
    generateBillMessage(bill, storeName) {
        const itemsList = bill.items.map(item =>
            `• ${item.product_name} x${item.quantity} = ₹${(item.quantity * item.unit_price).toFixed(2)}`
        ).join('\n')

        return `🧾 *Bill from ${storeName}*
        
Bill No: ${bill.bill_number}
Date: ${new Date(bill.created_at || Date.now()).toLocaleString('en-IN')}

*Items:*
${itemsList}

─────────────
Subtotal: ₹${bill.subtotal}
GST (5%): ₹${bill.tax}
*Total: ₹${bill.total}*
─────────────

Payment: ${bill.payment_mode}

Thank you for shopping with us! 🙏
Visit again soon!`
    }

    // Generate payment reminder message
    generatePaymentReminder(customer, storeName, dueAmount) {
        return `🔔 *Payment Reminder*

Dear ${customer.name},

You have a pending payment of *₹${dueAmount.toLocaleString()}* at *${storeName}*.

Please clear your dues at your earliest convenience.

Thank you for your business! 🙏

_${storeName}_
_Sent via KadaiGPT_`
    }

    // Generate festive offer message
    generateFestiveOffer(storeName, discount, validTill) {
        return `🎉 *Festival Special Offer!*

Dear Valued Customer,

Celebrate with us at *${storeName}*!

🎁 Get flat *${discount}% OFF* on all products!
📅 Offer valid till: ${validTill}

Visit us today and save big! 

🛒 *${storeName}*
_Powered by KadaiGPT_`
    }

    // Generate stock alert message (for suppliers)
    generateStockAlert(supplierName, products, storeName) {
        const productList = products.map(p =>
            `• ${p.name} (Current: ${p.stock} ${p.unit})`
        ).join('\n')

        return `📦 *Stock Order Request*

Dear ${supplierName},

This is an order request from *${storeName}*.

*Items Required:*
${productList}

Please confirm availability and delivery timeline.

Thank you!
_Sent via KadaiGPT_`
    }

    // Generate loyalty points message
    generateLoyaltyMessage(customer, points, storeName) {
        return `⭐ *Loyalty Points Update*

Hi ${customer.name}!

Great news! You've earned *${points} points* at ${storeName}!

Your current balance: *${customer.totalPoints} points*
Tier: *${customer.tier}*

Redeem your points on your next visit for exclusive rewards!

Thank you for being a loyal customer! 🙏

_${storeName}_`
    }

    // Send bill via WhatsApp
    sendBill(bill, phone, storeName) {
        const message = this.generateBillMessage(bill, storeName)
        return this.openWhatsApp(phone, message)
    }

    // Send payment reminder
    sendPaymentReminder(customer, storeName) {
        const message = this.generatePaymentReminder(customer, storeName, customer.credit)
        return this.openWhatsApp(customer.phone, message)
    }

    // Send bulk payment reminders (returns array of customers)
    async sendBulkReminders(customers, storeName, onProgress) {
        const customersWithDue = customers.filter(c => c.credit > 0)
        const results = []

        for (let i = 0; i < customersWithDue.length; i++) {
            const customer = customersWithDue[i]
            try {
                // Open WhatsApp for each (with slight delay to prevent blocking)
                await new Promise(resolve => setTimeout(resolve, 1000))
                this.sendPaymentReminder(customer, storeName)
                results.push({ customer, success: true })
                onProgress?.(i + 1, customersWithDue.length)
            } catch (error) {
                results.push({ customer, success: false, error })
            }
        }

        return results
    }

    // Send promotional message
    sendPromotion(phone, storeName, discount, validTill) {
        const message = this.generateFestiveOffer(storeName, discount, validTill)
        return this.openWhatsApp(phone, message)
    }

    // Send stock order to supplier
    sendStockOrder(supplier, products, storeName) {
        const message = this.generateStockAlert(supplier.contact, products, storeName)
        return this.openWhatsApp(supplier.phone, message)
    }

    // Send loyalty points notification
    sendLoyaltyUpdate(customer, pointsEarned, storeName) {
        const message = this.generateLoyaltyMessage(customer, pointsEarned, storeName)
        return this.openWhatsApp(customer.phone, message)
    }

    // Quick message templates
    getTemplates() {
        return [
            {
                id: 'payment_reminder',
                name: 'Payment Reminder',
                icon: '💰',
                template: 'Hi {name}, you have a pending payment of ₹{amount} at {store}. Please clear it at your earliest convenience. Thanks!'
            },
            {
                id: 'bill_receipt',
                name: 'Bill Receipt',
                icon: '🧾',
                template: 'Hi {name}, thank you for shopping at {store}! Your bill #{bill_no} of ₹{amount} has been generated. Visit again!'
            },
            {
                id: 'loyalty_reward',
                name: 'Loyalty Reward',
                icon: '⭐',
                template: 'Congratulations {name}! You\'ve earned {points} loyalty points at {store}. Redeem on your next visit!'
            },
            {
                id: 'stock_alert',
                name: 'Product Back in Stock',
                icon: '📦',
                template: 'Hi {name}, {product} is back in stock at {store}! Visit us to grab yours.'
            },
            {
                id: 'low_stock_alert',
                name: 'Low Stock Alert',
                icon: '⚠️',
                template: '⚠️ Low Stock Alert!\n\n{products}\n\nPlease restock soon to avoid stockouts.\n\n_KadaiGPT_'
            },
            {
                id: 'festive_offer',
                name: 'Festive Offer',
                icon: '🎉',
                template: '🎉 {name}, celebrate with us! Get {discount}% off on all products at {store} this festival season. Offer valid till {date}.'
            },
            {
                id: 'order_ready',
                name: 'Order Ready',
                icon: '✅',
                template: 'Hi {name}, your order from {store} is ready for pickup! Please collect it at your convenience.'
            },
            {
                id: 'delivery_update',
                name: 'Delivery Update',
                icon: '🚚',
                template: 'Hi {name}, your order from {store} is out for delivery and will reach you shortly!'
            },
            {
                id: 'daily_summary',
                name: 'Daily Summary',
                icon: '📊',
                template: '📊 *Daily Summary - {date}*\n\n💰 Total Sales: ₹{total_sales}\n🧾 Bills: {bill_count}\n📈 Avg Bill: ₹{avg_bill}\n\n_KadaiGPT_'
            },
            {
                id: 'expiry_alert',
                name: 'Expiry Alert',
                icon: '⏰',
                template: '⏰ Expiry Alert!\n\nThe following products are expiring soon:\n{products}\n\nPlease take action.\n\n_KadaiGPT_'
            },
            {
                id: 'thank_you',
                name: 'Thank You',
                icon: '🙏',
                template: 'Thank you {name} for shopping at {store}! We hope to see you again soon. Have a great day!'
            },
            {
                id: 'new_arrival',
                name: 'New Arrival',
                icon: '🆕',
                template: '🆕 New Arrival at {store}!\n\n{product} is now available.\nPrice: ₹{price}\n\nVisit us to check it out!'
            }
        ]
    }

    // Generate daily summary message
    generateDailySummary(stats, storeName) {
        const today = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        })

        return `📊 *Daily Sales Summary*
*${storeName}*
${today}

━━━━━━━━━━━━━━━━
💰 Total Sales: ₹${stats.totalSales.toLocaleString('en-IN')}
🧾 Bills Created: ${stats.billCount}
📈 Average Bill: ₹${stats.avgBill.toLocaleString('en-IN')}
👥 Customers Served: ${stats.customerCount}
━━━━━━━━━━━━━━━━

📦 Low Stock Items: ${stats.lowStockCount}
⚠️ Pending Payments: ₹${(stats.pendingPayments || 0).toLocaleString('en-IN')}

_Powered by KadaiGPT_`
    }

    // Send daily summary to owner
    sendDailySummary(phone, stats, storeName) {
        const message = this.generateDailySummary(stats, storeName)
        return this.openWhatsApp(phone, message)
    }

    // Generate low stock notification for owner
    generateLowStockNotification(products, storeName) {
        const productList = products.slice(0, 10).map(p =>
            `• ${p.name}: ${p.stock} left (Min: ${p.minStock})`
        ).join('\n')

        return `⚠️ *Low Stock Alert*
*${storeName}*

The following items need restocking:

${productList}
${products.length > 10 ? `\n...and ${products.length - 10} more items` : ''}

_Sent by KadaiGPT_`
    }

    // Send low stock alert
    sendLowStockAlert(phone, products, storeName) {
        const message = this.generateLowStockNotification(products, storeName)
        return this.openWhatsApp(phone, message)
    }

    // Parse template with variables
    parseTemplate(template, variables) {
        let parsed = template
        for (const [key, value] of Object.entries(variables)) {
            parsed = parsed.replace(new RegExp(`{${key}}`, 'g'), value)
        }
        return parsed
    }

    // Schedule reminder (demo - would need backend for real scheduling)
    scheduleReminder(customer, message, scheduledTime) {
        const delay = scheduledTime.getTime() - Date.now()
        if (delay > 0) {
            setTimeout(() => {
                this.openWhatsApp(customer.phone, message)
            }, delay)
            return true
        }
        return false
    }
}

const whatsappService = new WhatsAppService()
export default whatsappService
