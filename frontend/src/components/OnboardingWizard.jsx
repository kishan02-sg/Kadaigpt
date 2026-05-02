import { useState, useEffect } from 'react'
import { Store, Package, Users, Zap, ArrowRight, Check } from 'lucide-react'

export default function OnboardingWizard({ onComplete }) {
    // Check if store data already exists from registration
    const existingStoreName = localStorage.getItem('kadai_store_name')

    // If store name already exists from registration, skip to step 3
    const [step, setStep] = useState(existingStoreName ? 3 : 1)
    const [storeData, setStoreData] = useState({
        storeName: existingStoreName || '',
        storeType: localStorage.getItem('kadai_store_type') || 'grocery',
        phone: localStorage.getItem('kadai_store_phone') || '',
        city: localStorage.getItem('kadai_store_city') || ''
    })

    const handleComplete = () => {
        // Save store data
        localStorage.setItem('kadai_store_name', storeData.storeName)
        localStorage.setItem('kadai_store_type', storeData.storeType)
        localStorage.setItem('kadai_store_phone', storeData.phone)
        localStorage.setItem('kadai_store_city', storeData.city)
        localStorage.setItem('kadai_onboarding_complete', 'true')

        if (onComplete) onComplete()
    }

    const steps = [
        { id: 1, title: 'Welcome', icon: Zap },
        { id: 2, title: 'Store Details', icon: Store },
        { id: 3, title: 'Get Started', icon: Package }
    ]

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal">
                {/* Progress */}
                <div className="onboarding-progress">
                    {steps.map((s, i) => (
                        <div key={s.id} className={`progress-step ${step >= s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}>
                            <div className="step-circle">
                                {step > s.id ? <Check size={16} /> : s.id}
                            </div>
                            <span className="step-title">{s.title}</span>
                            {i < steps.length - 1 && <div className="step-line" />}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="onboarding-content">
                    {step === 1 && (
                        <div className="step-content welcome-step">
                            <div className="welcome-icon">
                                <Zap size={48} />
                            </div>
                            <h2>KadaiGPT में स्वागत है! 🎉</h2>
                            <p>India's First AI-Powered Retail Intelligence Platform</p>

                            <div className="features-list">
                                <div className="feature">
                                    <Package size={20} />
                                    <span>📦 Smart Inventory — Stock कभी कम नहीं होगा</span>
                                </div>
                                <div className="feature">
                                    <Users size={20} />
                                    <span>👥 Credit Tracking — उधार का पूरा हिसाब</span>
                                </div>
                                <div className="feature">
                                    <Zap size={20} />
                                    <span>📴 Offline Mode — बिना internet भी चले</span>
                                </div>
                            </div>

                            <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                                शुरू करें — Let's Go! <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="step-content store-step">
                            <div className="step-icon">
                                <Store size={32} />
                            </div>
                            <h2>अपनी दुकान के बारे में बताएं</h2>
                            <p>Tell us about your store — ताकि हम आपके लिए setup करें</p>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">दुकान का नाम (Store Name) *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="E.g., Krishna Stores"
                                        value={storeData.storeName}
                                        onChange={e => setStoreData({ ...storeData, storeName: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Business Type</label>
                                    <select
                                        className="form-input"
                                        value={storeData.storeType}
                                        onChange={e => setStoreData({ ...storeData, storeType: e.target.value })}
                                    >
                                        <option value="grocery">Grocery / Kirana</option>
                                        <option value="medical">Medical / Pharmacy</option>
                                        <option value="general">General Store</option>
                                        <option value="electronics">Electronics</option>
                                        <option value="restaurant">Restaurant</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="+91 9876543210"
                                        value={storeData.phone}
                                        onChange={e => setStoreData({ ...storeData, phone: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">City</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="E.g., Chennai"
                                        value={storeData.city}
                                        onChange={e => setStoreData({ ...storeData, city: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="step-actions">
                                <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setStep(3)}
                                    disabled={!storeData.storeName}
                                >
                                    Continue <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="step-content complete-step">
                            <div className="complete-icon">
                                <Check size={48} />
                            </div>
                            <h2>तैयार हो गया! 🚀</h2>
                            <p>आपकी दुकान <strong>{storeData.storeName || 'My Store'}</strong> तैयार है!</p>

                            <div className="next-steps">
                                <h4>अब ये करें (Quick Start):</h4>
                                <div className="next-step">
                                    <span className="step-num">1</span>
                                    <span>Products पेज में अपने items जोड़ें</span>
                                </div>
                                <div className="next-step">
                                    <span className="step-num">2</span>
                                    <span>पहला बिल बनाएं — बस 3 tap!</span>
                                </div>
                                <div className="next-step">
                                    <span className="step-num">3</span>
                                    <span>Customer जोड़ें, credit track करें</span>
                                </div>
                            </div>

                            <button className="btn btn-primary btn-lg" onClick={handleComplete}>
                                KadaiGPT चालू करें 🏪 <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .onboarding-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 9999; padding: 20px;
                }
                
                .onboarding-modal {
                    background: var(--bg-secondary); border-radius: var(--radius-xl);
                    max-width: 600px; width: 100%; padding: 32px;
                    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
                }
                
                .onboarding-progress {
                    display: flex; justify-content: center; gap: 8px; margin-bottom: 32px;
                }
                
                .progress-step {
                    display: flex; align-items: center; gap: 8px;
                }
                
                .step-circle {
                    width: 32px; height: 32px; border-radius: 50%;
                    background: var(--bg-tertiary); color: var(--text-tertiary);
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 600; font-size: 0.875rem; transition: all 0.3s;
                }
                
                .progress-step.active .step-circle {
                    background: var(--primary-500); color: white;
                }
                .progress-step.completed .step-circle {
                    background: var(--success); color: white;
                }
                
                .step-title { font-size: 0.8125rem; color: var(--text-tertiary); }
                .progress-step.active .step-title { color: var(--text-primary); font-weight: 500; }
                
                .step-line { width: 40px; height: 2px; background: var(--border-subtle); }
                .progress-step.completed + .progress-step .step-line,
                .progress-step.active .step-line { background: var(--primary-500); }
                
                .step-content { text-align: center; }
                .step-content h2 { font-size: 1.5rem; margin-bottom: 8px; }
                .step-content > p { color: var(--text-secondary); margin-bottom: 24px; }
                
                .welcome-icon, .complete-icon {
                    width: 80px; height: 80px; margin: 0 auto 24px;
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    color: white; box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
                }
                .complete-icon { background: linear-gradient(135deg, var(--success), #059669); }
                
                .step-icon {
                    width: 64px; height: 64px; margin: 0 auto 16px;
                    background: var(--bg-tertiary); border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    color: var(--primary-400);
                }
                
                .features-list {
                    display: flex; flex-direction: column; gap: 12px;
                    margin: 24px 0 32px; text-align: left;
                    background: var(--bg-tertiary); padding: 20px; border-radius: var(--radius-lg);
                }
                .feature {
                    display: flex; align-items: center; gap: 12px;
                    color: var(--text-secondary);
                }
                .feature svg { color: var(--primary-400); }
                
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left; margin-bottom: 24px; }
                @media (max-width: 500px) { .form-grid { grid-template-columns: 1fr; } }
                
                .step-actions { display: flex; gap: 12px; justify-content: center; }
                
                .btn-lg { padding: 14px 28px; font-size: 1rem; }
                
                .next-steps {
                    text-align: left; background: var(--bg-tertiary); padding: 20px;
                    border-radius: var(--radius-lg); margin: 24px 0;
                }
                .next-steps h4 { margin-bottom: 12px; font-size: 0.9375rem; }
                .next-step {
                    display: flex; align-items: center; gap: 12px; padding: 8px 0;
                    color: var(--text-secondary); font-size: 0.9375rem;
                }
                .step-num {
                    width: 24px; height: 24px; background: var(--primary-500);
                    color: white; border-radius: 50%; display: flex;
                    align-items: center; justify-content: center;
                    font-size: 0.75rem; font-weight: 600;
                }
            `}</style>
        </div>
    )
}
