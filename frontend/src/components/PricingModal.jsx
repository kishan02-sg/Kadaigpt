import { useState } from 'react'
import { Check, Zap, Crown, Building2, X, ArrowRight, Sparkles } from 'lucide-react'

const plans = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        period: 'forever',
        description: 'Perfect for getting started',
        icon: Zap,
        color: 'gray',
        features: [
            'Up to 50 products',
            '100 bills/month',
            'Basic analytics',
            'Email support',
            'Mobile app access'
        ],
        limitations: [
            'No WhatsApp integration',
            'No AI insights',
            'No custom branding'
        ]
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 499,
        period: '/month',
        description: 'For growing businesses',
        icon: Crown,
        color: 'primary',
        popular: true,
        features: [
            'Unlimited products',
            'Unlimited bills',
            'Advanced analytics',
            'WhatsApp integration',
            'AI-powered insights',
            'Priority support',
            'GST reports',
            'Custom branding',
            'Loyalty program'
        ],
        limitations: []
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 1999,
        period: '/month',
        description: 'For multiple stores',
        icon: Building2,
        color: 'gold',
        features: [
            'Everything in Pro',
            'Multi-store management',
            'Role-based access',
            'API access',
            'Dedicated account manager',
            'Custom integrations',
            '99.99% SLA',
            'On-premise option'
        ],
        limitations: []
    }
]

export default function PricingModal({ isOpen, onClose, currentPlan = 'free' }) {
    const [selectedPlan, setSelectedPlan] = useState(currentPlan)
    const [billingCycle, setBillingCycle] = useState('monthly')

    if (!isOpen) return null

    const handleUpgrade = (planId) => {
        // In real app, this would integrate with payment gateway
        console.log('Upgrading to:', planId)
        alert(`🚀 Upgrade to ${planId.toUpperCase()} plan initiated! (Demo mode)`)
    }

    return (
        <div className="pricing-overlay" onClick={onClose}>
            <div className="pricing-modal" onClick={e => e.stopPropagation()}>
                <button className="pricing-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="pricing-header">
                    <div className="pricing-badge">
                        <Sparkles size={16} />
                        <span>Upgrade Your Store</span>
                    </div>
                    <h2>Choose Your Plan</h2>
                    <p>Scale your business with our powerful features</p>

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
                            Yearly
                            <span className="save-badge">Save 20%</span>
                        </button>
                    </div>
                </div>

                <div className="pricing-grid">
                    {plans.map(plan => {
                        const Icon = plan.icon
                        const displayPrice = billingCycle === 'yearly'
                            ? Math.round(plan.price * 0.8)
                            : plan.price
                        const isCurrentPlan = currentPlan === plan.id

                        return (
                            <div
                                key={plan.id}
                                className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.color}`}
                            >
                                {plan.popular && (
                                    <div className="popular-badge">Most Popular</div>
                                )}

                                <div className="plan-icon">
                                    <Icon size={24} />
                                </div>

                                <h3>{plan.name}</h3>
                                <p className="plan-description">{plan.description}</p>

                                <div className="plan-price">
                                    <span className="currency">₹</span>
                                    <span className="amount">{displayPrice}</span>
                                    <span className="period">{plan.period}</span>
                                </div>

                                <ul className="plan-features">
                                    {plan.features.map((feature, i) => (
                                        <li key={i}>
                                            <Check size={16} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className={`plan-cta ${isCurrentPlan ? 'current' : ''}`}
                                    onClick={() => !isCurrentPlan && handleUpgrade(plan.id)}
                                    disabled={isCurrentPlan}
                                >
                                    {isCurrentPlan ? (
                                        'Current Plan'
                                    ) : (
                                        <>
                                            {plan.price === 0 ? 'Get Started' : 'Upgrade Now'}
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>

                <div className="pricing-footer">
                    <p>🔒 Secure payment powered by Razorpay</p>
                    <p>Cancel anytime, no questions asked</p>
                </div>
            </div>

            <style>{`
                .pricing-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: fadeIn 0.2s ease-out;
                }
                
                .pricing-modal {
                    position: relative;
                    background: var(--bg-primary);
                    border-radius: var(--radius-2xl);
                    max-width: 1000px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    padding: 40px;
                    animation: scaleIn 0.3s ease-out;
                }
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                
                .pricing-close {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pricing-close:hover {
                    background: var(--error);
                    color: white;
                }
                
                .pricing-header {
                    text-align: center;
                    margin-bottom: 32px;
                }
                
                .pricing-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    color: white;
                    padding: 6px 14px;
                    border-radius: var(--radius-full);
                    font-size: 0.8125rem;
                    font-weight: 600;
                    margin-bottom: 16px;
                }
                
                .pricing-header h2 {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }
                
                .pricing-header > p {
                    color: var(--text-secondary);
                    margin-bottom: 24px;
                }
                
                .billing-toggle {
                    display: inline-flex;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    padding: 4px;
                }
                .billing-toggle button {
                    background: transparent;
                    border: none;
                    padding: 10px 20px;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .billing-toggle button.active {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }
                .save-badge {
                    background: var(--success);
                    color: white;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-size: 0.6875rem;
                }
                
                .pricing-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    margin-bottom: 32px;
                }
                @media (max-width: 900px) {
                    .pricing-grid { grid-template-columns: 1fr; }
                }
                
                .pricing-card {
                    position: relative;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: 32px;
                    transition: all 0.3s ease;
                }
                .pricing-card:hover {
                    transform: translateY(-4px);
                    border-color: var(--primary-500);
                }
                .pricing-card.popular {
                    border-color: var(--primary-500);
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(168, 85, 247, 0.05));
                }
                
                .popular-badge {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    color: white;
                    padding: 6px 16px;
                    border-radius: var(--radius-full);
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                
                .plan-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                }
                .pricing-card.gray .plan-icon { background: var(--bg-tertiary); color: var(--text-secondary); }
                .pricing-card.primary .plan-icon { background: rgba(124, 58, 237, 0.15); color: var(--primary-400); }
                .pricing-card.gold .plan-icon { background: rgba(234, 179, 8, 0.15); color: #fbbf24; }
                
                .pricing-card h3 {
                    font-size: 1.25rem;
                    margin-bottom: 4px;
                }
                
                .plan-description {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin-bottom: 24px;
                }
                
                .plan-price {
                    margin-bottom: 24px;
                }
                .plan-price .currency {
                    font-size: 1.25rem;
                    color: var(--text-secondary);
                    vertical-align: top;
                }
                .plan-price .amount {
                    font-size: 3rem;
                    font-weight: 800;
                }
                .plan-price .period {
                    color: var(--text-tertiary);
                    font-size: 0.875rem;
                }
                
                .plan-features {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 24px 0;
                }
                .plan-features li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 0;
                    font-size: 0.9375rem;
                    color: var(--text-secondary);
                }
                .plan-features li svg {
                    color: var(--success);
                    flex-shrink: 0;
                }
                
                .plan-cta {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: var(--radius-lg);
                    font-weight: 600;
                    font-size: 0.9375rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .pricing-card.gray .plan-cta {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .pricing-card.primary .plan-cta {
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    color: white;
                }
                .pricing-card.gold .plan-cta {
                    background: linear-gradient(135deg, #fbbf24, #f59e0b);
                    color: #1a1a2e;
                }
                .plan-cta:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                }
                .plan-cta.current {
                    background: var(--bg-tertiary);
                    color: var(--text-tertiary);
                    cursor: default;
                }
                
                .pricing-footer {
                    text-align: center;
                    color: var(--text-tertiary);
                    font-size: 0.8125rem;
                }
                .pricing-footer p {
                    margin: 4px 0;
                }
            `}</style>
        </div>
    )
}
