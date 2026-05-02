/**
 * WhatsApp Integration Service - Multiple Provider Support
 * Supports: CallMeBot (free), Green API (500/month free), and manual WhatsApp Web
 */

class WhatsAppIntegrationService {
    constructor() {
        this.provider = localStorage.getItem('kadai_wa_provider') || 'manual'
        this.apiKey = localStorage.getItem('kadai_wa_api_key') || ''
        this.instanceId = localStorage.getItem('kadai_wa_instance_id') || ''
        this.phone = localStorage.getItem('kadai_owner_phone') || ''
    }

    // ==================== CONFIGURATION ====================

    setProvider(provider) {
        this.provider = provider
        localStorage.setItem('kadai_wa_provider', provider)
    }

    setCredentials({ apiKey, instanceId, phone }) {
        if (apiKey) {
            this.apiKey = apiKey
            localStorage.setItem('kadai_wa_api_key', apiKey)
        }
        if (instanceId) {
            this.instanceId = instanceId
            localStorage.setItem('kadai_wa_instance_id', instanceId)
        }
        if (phone) {
            this.phone = phone
            localStorage.setItem('kadai_owner_phone', phone)
        }
    }

    getConfig() {
        return {
            provider: this.provider,
            apiKey: this.apiKey ? '****' + this.apiKey.slice(-4) : '',
            instanceId: this.instanceId,
            phone: this.phone,
            isConfigured: this.isConfigured()
        }
    }

    isConfigured() {
        switch (this.provider) {
            case 'callmebot':
                return !!(this.apiKey && this.phone)
            case 'greenapi':
                return !!(this.apiKey && this.instanceId && this.phone)
            case 'manual':
                return !!this.phone
            default:
                return false
        }
    }

    // ==================== SEND MESSAGE ====================

    async sendMessage(phone, message) {
        const targetPhone = phone || this.phone

        if (!targetPhone) {
            return { success: false, error: 'No phone number configured' }
        }

        // Clean phone number (remove spaces, +, etc)
        const cleanPhone = targetPhone.replace(/[\s+\-()]/g, '')

        switch (this.provider) {
            case 'callmebot':
                return this.sendViaCallMeBot(cleanPhone, message)
            case 'greenapi':
                return this.sendViaGreenAPI(cleanPhone, message)
            case 'manual':
            default:
                return this.sendViaManual(cleanPhone, message)
        }
    }

    // ==================== CALLMEBOT (FREE) ====================
    // Setup: Send "I allow callmebot to send me messages" to +34 644 71 80 04
    // You'll receive an API key

    async sendViaCallMeBot(phone, message) {
        if (!this.apiKey) {
            return { success: false, error: 'CallMeBot API key not configured' }
        }

        try {
            const encodedMessage = encodeURIComponent(message)
            const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${this.apiKey}`

            // CallMeBot uses GET request
            const response = await fetch(url)

            if (response.ok) {
                return { success: true, provider: 'callmebot' }
            } else {
                const text = await response.text()
                return { success: false, error: text || 'CallMeBot request failed' }
            }
        } catch (error) {
            console.error('CallMeBot error:', error)
            return { success: false, error: error.message }
        }
    }

    // ==================== GREEN API (500/month free) ====================
    // Setup: Register at green-api.com, get instanceId and apiTokenInstance

    async sendViaGreenAPI(phone, message) {
        if (!this.apiKey || !this.instanceId) {
            return { success: false, error: 'Green API credentials not configured' }
        }

        try {
            // Format: 91XXXXXXXXXX@c.us for India
            const chatId = phone.startsWith('91') ? `${phone}@c.us` : `91${phone}@c.us`

            const url = `https://api.green-api.com/waInstance${this.instanceId}/sendMessage/${this.apiKey}`

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatId,
                    message: message
                })
            })

            const data = await response.json()

            if (data.idMessage) {
                return { success: true, provider: 'greenapi', messageId: data.idMessage }
            } else {
                return { success: false, error: data.message || 'Green API request failed' }
            }
        } catch (error) {
            console.error('Green API error:', error)
            return { success: false, error: error.message }
        }
    }

    // ==================== MANUAL (Opens WhatsApp Web) ====================

    sendViaManual(phone, message) {
        const encodedMessage = encodeURIComponent(message)
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`

        window.open(whatsappUrl, '_blank')

        return { success: true, provider: 'manual', note: 'Opened WhatsApp Web' }
    }

    // ==================== HELPER: Send with Retry ====================

    async sendWithRetry(phone, message, retries = 2) {
        let lastError = null

        for (let i = 0; i <= retries; i++) {
            const result = await this.sendMessage(phone, message)
            if (result.success) return result

            lastError = result.error

            // If API fails, fallback to manual
            if (i === retries && this.provider !== 'manual') {
                console.log('Falling back to manual WhatsApp')
                return this.sendViaManual(phone.replace(/[\s+\-()]/g, ''), message)
            }

            // Wait before retry
            await new Promise(r => setTimeout(r, 1000))
        }

        return { success: false, error: lastError }
    }

    // ==================== BULK SEND ====================

    async sendBulk(recipients, message, delay = 2000) {
        const results = []

        for (const phone of recipients) {
            const result = await this.sendMessage(phone, message)
            results.push({ phone, ...result })

            // Delay between messages to avoid rate limiting
            if (recipients.indexOf(phone) < recipients.length - 1) {
                await new Promise(r => setTimeout(r, delay))
            }
        }

        return {
            total: recipients.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        }
    }
}

// Export singleton
const waIntegration = new WhatsAppIntegrationService()
export default waIntegration

// Named exports for common functions
export const sendWhatsAppMessage = (phone, message) => waIntegration.sendMessage(phone, message)
export const configureWhatsApp = (config) => waIntegration.setCredentials(config)
export const setWhatsAppProvider = (provider) => waIntegration.setProvider(provider)
