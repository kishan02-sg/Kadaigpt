import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Crown, Zap, Star, Building2, Loader2, AlertCircle } from 'lucide-react'
import api from '../services/api'

const TIER_ICONS = { free: Zap, smart: Star, pro: Crown, enterprise: Building2 }
const POPULAR_TIER = 'smart'

const FEATURE_LABELS = {
    basic_billing: 'Billing & invoicing',
    basic_inventory: 'Inventory management',
    mobile_app: 'Mobile app (PWA)',
    community_support: 'Community support',
    advanced_analytics: 'Advanced analytics',
    whatsapp_integration: 'WhatsApp integration',
    email_support: 'Email support',
    gst_reports: 'GST reports & filing',
    thermal_printing: 'Thermal bill printing',
    barcode_scanning: 'Barcode scanning',
    priority_support: 'Priority support',
    demand_forecasting: 'AI demand forecasting',
    credit_management: 'Customer credit (khata) tracking',
    multi_store: 'Multi-store management',
    custom_reports: 'Custom reports',
    api_access: 'API access',
    supplier_management: 'Supplier management',
    staff_management: 'Staff management & roles',
    loyalty_program: 'Loyalty & rewards program',
    white_label: 'White-label branding',
    dedicated_support: 'Dedicated account manager',
    sla_guarantee: 'SLA guarantee',
    on_premise: 'On-premise deployment',
    custom_integrations: 'Custom integrations',
    chain_management: 'Multi-chain management',
}

function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) {
            resolve()
            return
        }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Could not load the payment gateway. Check your internet connection and try again.'))
        document.body.appendChild(script)
    })
}

function tierStats(tier) {
    const stats = []
    stats.push(tier.max_bills_per_month === -1 ? 'Unlimited bills/month' : `${tier.max_bills_per_month} bills/month`)
    stats.push(tier.max_stores === -1 ? 'Unlimited stores' : tier.max_stores === 1 ? '1 store' : `Up to ${tier.max_stores} stores`)
    stats.push(tier.analytics_days === -1 ? 'Unlimited analytics history' : `${tier.analytics_days}-day analytics history`)
    if (tier.whatsapp_messages_per_month !== 0) {
        stats.push(tier.whatsapp_messages_per_month === -1 ? 'Unlimited WhatsApp messages' : `${tier.whatsapp_messages_per_month} WhatsApp messages/month`)
    }
    stats.push(`${tier.max_languages} language${tier.max_languages > 1 ? 's' : ''}`)
    return stats
}

export default function Subscription({ addToast }) {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [details, setDetails] = useState(null)
    const [tiers, setTiers] = useState([])
    const [paymentConfig, setPaymentConfig] = useState({ configured: false, key_id: null })
    const [billingCycle, setBillingCycle] = useState('monthly')
    const [processingTier, setProcessingTier] = useState(null)

    const loadData = useCallback(async () => {
        try {
            const [detailsRes, tiersRes, paymentRes] = await Promise.all([
                api.getSubscriptionDetails(),
                api.getSubscriptionTiers(),
                api.getPaymentConfig(),
            ])
            setDetails(detailsRes)
            setTiers(tiersRes.tiers || [])
            setPaymentConfig(paymentRes)
        } catch (err) {
            addToast(err.message || 'Failed to load subscription details', 'error')
        } finally {
            setLoading(false)
        }
    }, [addToast])

    useEffect(() => { loadData() }, [loadData])

    const currentTier = details?.subscription?.tier || 'free'
    const tierOrder = tiers.map(tr => tr.tier)
    const currentIndex = tierOrder.indexOf(currentTier)

    const handleUpgrade = async (tier) => {
        if (!paymentConfig.configured) {
            addToast('Online payments are not set up yet. Please contact support to upgrade your plan.', 'info')
            return
        }
        setProcessingTier(tier.tier)
        try {
            const order = await api.createSubscriptionCheckout(tier.tier, billingCycle)
            await loadRazorpayScript()
            const rzp = new window.Razorpay({
                key: order.key_id,
                amount: order.amount,
                currency: order.currency,
                name: 'KadaiGPT',
                description: `${order.tier_name} plan — ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`,
                order_id: order.order_id,
                theme: { color: '#f97316' },
                handler: async (response) => {
                    try {
                        const result = await api.verifySubscriptionPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            tier: tier.tier,
                            billing_cycle: billingCycle,
                        })
                        addToast(result.message || `Upgraded to ${tier.name}!`, 'success')
                        await loadData()
                    } catch (err) {
                        addToast(err.message || 'Payment verification failed. Contact support if you were charged.', 'error')
                    } finally {
                        setProcessingTier(null)
                    }
                },
                modal: {
                    ondismiss: () => setProcessingTier(null)
                }
            })
            rzp.open()
        } catch (err) {
            addToast(err.message || 'Could not start checkout', 'error')
            setProcessingTier(null)
        }
    }

    const handleCancel = async () => {
        if (!window.confirm('Cancel your subscription? You will keep access until the end of the current billing period, then move to the Free plan.')) return
        try {
            const result = await api.cancelSubscription('user_requested')
            addToast(result.message || 'Subscription cancelled', 'info')
            await loadData()
        } catch (err) {
            addToast(err.message || 'Failed to cancel subscription', 'error')
        }
    }

    if (loading) {
        return (
            <div className="subscription-page">
                <div className="sub-loading"><Loader2 className="spin" size={28} /> Loading plans...</div>
                <style>{`
                    .sub-loading {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 80px 0;
                        color: var(--text-secondary);
                    }
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        )
    }

    return (
        <div className="subscription-page">
            <div className="page-header">
                <h1>{t('subscription.title', 'Choose Your Plan')}</h1>
                <p>Choose the right plan for your business</p>
                {!paymentConfig.configured && (
                    <div className="payment-warning">
                        <AlertCircle size={16} />
                        <span>Online payments aren't set up yet. You can review plans below — contact support to upgrade.</span>
                    </div>
                )}
            </div>

            {/* Billing Toggle */}
            <div className="billing-toggle">
                <button
                    className={billingCycle === 'monthly' ? 'active' : ''}
                    onClick={() => setBillingCycle('monthly')}
                >
                    Monthly
                </button>
                <button
                    className={billingCycle === 'yearly' ? 'active' : ''}
                    onClick={() => setBillingCycle('yearly')}
                >
                    Yearly <span className="save-badge">Save up to 17%</span>
                </button>
            </div>

            {/* Plans Grid */}
            <div className="plans-grid">
                {tiers.map(tier => {
                    const Icon = TIER_ICONS[tier.tier] || Zap
                    const price = billingCycle === 'monthly' ? tier.price_monthly : tier.price_yearly
                    const isCustomPricing = price < 0
                    const isCurrent = tier.tier === currentTier
                    const tierIndex = tierOrder.indexOf(tier.tier)
                    const isDowngrade = currentIndex >= 0 && tierIndex < currentIndex
                    const stats = tierStats(tier)
                    const featureLabels = (tier.features || []).map(f => FEATURE_LABELS[f]).filter(Boolean)

                    let buttonLabel = 'Upgrade'
                    let buttonDisabled = false
                    let onClick = () => handleUpgrade(tier)

                    if (isCurrent) {
                        buttonLabel = t('subscription.currentPlan', 'Current Plan')
                        buttonDisabled = true
                    } else if (isCustomPricing) {
                        buttonLabel = t('subscription.contactSales', 'Contact Sales')
                        onClick = () => addToast('For Enterprise pricing and onboarding, please reach out to our support team via the Help section.', 'info')
                    } else if (isDowngrade) {
                        buttonLabel = 'Lower Tier'
                        buttonDisabled = true
                    } else if (processingTier === tier.tier) {
                        buttonLabel = 'Processing...'
                        buttonDisabled = true
                    } else if (price === 0) {
                        buttonLabel = 'Get Started'
                    }

                    return (
                        <div
                            key={tier.tier}
                            className={`plan-card ${tier.tier === POPULAR_TIER ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                            {tier.tier === POPULAR_TIER && <div className="popular-badge">{t('subscription.mostPopular', 'Most Popular')}</div>}

                            <div className="plan-header">
                                <div className="plan-icon">
                                    <Icon size={24} />
                                </div>
                                <h3>{tier.name}</h3>
                                {isCurrent && details?.subscription?.is_trial && (
                                    <span className="trial-badge">Trial</span>
                                )}
                            </div>

                            <div className="plan-price">
                                {isCustomPricing ? (
                                    <span className="amount">Custom</span>
                                ) : price === 0 ? (
                                    <span className="amount">{t('subscription.free', 'Free')}</span>
                                ) : (
                                    <>
                                        <span className="currency">₹</span>
                                        <span className="amount">{price.toLocaleString('en-IN')}</span>
                                        <span className="period">{billingCycle === 'monthly' ? '/mo' : '/yr'}</span>
                                    </>
                                )}
                            </div>

                            <ul className="features-list">
                                {stats.map((s, i) => (
                                    <li key={`stat-${i}`} className="included">
                                        <Check size={16} />
                                        <span>{s}</span>
                                    </li>
                                ))}
                                {featureLabels.map((f, i) => (
                                    <li key={`feat-${i}`} className="included">
                                        <Check size={16} />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={`plan-btn ${isCurrent ? 'current' : ''}`}
                                onClick={onClick}
                                disabled={buttonDisabled}
                            >
                                {buttonLabel}
                            </button>
                        </div>
                    )
                })}
            </div>

            {currentTier !== 'free' && details?.subscription?.status !== 'cancelled' && (
                <div className="cancel-row">
                    <button className="cancel-link" onClick={handleCancel}>Cancel subscription</button>
                </div>
            )}

            <style>{`
                .subscription-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px 0;
                }

                .page-header {
                    text-align: center;
                    margin-bottom: 32px;
                }

                .page-header h1 {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }

                .page-header p {
                    color: var(--text-secondary);
                }

                .payment-warning {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin: 16px auto 0;
                    max-width: 560px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    background: rgba(249, 115, 22, 0.1);
                    border: 1px solid rgba(249, 115, 22, 0.3);
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }

                .billing-toggle {
                    display: flex;
                    justify-content: center;
                    gap: 4px;
                    background: var(--bg-tertiary);
                    padding: 4px;
                    border-radius: 12px;
                    width: fit-content;
                    margin: 0 auto 40px;
                }

                .billing-toggle button {
                    padding: 10px 20px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .billing-toggle button.active {
                    background: var(--primary-500);
                    color: white;
                }

                .save-badge {
                    background: #22c55e;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                }

                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 24px;
                }

                .plan-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 20px;
                    padding: 24px;
                    position: relative;
                    transition: all 0.3s;
                    display: flex;
                    flex-direction: column;
                }

                .plan-card:hover {
                    border-color: var(--primary-400);
                    transform: translateY(-4px);
                }

                .plan-card.popular {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 40px rgba(249, 115, 22, 0.2);
                }

                .plan-card.current {
                    border-color: #22c55e;
                }

                .popular-badge {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #f97316, #ea580c);
                    color: white;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .plan-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .plan-icon {
                    width: 56px;
                    height: 56px;
                    margin: 0 auto 16px;
                    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(234, 88, 12, 0.05));
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-400);
                }

                .plan-header h3 {
                    font-size: 1.25rem;
                    margin: 0 0 4px;
                }

                .trial-badge {
                    display: inline-block;
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 20px;
                    padding: 2px 10px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    margin-top: 4px;
                }

                .plan-price {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .plan-price .currency {
                    font-size: 1.25rem;
                    color: var(--text-secondary);
                }

                .plan-price .amount {
                    font-size: 2.5rem;
                    font-weight: 700;
                }

                .plan-price .period {
                    color: var(--text-tertiary);
                    font-size: 0.875rem;
                }

                .features-list {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 24px;
                    flex: 1;
                }

                .features-list li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 0;
                    font-size: 0.875rem;
                }

                .features-list li.included {
                    color: var(--text-primary);
                }

                .features-list li.included svg {
                    color: #22c55e;
                    flex-shrink: 0;
                }

                .plan-btn {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: linear-gradient(135deg, #f97316, #ea580c);
                    color: white;
                }

                .plan-btn:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }

                .plan-btn.current {
                    background: #22c55e;
                    cursor: default;
                }

                .plan-btn:disabled {
                    opacity: 0.7;
                }

                .cancel-row {
                    text-align: center;
                    margin-top: 32px;
                }

                .cancel-link {
                    background: none;
                    border: none;
                    color: var(--text-tertiary);
                    font-size: 0.85rem;
                    cursor: pointer;
                    text-decoration: underline;
                }

                .cancel-link:hover {
                    color: var(--text-secondary);
                }

                @media (max-width: 768px) {
                    .plans-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
