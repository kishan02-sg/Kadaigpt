// GST Verification Service
// Real-time GSTIN validation and verification

class GSTService {
    constructor() {
        // GST State codes mapping
        this.stateCodes = {
            '01': 'Jammu & Kashmir',
            '02': 'Himachal Pradesh',
            '03': 'Punjab',
            '04': 'Chandigarh',
            '05': 'Uttarakhand',
            '06': 'Haryana',
            '07': 'Delhi',
            '08': 'Rajasthan',
            '09': 'Uttar Pradesh',
            '10': 'Bihar',
            '11': 'Sikkim',
            '12': 'Arunachal Pradesh',
            '13': 'Nagaland',
            '14': 'Manipur',
            '15': 'Mizoram',
            '16': 'Tripura',
            '17': 'Meghalaya',
            '18': 'Assam',
            '19': 'West Bengal',
            '20': 'Jharkhand',
            '21': 'Odisha',
            '22': 'Chhattisgarh',
            '23': 'Madhya Pradesh',
            '24': 'Gujarat',
            '26': 'Dadra & Nagar Haveli and Daman & Diu',
            '27': 'Maharashtra',
            '28': 'Andhra Pradesh (Old)',
            '29': 'Karnataka',
            '30': 'Goa',
            '31': 'Lakshadweep',
            '32': 'Kerala',
            '33': 'Tamil Nadu',
            '34': 'Puducherry',
            '35': 'Andaman & Nicobar Islands',
            '36': 'Telangana',
            '37': 'Andhra Pradesh',
            '38': 'Ladakh',
            '97': 'Other Territory',
            '99': 'Centre Jurisdiction'
        }
    }

    // Validate GSTIN format
    validateFormat(gstin) {
        if (!gstin || typeof gstin !== 'string') {
            return { valid: false, error: 'GSTIN is required' }
        }

        // Remove spaces and convert to uppercase
        gstin = gstin.replace(/\s/g, '').toUpperCase()

        // GSTIN format: 22AAAAA0000A1Z5
        // 2 digits (state code) + 10 characters (PAN) + 1 digit (entity number) + 1 letter (Z by default) + 1 check digit
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/

        if (gstin.length !== 15) {
            return { valid: false, error: 'GSTIN must be 15 characters' }
        }

        if (!gstinRegex.test(gstin)) {
            return { valid: false, error: 'Invalid GSTIN format' }
        }

        // Validate state code
        const stateCode = gstin.substring(0, 2)
        if (!this.stateCodes[stateCode]) {
            return { valid: false, error: `Invalid state code: ${stateCode}` }
        }

        // Validate checksum (using Luhn-like algorithm)
        const checksumValid = this.validateChecksum(gstin)
        if (!checksumValid) {
            return { valid: false, error: 'Invalid GSTIN checksum' }
        }

        return {
            valid: true,
            gstin: gstin,
            stateCode: stateCode,
            stateName: this.stateCodes[stateCode],
            pan: gstin.substring(2, 12),
            entityNumber: gstin.charAt(12),
            checkDigit: gstin.charAt(14)
        }
    }

    // Validate GSTIN checksum
    validateChecksum(gstin) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let sum = 0

        for (let i = 0; i < 14; i++) {
            const char = gstin.charAt(i)
            let value = chars.indexOf(char)

            if (value === -1) return false

            // Apply position factor
            const factor = (i % 2 === 0) ? 1 : 2
            let product = value * factor

            // Handle products > 36
            sum += Math.floor(product / 36) + (product % 36)
        }

        const remainder = sum % 36
        const checkDigit = (36 - remainder) % 36
        const expectedChar = chars.charAt(checkDigit)

        return gstin.charAt(14) === expectedChar
    }

    // Real-time validation as user types
    validateRealtime(gstin) {
        if (!gstin) {
            return { status: 'empty', message: '' }
        }

        gstin = gstin.replace(/\s/g, '').toUpperCase()

        if (gstin.length < 15) {
            // Partial validation while typing
            if (gstin.length === 2) {
                const stateCode = gstin
                if (this.stateCodes[stateCode]) {
                    return {
                        status: 'partial',
                        message: `State: ${this.stateCodes[stateCode]}`,
                        stateName: this.stateCodes[stateCode]
                    }
                } else if (!/^[0-9]{2}$/.test(stateCode)) {
                    return { status: 'error', message: 'First 2 characters must be state code (digits)' }
                }
            }
            return { status: 'typing', message: `${gstin.length}/15 characters` }
        }

        // Full validation
        const result = this.validateFormat(gstin)

        if (result.valid) {
            return {
                status: 'valid',
                message: `✓ Valid GSTIN - ${result.stateName}`,
                details: result
            }
        } else {
            return {
                status: 'error',
                message: result.error
            }
        }
    }

    // Verify GSTIN with external API (demo implementation)
    async verifyWithAPI(gstin) {
        const formatResult = this.validateFormat(gstin)

        if (!formatResult.valid) {
            return {
                verified: false,
                error: formatResult.error
            }
        }

        // In production, this would call a real GST API
        // For demo, we'll simulate an API call
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate successful verification
                resolve({
                    verified: true,
                    gstin: formatResult.gstin,
                    legalName: 'Demo Business Pvt Ltd',
                    tradeName: 'Demo Store',
                    stateCode: formatResult.stateCode,
                    stateName: formatResult.stateName,
                    registrationDate: '01/07/2017',
                    status: 'Active',
                    constitutionOfBusiness: 'Private Limited Company',
                    taxpayerType: 'Regular',
                    lastUpdated: new Date().toISOString()
                })
            }, 1000)
        })
    }

    // Generate GST invoice number
    generateInvoiceNumber(prefix = 'INV') {
        const date = new Date()
        const year = date.getFullYear().toString().slice(-2)
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        return `${prefix}-${year}${month}-${random}`
    }

    // Calculate GST amounts
    calculateGST(amount, rate = 18, isInterstate = false) {
        const gstAmount = (amount * rate) / 100

        if (isInterstate) {
            // IGST for interstate
            return {
                baseAmount: amount,
                igst: gstAmount,
                cgst: 0,
                sgst: 0,
                totalTax: gstAmount,
                totalAmount: amount + gstAmount
            }
        } else {
            // CGST + SGST for intrastate
            const halfGst = gstAmount / 2
            return {
                baseAmount: amount,
                igst: 0,
                cgst: halfGst,
                sgst: halfGst,
                totalTax: gstAmount,
                totalAmount: amount + gstAmount
            }
        }
    }

    // Get HSN code suggestions (demo)
    getHSNCodes(query) {
        const codes = [
            { code: '1006', description: 'Rice' },
            { code: '0713', description: 'Dried leguminous vegetables (Dal)' },
            { code: '1701', description: 'Cane or beet sugar' },
            { code: '1507', description: 'Soyabean oil' },
            { code: '1509', description: 'Olive oil' },
            { code: '1512', description: 'Sunflower seed oil' },
            { code: '0902', description: 'Tea' },
            { code: '0901', description: 'Coffee' },
            { code: '0401', description: 'Milk and cream' },
            { code: '0405', description: 'Butter' },
            { code: '1101', description: 'Wheat flour' },
            { code: '2501', description: 'Salt' },
        ]

        if (!query) return codes

        return codes.filter(c =>
            c.code.includes(query) ||
            c.description.toLowerCase().includes(query.toLowerCase())
        )
    }
}

const gstService = new GSTService()
export default gstService
