import { useState } from 'react'
import { Check, X, Crown, Zap, Star, Building2 } from 'lucide-react'

export default function Subscription({ addToast }) {
    const [currentPlan, setCurrentPlan] = useState(localStorage.getItem('kadai_plan') || 'free')
    const [billingCycle, setBillingCycle] = useState('monthly')

    const plans = [
        {
            id: 'free',
            name: 'Free',
            icon: Zap,
            price: { monthly: 0, yearly: 0 },
            description: 'Start free, upgrade later',
            features: [
                { text: '100 bills/month', included: true },
                { text: 'Basic inventory', included: true },
                { text: '1 store', included: true },
                { text: '2 AI insights/day', included: true },
                { text: 'WhatsApp integration', included: false },
                { text: 'Voice commands', included: false },
                { text: 'Analytics', included: false },
                { text: 'Multi-store', included: false },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            icon: Star,
            price: { monthly: 299, yearly: 2999 },
            perDay: '₹10/day — Cheaper than a chai!',
            description: 'For growing stores',
            popular: true,
            features: [
                { text: 'Unlimited bills', included: true },
                { text: 'Full inventory', included: true },
                { text: '1 store', included: true },
                { text: 'Unlimited AI insights', included: true },
                { text: 'WhatsApp integration', included: true },
                { text: 'Voice commands', included: true },
                { text: 'Advanced analytics', included: true },
                { text: 'Multi-store', included: false },
            ]
        },
        {
            id: 'business',
            name: 'Business',
            icon: Building2,
            price: { monthly: 999, yearly: 9999 },
            perDay: '₹33/day — saves ₹2K/month on accountant',
            description: 'For multi-store owners',
            features: [
                { text: 'Unlimited bills', included: true },
                { text: 'Full inventory', included: true },
                { text: 'Up to 5 stores', included: true },
                { text: 'Unlimited AI insights', included: true },
                { text: 'WhatsApp integration', included: true },
                { text: 'Voice commands', included: true },
                { text: 'Advanced analytics', included: true },
                { text: 'Staff management', included: true },
            ]
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            icon: Crown,
            price: { monthly: 2999, yearly: 29999 },
            description: 'For large businesses',
            features: [
                { text: 'Unlimited everything', included: true },
                { text: 'Unlimited stores', included: true },
                { text: 'Custom integrations', included: true },
                { text: 'Priority support', included: true },
                { text: 'Dedicated account manager', included: true },
                { text: 'Custom AI models', included: true },
                { text: 'API access', included: true },
                { text: 'White-label option', included: true },
            ]
        }
    ]

    const handleUpgrade = (planId) => {
        // In production, this would redirect to payment
        addToast(`Upgrading to ${planId} plan...`, 'info')
        localStorage.setItem('kadai_plan', planId)
        setCurrentPlan(planId)
        addToast(`Successfully upgraded to ${planId}!`, 'success')
    }

    return (
        <div className="subscription-page">
            <div className="page-header">
                <h1>Choose Your Plan</h1>
                <p>Choose the right plan for your business</p>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>₹10/day — Cheaper than a chai! Save ₹2,000/month on accountant fees</p>
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
                    Yearly <span className="save-badge">Save 20%</span>
                </button>
            </div>

            {/* Plans Grid */}
            <div className="plans-grid">
                {plans.map(plan => {
                    const Icon = plan.icon
                    const price = plan.price[billingCycle]
                    const isCurrentPlan = currentPlan === plan.id

                    return (
                        <div
                            key={plan.id}
                            className={`plan-card ${plan.popular ? 'popular' : ''} ${isCurrentPlan ? 'current' : ''}`}
                        >
                            {plan.popular && <div className="popular-badge">Most Popular</div>}

                            <div className="plan-header">
                                <div className="plan-icon">
                                    <Icon size={24} />
                                </div>
                                <h3>{plan.name}</h3>
                                <p>{plan.description}</p>
                            </div>

                            <div className="plan-price">
                                <span className="currency">₹</span>
                                <span className="amount">{price.toLocaleString('en-IN')}</span>
                                <span className="period">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                            </div>
                            {plan.perDay && (
                                <div style={{ textAlign: 'center', fontSize: '12px', color: '#22c55e', fontWeight: 600, marginTop: '-16px', marginBottom: '16px' }}>
                                    {plan.perDay}
                                </div>
                            )}

                            <ul className="features-list">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className={feature.included ? 'included' : 'excluded'}>
                                        {feature.included ? <Check size={16} /> : <X size={16} />}
                                        <span>{feature.text}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={`plan-btn ${isCurrentPlan ? 'current' : ''}`}
                                onClick={() => !isCurrentPlan && handleUpgrade(plan.id)}
                                disabled={isCurrentPlan}
                            >
                                {isCurrentPlan ? 'Current Plan' : price === 0 ? 'Get Started' : 'Upgrade'}
                            </button>
                        </div>
                    )
                })}
            </div>

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

                .plan-header p {
                    color: var(--text-tertiary);
                    font-size: 0.875rem;
                    margin: 0;
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
                }

                .features-list li.excluded {
                    color: var(--text-tertiary);
                }

                .features-list li.excluded svg {
                    color: var(--text-tertiary);
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

                @media (max-width: 768px) {
                    .plans-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
