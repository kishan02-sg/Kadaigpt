import { useState } from 'react'
import { HelpCircle, X, MessageCircle, ChevronDown, ChevronUp, Phone, Mail, ExternalLink } from 'lucide-react'

/**
 * HelpSupport — In-app help, FAQ, and support channel
 * Critical for trust-building: a 22-year veteran knows that
 * support readiness = launch readiness
 */

const FAQ_ITEMS = [
    {
        q: 'इंटरनेट बंद हो जाए तो क्या होगा? (What if internet goes down?)',
        a: 'बिल फोन में सेव हो जाएगा। जब इंटरनेट आएगा, अपने आप सिंक हो जाएगा। कोई डेटा नहीं खोएगा। (Bill saves in phone. Auto-syncs when internet returns. Zero data loss.)',
        category: 'offline'
    },
    {
        q: 'गलत बिल बन गया, क्या करें? (Wrong bill created, what to do?)',
        a: 'Bills पेज पर जाएं → बिल पर क्लिक करें → "Cancel" बटन दबाएं। बिल cancel हो जाएगा और stock वापस आ जाएगा। (Go to Bills → click bill → press Cancel. Bill cancels and stock restores.)',
        category: 'billing'
    },
    {
        q: 'Product का price कैसे बदलें? (How to change product price?)',
        a: 'Products पेज → product पर क्लिक → Edit → नया price डालें → Save। सभी नए bills में नया price लगेगा। (Products page → click product → Edit → enter new price → Save.)',
        category: 'products'
    },
    {
        q: 'WhatsApp पर bill कैसे भेजें? (How to send bill on WhatsApp?)',
        a: 'Bill बनाने के बाद "WhatsApp" बटन दबाएं। Customer का number डालें। Bill PDF WhatsApp पर चला जाएगा। (After creating bill, press WhatsApp button. Enter customer number.)',
        category: 'billing'
    },
    {
        q: 'GST report कैसे निकालें? (How to get GST report?)',
        a: 'GST Reports पेज पर जाएं → महीना चुनें → "Export Excel" दबाएं। File download हो जाएगी। Accountant को भेज दें। (GST Reports page → select month → click Export Excel. Send file to accountant.)',
        category: 'reports'
    },
    {
        q: 'Stock कम हो गया, alert कैसे आएगा? (Stock low, how to get alert?)',
        a: 'Product add करते समय "Min Stock" setting में number डालें। जब stock उससे कम होगा, Dashboard पर RED alert दिखेगा। (Set "Min Stock" when adding product. When stock drops below, RED alert on Dashboard.)',
        category: 'products'
    },
    {
        q: 'दूसरे फोन से login कर सकते हैं? (Can login from another phone?)',
        a: 'हां! अपना email और password डालें किसी भी फोन पर। सारा data synced रहेगा। (Yes! Enter email and password on any phone. All data stays synced.)',
        category: 'general'
    },
    {
        q: 'Free plan में कितने bills बना सकते हैं? (How many bills in free plan?)',
        a: 'Free plan: 100 bills/month, 1 user। ₹299/month Pro plan: unlimited bills, 3 users, GST reports, WhatsApp bills। ₹10/day = एक चाय से सस्ता! (Free: 100 bills/month. Pro ₹299/month = ₹10/day = cheaper than one chai!)',
        category: 'pricing'
    },
]

export default function HelpSupport() {
    const [isOpen, setIsOpen] = useState(false)
    const [expandedFaq, setExpandedFaq] = useState(null)
    const [activeTab, setActiveTab] = useState('faq') // 'faq' or 'contact'

    const toggleFaq = (index) => {
        setExpandedFaq(expandedFaq === index ? null : index)
    }

    if (!isOpen) {
        return (
            <button
                className="help-fab"
                onClick={() => setIsOpen(true)}
                aria-label="Help & Support"
                style={{
                    position: 'fixed', bottom: '88px', left: '16px',
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 89, transition: 'all 0.2s',
                }}
            >
                <HelpCircle size={22} />
            </button>
        )
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9998,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setIsOpen(false)}>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-primary, white)', borderRadius: '20px 20px 0 0',
                    width: '100%', maxWidth: '500px', maxHeight: '85vh',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    animation: 'slideUp 0.3s ease',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 20px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary, #1a1a2e)', margin: 0 }}>
                            मदद चाहिए? (Need Help?)
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                            हम यहां हैं आपकी मदद के लिए
                        </p>
                    </div>
                    <button onClick={() => setIsOpen(false)} style={{
                        background: 'var(--bg-secondary, #f1f5f9)', border: 'none',
                        borderRadius: '10px', width: '36px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    {[
                        { id: 'faq', label: '❓ FAQ' },
                        { id: 'contact', label: '📞 Contact Us' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1, padding: '12px', border: 'none',
                                background: activeTab === tab.id ? 'var(--bg-secondary, #f1f5f9)' : 'transparent',
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                fontSize: '14px', cursor: 'pointer',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary, #6366f1)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--text-primary, #1a1a2e)' : 'var(--text-secondary, #64748b)',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                    {activeTab === 'faq' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {FAQ_ITEMS.map((item, index) => (
                                <div
                                    key={index}
                                    style={{
                                        border: '1px solid var(--border-color, #e2e8f0)',
                                        borderRadius: '12px', overflow: 'hidden',
                                        background: expandedFaq === index ? 'var(--bg-secondary, #f8fafc)' : 'transparent',
                                    }}
                                >
                                    <button
                                        onClick={() => toggleFaq(index)}
                                        style={{
                                            width: '100%', padding: '14px 16px', border: 'none',
                                            background: 'transparent', textAlign: 'left', cursor: 'pointer',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            gap: '12px', fontSize: '14px', fontWeight: 600,
                                            color: 'var(--text-primary, #1a1a2e)', minHeight: '48px',
                                        }}
                                    >
                                        <span>{item.q}</span>
                                        {expandedFaq === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    {expandedFaq === index && (
                                        <div style={{
                                            padding: '0 16px 14px', fontSize: '13px', lineHeight: 1.6,
                                            color: 'var(--text-secondary, #64748b)',
                                        }}>
                                            {item.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* WhatsApp Support */}
                            <a
                                href="https://wa.me/919876543210?text=Hi%20KadaiGPT%20team%2C%20I%20need%20help%20with..."
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '16px', borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                    color: 'white', textDecoration: 'none',
                                    minHeight: '56px',
                                }}
                            >
                                <MessageCircle size={24} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>WhatsApp Support</div>
                                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                                        सबसे तेज़ response — WhatsApp पर message करें
                                    </div>
                                </div>
                                <ExternalLink size={16} style={{ marginLeft: 'auto', opacity: 0.8 }} />
                            </a>

                            {/* Phone */}
                            <a
                                href="tel:+919876543210"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '16px', borderRadius: '14px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    color: 'var(--text-primary, #1a1a2e)', textDecoration: 'none',
                                    minHeight: '56px',
                                }}
                            >
                                <Phone size={22} style={{ color: 'var(--primary, #6366f1)' }} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Call Us</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>
                                        Mon-Sat, 9 AM - 7 PM IST
                                    </div>
                                </div>
                            </a>

                            {/* Email */}
                            <a
                                href="mailto:support@kadaigpt.com"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '16px', borderRadius: '14px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    color: 'var(--text-primary, #1a1a2e)', textDecoration: 'none',
                                    minHeight: '56px',
                                }}
                            >
                                <Mail size={22} style={{ color: 'var(--primary, #6366f1)' }} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px' }}>Email</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>
                                        support@kadaigpt.com — 24 hr response
                                    </div>
                                </div>
                            </a>

                            {/* Feedback */}
                            <div style={{
                                padding: '16px', borderRadius: '14px',
                                background: 'var(--bg-secondary, #f8fafc)',
                                textAlign: 'center',
                            }}>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #1a1a2e)', margin: '0 0 4px' }}>
                                    कोई सुझाव है? (Have a suggestion?)
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                                    आपकी राय से ही हम बेहतर बनते हैं। WhatsApp पर बताएं! 🙏
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
        </div>
    )
}
