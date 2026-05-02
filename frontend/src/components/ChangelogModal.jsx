import { useState } from 'react'
import { X, Sparkles, Zap, Gift, Bug, Star, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

const releases = [
    {
        version: '2.5.0',
        date: 'Feb 2, 2026',
        type: 'major',
        title: 'AI Agentathon Special Release',
        highlights: [
            { icon: Sparkles, text: 'Command Palette (Cmd+K) for power users', type: 'feature' },
            { icon: Zap, text: 'AI-Powered Stock Predictions', type: 'feature' },
            { icon: Gift, text: 'Advanced Loyalty Program', type: 'feature' },
            { icon: Star, text: 'Real-time Notification Center', type: 'feature' },
        ]
    },
    {
        version: '2.4.0',
        date: 'Jan 28, 2026',
        type: 'minor',
        title: 'WhatsApp Bot Integration',
        highlights: [
            { icon: Sparkles, text: 'WhatsApp Business API Integration', type: 'feature' },
            { icon: Zap, text: 'Auto bill sharing via WhatsApp', type: 'feature' },
            { icon: Bug, text: 'Fixed GST calculation edge cases', type: 'fix' },
        ]
    },
    {
        version: '2.3.0',
        date: 'Jan 15, 2026',
        type: 'minor',
        title: 'Smart OCR & Voice Commands',
        highlights: [
            { icon: Sparkles, text: 'Hindi/Tamil voice command support', type: 'feature' },
            { icon: Zap, text: 'Improved OCR accuracy to 98%', type: 'improvement' },
            { icon: Star, text: 'Bulk product import via Excel', type: 'feature' },
        ]
    },
]

export default function ChangelogModal({ isOpen, onClose }) {
    const [activeIndex, setActiveIndex] = useState(0)

    if (!isOpen) return null

    const release = releases[activeIndex]

    return (
        <div className="changelog-overlay" onClick={onClose}>
            <div className="changelog-modal" onClick={e => e.stopPropagation()}>
                <button className="changelog-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="changelog-header">
                    <div className="changelog-badge">
                        <Sparkles size={14} />
                        What's New
                    </div>
                    <h2>KadaiGPT Updates</h2>
                    <p>See what's new in the latest version</p>
                </div>

                <div className="changelog-nav">
                    <button
                        className="nav-btn"
                        disabled={activeIndex === 0}
                        onClick={() => setActiveIndex(prev => prev - 1)}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="version-dots">
                        {releases.map((_, i) => (
                            <button
                                key={i}
                                className={`dot ${i === activeIndex ? 'active' : ''}`}
                                onClick={() => setActiveIndex(i)}
                            />
                        ))}
                    </div>
                    <button
                        className="nav-btn"
                        disabled={activeIndex === releases.length - 1}
                        onClick={() => setActiveIndex(prev => prev + 1)}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="changelog-content">
                    <div className="release-card">
                        <div className="release-header">
                            <span className={`release-type ${release.type}`}>
                                {release.type === 'major' ? '🚀 Major Release' : '✨ Update'}
                            </span>
                            <span className="release-version">v{release.version}</span>
                        </div>
                        <h3>{release.title}</h3>
                        <p className="release-date">{release.date}</p>

                        <div className="release-highlights">
                            {release.highlights.map((item, i) => (
                                <div key={i} className={`highlight-item ${item.type}`}>
                                    <item.icon size={18} />
                                    <span>{item.text}</span>
                                    <span className={`highlight-badge ${item.type}`}>
                                        {item.type === 'feature' ? 'New' : item.type === 'fix' ? 'Fix' : 'Improved'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="changelog-footer">
                    <button className="btn btn-primary" onClick={onClose}>
                        Got it! <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            <style>{`
                .changelog-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                }
                
                .changelog-modal {
                    position: relative;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-2xl);
                    max-width: 500px;
                    width: 100%;
                    overflow: hidden;
                    animation: scaleIn 0.3s ease-out;
                }
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                
                .changelog-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    cursor: pointer;
                    z-index: 10;
                }
                .changelog-close:hover {
                    background: var(--error);
                    color: white;
                }
                
                .changelog-header {
                    text-align: center;
                    padding: 32px 32px 16px;
                }
                .changelog-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    color: white;
                    padding: 6px 14px;
                    border-radius: var(--radius-full);
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-bottom: 16px;
                }
                .changelog-header h2 {
                    margin: 0 0 8px;
                    font-size: 1.5rem;
                }
                .changelog-header p {
                    color: var(--text-secondary);
                    margin: 0;
                }
                
                .changelog-nav {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    padding: 16px;
                }
                .nav-btn {
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    cursor: pointer;
                }
                .nav-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }
                .nav-btn:not(:disabled):hover {
                    background: var(--primary-500);
                    color: white;
                }
                .version-dots {
                    display: flex;
                    gap: 8px;
                }
                .dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--bg-tertiary);
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .dot.active {
                    background: var(--primary-500);
                    transform: scale(1.2);
                }
                
                .changelog-content {
                    padding: 0 32px;
                }
                
                .release-card {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-xl);
                    padding: 24px;
                }
                .release-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                .release-type {
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .release-type.major { color: var(--primary-400); }
                .release-type.minor { color: var(--success); }
                .release-version {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    padding: 4px 8px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }
                .release-card h3 {
                    margin: 0 0 4px;
                    font-size: 1.125rem;
                }
                .release-date {
                    font-size: 0.8125rem;
                    color: var(--text-tertiary);
                    margin-bottom: 16px;
                }
                
                .release-highlights {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .highlight-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                }
                .highlight-item svg {
                    flex-shrink: 0;
                }
                .highlight-item.feature svg { color: var(--primary-400); }
                .highlight-item.fix svg { color: var(--success); }
                .highlight-item.improvement svg { color: var(--warning); }
                .highlight-item span:first-of-type { flex: 1; }
                
                .highlight-badge {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                }
                .highlight-badge.feature {
                    background: rgba(124, 58, 237, 0.15);
                    color: var(--primary-400);
                }
                .highlight-badge.fix {
                    background: rgba(34, 197, 94, 0.15);
                    color: var(--success);
                }
                .highlight-badge.improvement {
                    background: rgba(234, 179, 8, 0.15);
                    color: var(--warning);
                }
                
                .changelog-footer {
                    padding: 24px 32px;
                    display: flex;
                    justify-content: center;
                }
            `}</style>
        </div>
    )
}
