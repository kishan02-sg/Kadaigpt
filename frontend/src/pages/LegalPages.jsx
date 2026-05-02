import { useState } from 'react'
import { Shield, FileText, ChevronDown, ChevronUp, Mail, ArrowLeft } from 'lucide-react'

/**
 * Legal Pages — Privacy Policy + Terms of Service
 * Required for DPDP Act 2023 compliance and App Store approval
 */
export default function LegalPages({ page = 'privacy', onBack }) {
    const [expandedSection, setExpandedSection] = useState(null)

    const toggle = (id) => setExpandedSection(expandedSection === id ? null : id)

    const privacySections = [
        {
            id: 'collect',
            title: 'हम क्या डेटा इकट्ठा करते हैं (What Data We Collect)',
            content: `• Name, email, phone number (account creation)\n• Store name, GSTIN, business type\n• Product catalog, bills, customer records\n• Device info (for offline sync)\n• Usage analytics (anonymized)\n\nWe do NOT collect: Aadhaar, PAN, bank passwords, or biometric data.`,
        },
        {
            id: 'use',
            title: 'हम डेटा कैसे इस्तेमाल करते हैं (How We Use Data)',
            content: `• Provide billing, inventory, and analytics services\n• Improve AI predictions (demand forecasting, smart pricing)\n• Send WhatsApp bills and notifications (with your consent)\n• Generate GST reports\n• Customer support\n\nWe NEVER sell your data to third parties.`,
        },
        {
            id: 'store',
            title: 'डेटा कहाँ रखा जाता है (Where Data is Stored)',
            content: `• Cloud: PostgreSQL on servers in India (Neon.tech, AWS Mumbai region)\n• Local: Your device (offline mode — SQLite/IndexedDB)\n• Encryption: AES-256 for sensitive fields (phone, email, GSTIN)\n• Backups: Daily encrypted backups, 30-day retention`,
        },
        {
            id: 'share',
            title: 'डेटा किसके साथ शेयर होता है (Data Sharing)',
            content: `We share data ONLY:\n• With your explicit consent\n• To comply with Indian law (court orders, tax authorities)\n• With service providers (hosting, email) under strict contracts\n\nWe NEVER share your customer lists, sales data, or financial information with competitors or advertisers.`,
        },
        {
            id: 'rights',
            title: 'आपके अधिकार (Your Rights — DPDP Act 2023)',
            content: `Under India's Digital Personal Data Protection Act 2023, you have the right to:\n\n✅ Access: View all data we have about you\n✅ Correction: Fix any incorrect data\n✅ Erasure: Delete your account and all data\n✅ Portability: Export your data (JSON format)\n✅ Withdraw Consent: Opt out of marketing communications\n✅ Grievance: File complaint with our Grievance Officer\n\nTo exercise these rights, email: privacy@kadaigpt.com`,
        },
        {
            id: 'retention',
            title: 'डेटा कब तक रहता है (Data Retention)',
            content: `• Active accounts: Data retained while account is active\n• After account deletion: PII anonymized within 30 days\n• Financial records: Retained for 8 years (GST compliance)\n• Audit logs: Retained for 2 years\n• Backups: Purged within 90 days of deletion request`,
        },
        {
            id: 'children',
            title: 'बच्चों की गोपनीयता (Children\'s Privacy)',
            content: `KadaiGPT is designed for business use by adults (18+). We do not knowingly collect data from children under 18. If you believe a child has provided us data, contact privacy@kadaigpt.com.`,
        },
        {
            id: 'contact',
            title: 'संपर्क करें (Contact Us)',
            content: `Data Protection Officer / Grievance Officer:\nEmail: privacy@kadaigpt.com\nPhone: +91 98765 43210\nAddress: KadaiGPT Technologies, Chennai, Tamil Nadu, India\n\nResponse time: Within 72 hours\nComplaint resolution: Within 30 days`,
        },
    ]

    const termsSections = [
        {
            id: 'acceptance',
            title: 'सेवा की शर्तें (Acceptance of Terms)',
            content: `By using KadaiGPT, you agree to these terms. If you disagree, please stop using the service. We may update these terms; continued use means acceptance of changes.`,
        },
        {
            id: 'account',
            title: 'खाता (Account Responsibilities)',
            content: `• You must provide accurate information during registration\n• You are responsible for keeping your password secure\n• One account per store (multi-store via Business plan)\n• You must be 18+ and authorized to operate the business\n• Report unauthorized access immediately`,
        },
        {
            id: 'acceptable',
            title: 'स्वीकार्य उपयोग (Acceptable Use)',
            content: `You agree NOT to:\n• Use the service for illegal activities\n• Upload malicious code or attempt to hack the system\n• Scrape data or reverse-engineer our AI models\n• Share your account with unauthorized users\n• Use the service to harass customers or competitors\n• Exceed fair usage limits (API rate limits apply)`,
        },
        {
            id: 'data',
            title: 'आपका डेटा (Your Data)',
            content: `• You own your business data (products, bills, customers)\n• We have a license to process it for providing the service\n• You can export your data at any time (JSON format)\n• You can delete your account and all data\n• We create anonymized analytics (no PII) to improve our AI`,
        },
        {
            id: 'payment',
            title: 'भुगतान (Payment Terms)',
            content: `• Free plan: No charge, limited features\n• Paid plans: Billed monthly/annually in advance\n• Refund policy: 7-day money-back guarantee\n• Price changes: 30 days advance notice\n• Non-payment: Account downgraded to Free after 7-day grace period\n• GST: All prices exclusive of applicable GST`,
        },
        {
            id: 'availability',
            title: 'सेवा उपलब्धता (Service Availability)',
            content: `• We target 99.9% uptime but do not guarantee it\n• Scheduled maintenance: Sundays 2-4 AM IST (advance notice)\n• Offline mode ensures billing works without internet\n• We are not responsible for losses due to unplanned outages\n• Status updates: status.kadaigpt.com`,
        },
        {
            id: 'liability',
            title: 'दायित्व (Liability)',
            content: `• We are not liable for data loss beyond what our backup systems cover\n• Maximum liability: Total amount paid by you in the last 12 months\n• We are not responsible for decisions made based on AI predictions\n• Use AI insights as guidance, not absolute truth\n• Maintain your own backup of critical business data`,
        },
        {
            id: 'termination',
            title: 'समाप्ति (Termination)',
            content: `• You can cancel your account at any time\n• We may suspend accounts that violate these terms\n• Upon termination, you have 30 days to export your data\n• After 30 days, data is permanently deleted\n• Refunds for prepaid annual plans: Prorated, minus 1 month`,
        },
        {
            id: 'dispute',
            title: 'विवाद समाधान (Dispute Resolution)',
            content: `• Governing law: Laws of India\n• Jurisdiction: Courts of Chennai, Tamil Nadu\n• Disputes: First attempt mediation, then arbitration\n• Arbitration: As per Indian Arbitration & Conciliation Act, 1996`,
        },
    ]

    const sections = page === 'privacy' ? privacySections : termsSections
    const title = page === 'privacy' ? 'गोपनीयता नीति (Privacy Policy)' : 'सेवा की शर्तें (Terms of Service)'
    const Icon = page === 'privacy' ? Shield : FileText
    const lastUpdated = 'March 4, 2026'

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            {/* Back button */}
            {onBack && (
                <button onClick={onBack} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', color: 'var(--primary, #6366f1)',
                    cursor: 'pointer', marginBottom: '16px', fontSize: '14px', fontWeight: 600,
                }}>
                    <ArrowLeft size={16} /> Back to Settings
                </button>
            )}

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
                    background: 'linear-gradient(135deg, var(--primary, #6366f1), #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon size={24} color="white" />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>{title}</h1>
                <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>
                    Last updated: {lastUpdated} · KadaiGPT Technologies
                </p>
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sections.map((section) => (
                    <div key={section.id} style={{
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '12px', overflow: 'hidden',
                        background: expandedSection === section.id ? 'var(--bg-secondary, #f8fafc)' : 'transparent',
                    }}>
                        <button onClick={() => toggle(section.id)} style={{
                            width: '100%', padding: '16px 20px', border: 'none', background: 'transparent',
                            textAlign: 'left', cursor: 'pointer', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                            fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #1a1a2e)',
                            minHeight: '52px',
                        }}>
                            <span>{section.title}</span>
                            {expandedSection === section.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedSection === section.id && (
                            <div style={{
                                padding: '0 20px 16px', fontSize: '13px', lineHeight: 1.7,
                                color: 'var(--text-secondary, #374151)', whiteSpace: 'pre-line',
                            }}>
                                {section.content}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{
                marginTop: '32px', padding: '20px', borderRadius: '14px',
                background: 'var(--bg-secondary, #f8fafc)', textAlign: 'center',
            }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '0 0 8px' }}>
                    Questions? Contact our Data Protection Officer
                </p>
                <a href="mailto:privacy@kadaigpt.com" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    color: 'var(--primary, #6366f1)', fontWeight: 600, fontSize: '14px',
                    textDecoration: 'none',
                }}>
                    <Mail size={16} /> privacy@kadaigpt.com
                </a>
            </div>
        </div>
    )
}
