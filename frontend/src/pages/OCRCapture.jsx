import { useState } from 'react'
import { Camera, Sparkles, Zap, FileText, Bot, ArrowRight, Star } from 'lucide-react'

export default function OCRCapture({ addToast, setCurrentPage }) {
    const [showInterest, setShowInterest] = useState(false)

    const features = [
        {
            icon: Camera,
            title: 'Smart Bill Scanning',
            description: 'Point your camera at any handwritten or printed bill and let AI extract all items automatically.'
        },
        {
            icon: Bot,
            title: 'Multi-Language OCR',
            description: 'Supports English, Hindi, Tamil, Telugu - understands regional handwriting styles.'
        },
        {
            icon: Zap,
            title: '98% Accuracy',
            description: 'Advanced AI models trained on millions of Indian retail bills for maximum accuracy.'
        },
        {
            icon: FileText,
            title: 'Instant Billing',
            description: 'Extracted items are instantly added to a new bill - just confirm and print!'
        }
    ]

    const handleNotifyMe = () => {
        setShowInterest(true)
        addToast('Thanks! We\'ll notify you when Smart Scan is ready.', 'success')
    }

    return (
        <div className="page-container" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
            <style>{`
                .coming-soon-hero {
                    text-align: center;
                    padding: 48px 24px;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(99, 102, 241, 0.05));
                    border-radius: 24px;
                    border: 2px dashed rgba(124, 58, 237, 0.3);
                    margin-bottom: 32px;
                }
                .coming-soon-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #7c3aed, #6366f1);
                    color: white;
                    border-radius: 100px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 24px;
                }
                .coming-soon-title {
                    font-size: 2.5rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #7c3aed, #ec4899);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 16px;
                }
                .coming-soon-subtitle {
                    font-size: 1.125rem;
                    color: var(--text-secondary);
                    max-width: 600px;
                    margin: 0 auto 32px;
                    line-height: 1.6;
                }
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-bottom: 32px;
                }
                .feature-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    padding: 24px;
                    transition: all 0.3s ease;
                }
                .feature-card:hover {
                    border-color: var(--primary-500);
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(124, 58, 237, 0.15);
                }
                .feature-icon {
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(99, 102, 241, 0.1));
                    border-radius: 12px;
                    color: var(--primary-500);
                    margin-bottom: 16px;
                }
                .feature-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                }
                .feature-desc {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }
                .cta-section {
                    text-align: center;
                    padding: 32px;
                    background: var(--bg-secondary);
                    border-radius: 16px;
                }
                .cta-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .cta-desc {
                    color: var(--text-secondary);
                    margin-bottom: 24px;
                }
                .btn-notify {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #7c3aed, #6366f1);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .btn-notify:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
                }
                .btn-notify:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .interested-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: white;
                    border-radius: 12px;
                    font-weight: 600;
                }
                .alternative-section {
                    margin-top: 32px;
                    padding: 24px;
                    background: rgba(234, 179, 8, 0.1);
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    border-radius: 16px;
                    text-align: center;
                }
                .alternative-title {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #ca8a04;
                    margin-bottom: 12px;
                }
                .alternative-text {
                    color: var(--text-secondary);
                    margin-bottom: 16px;
                }
                .btn-alt {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: #ca8a04;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-alt:hover {
                    background: #a16207;
                }
            `}</style>

            <div className="coming-soon-hero">
                <div className="coming-soon-badge">
                    <Sparkles size={16} />
                    Coming Soon
                </div>
                <h1 className="coming-soon-title">AI Smart Scan</h1>
                <p className="coming-soon-subtitle">
                    Revolutionary OCR technology that reads handwritten bills in seconds.
                    Our AI is being trained on thousands of Indian retail bills to give you
                    the most accurate extraction possible.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                    <Star size={16} fill="currentColor" />
                    <span>Premium Feature • Expected Q2 2026</span>
                </div>
            </div>

            <div className="features-grid">
                {features.map((feature, i) => (
                    <div key={i} className="feature-card">
                        <div className="feature-icon">
                            <feature.icon size={24} />
                        </div>
                        <h3 className="feature-title">{feature.title}</h3>
                        <p className="feature-desc">{feature.description}</p>
                    </div>
                ))}
            </div>

            <div className="cta-section">
                <h2 className="cta-title">Be the First to Know</h2>
                <p className="cta-desc">Get notified when Smart Scan launches. Early access for active users!</p>

                {showInterest ? (
                    <div className="interested-badge">
                        <Star size={18} fill="white" />
                        You're on the list! We'll notify you soon.
                    </div>
                ) : (
                    <button className="btn-notify" onClick={handleNotifyMe}>
                        <Sparkles size={18} />
                        Notify Me When Ready
                    </button>
                )}
            </div>

            <div className="alternative-section">
                <h3 className="alternative-title">
                    <Zap size={20} />
                    Need Billing Now?
                </h3>
                <p className="alternative-text">
                    Use our Quick Bill feature to create bills instantly. Add products, quantities, and print!
                </p>
                <button className="btn-alt" onClick={() => setCurrentPage('create-bill')}>
                    Create Quick Bill <ArrowRight size={16} />
                </button>
            </div>
        </div>
    )
}
