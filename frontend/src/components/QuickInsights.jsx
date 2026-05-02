import { useState, useEffect } from 'react'
import {
    Sparkles, TrendingUp, TrendingDown, Package, Users, Target,
    AlertTriangle, CheckCircle, Clock, ChevronRight, Lightbulb,
    IndianRupee, ShoppingCart, BarChart2, Zap
} from 'lucide-react'

// Demo insights data
const generateInsights = (language = 'en') => {
    const translations = {
        en: {
            salesUp: 'Sales are up 23% compared to last week',
            bestDay: 'Saturday is your best performing day',
            lowStock: '5 products need restocking today',
            topProduct: 'Basmati Rice is your top seller today',
            newCustomers: '12 new customers this week',
            peakHour: 'Peak hours: 11 AM - 1 PM, 6 PM - 8 PM',
            opportunity: 'Consider stocking more dairy products',
            cashFlow: 'Cash flow positive by ₹45,000',
        },
        hi: {
            salesUp: 'बिक्री पिछले सप्ताह की तुलना में 23% ऊपर है',
            bestDay: 'शनिवार आपका सबसे अच्छा दिन है',
            lowStock: '5 उत्पादों को आज पुनः स्टॉक करना होगा',
            topProduct: 'बासमती चावल आज आपका टॉप सेलर है',
            newCustomers: 'इस सप्ताह 12 नए ग्राहक',
            peakHour: 'पीक आवर्स: 11 AM - 1 PM, 6 PM - 8 PM',
            opportunity: 'अधिक डेयरी उत्पाद स्टॉक करने पर विचार करें',
            cashFlow: 'कैश फ्लो ₹45,000 पॉजिटिव',
        },
        ta: {
            salesUp: 'கடந்த வாரத்தை விட விற்பனை 23% அதிகம்',
            bestDay: 'சனிக்கிழமை உங்கள் சிறந்த நாள்',
            lowStock: '5 பொருட்கள் இன்று மறு சேமிப்பு தேவை',
            topProduct: 'பாஸ்மதி அரிசி இன்று டாப் செல்லர்',
            newCustomers: 'இந்த வாரம் 12 புதிய வாடிக்கையாளர்கள்',
            peakHour: 'பீக் நேரம்: 11 AM - 1 PM, 6 PM - 8 PM',
            opportunity: 'பால் பொருட்கள் அதிகம் சேமிக்க பரிசீலிக்கவும்',
            cashFlow: 'பணப்புழக்கம் ₹45,000 நேர்மறை',
        }
    }

    const t = translations[language] || translations.en

    return [
        {
            id: 1,
            type: 'positive',
            icon: TrendingUp,
            text: t.salesUp,
            priority: 'high',
            category: 'sales'
        },
        {
            id: 2,
            type: 'info',
            icon: Target,
            text: t.bestDay,
            priority: 'medium',
            category: 'analytics'
        },
        {
            id: 3,
            type: 'warning',
            icon: AlertTriangle,
            text: t.lowStock,
            priority: 'high',
            category: 'inventory'
        },
        {
            id: 4,
            type: 'positive',
            icon: ShoppingCart,
            text: t.topProduct,
            priority: 'medium',
            category: 'sales'
        },
        {
            id: 5,
            type: 'info',
            icon: Users,
            text: t.newCustomers,
            priority: 'low',
            category: 'customers'
        },
        {
            id: 6,
            type: 'info',
            icon: Clock,
            text: t.peakHour,
            priority: 'medium',
            category: 'analytics'
        },
        {
            id: 7,
            type: 'suggestion',
            icon: Lightbulb,
            text: t.opportunity,
            priority: 'low',
            category: 'opportunity'
        },
        {
            id: 8,
            type: 'positive',
            icon: IndianRupee,
            text: t.cashFlow,
            priority: 'medium',
            category: 'finance'
        }
    ]
}

export default function QuickInsights({
    language = 'en',
    maxItems = 6,
    onAction,
    showHeader = true
}) {
    const [insights, setInsights] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('all')

    useEffect(() => {
        setInsights(generateInsights(language))
    }, [language])

    const categories = [
        { id: 'all', label: language === 'ta' ? 'அனைத்தும்' : (language === 'hi' ? 'सभी' : 'All') },
        { id: 'sales', label: language === 'ta' ? 'விற்பனை' : (language === 'hi' ? 'बिक्री' : 'Sales') },
        { id: 'inventory', label: language === 'ta' ? 'இருப்பு' : (language === 'hi' ? 'इन्वेंटरी' : 'Inventory') },
        { id: 'analytics', label: language === 'ta' ? 'பகுப்பாய்வு' : (language === 'hi' ? 'एनालिटिक्स' : 'Analytics') },
    ]

    const filteredInsights = insights
        .filter(i => selectedCategory === 'all' || i.category === selectedCategory)
        .slice(0, maxItems)

    const typeStyles = {
        positive: { bg: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
        warning: { bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
        info: { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
        suggestion: { bg: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
        negative: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
    }

    return (
        <div className="quick-insights">
            {showHeader && (
                <div className="insights-header">
                    <h3>
                        <Sparkles size={18} />
                        {language === 'ta' ? 'AI நுண்ணறிவுகள்' : (language === 'hi' ? 'AI इनसाइट्स' : 'AI Insights')}
                    </h3>
                    <div className="category-filter">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="insights-grid">
                {filteredInsights.map((insight, index) => {
                    const Icon = insight.icon
                    const style = typeStyles[insight.type]

                    return (
                        <div
                            key={insight.id}
                            className={`insight-card ${insight.priority}`}
                            style={{
                                background: style.bg,
                                borderColor: style.border,
                                animationDelay: `${index * 80}ms`
                            }}
                            onClick={() => onAction?.(insight)}
                        >
                            <div
                                className="insight-icon"
                                style={{ color: style.color }}
                            >
                                <Icon size={18} />
                            </div>
                            <p className="insight-text">{insight.text}</p>
                            {onAction && (
                                <ChevronRight size={16} className="insight-arrow" />
                            )}
                        </div>
                    )
                })}
            </div>

            <style>{`
                .quick-insights {
                    background: var(--bg-card);
                    border-radius: 16px;
                    border: 1px solid var(--border-subtle);
                    padding: 20px;
                }

                .insights-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .insights-header h3 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .insights-header h3 svg {
                    color: var(--primary-500);
                }

                .category-filter {
                    display: flex;
                    gap: 6px;
                    background: var(--bg-tertiary);
                    padding: 4px;
                    border-radius: 10px;
                }

                .filter-btn {
                    padding: 6px 12px;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .filter-btn:hover {
                    background: var(--bg-secondary);
                }

                .filter-btn.active {
                    background: var(--primary-500);
                    color: white;
                }

                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 12px;
                }

                .insight-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    border-radius: 12px;
                    border: 1px solid;
                    cursor: pointer;
                    transition: all 0.2s;
                    animation: fadeInUp 0.4s ease forwards;
                    opacity: 0;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .insight-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .insight-card.high {
                    animation-name: fadeInUp, glow;
                }

                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 0 rgba(249, 115, 22, 0); }
                    50% { box-shadow: 0 0 12px rgba(249, 115, 22, 0.3); }
                }

                .insight-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.15);
                    flex-shrink: 0;
                }

                .insight-text {
                    flex: 1;
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 500;
                    line-height: 1.4;
                }

                .insight-arrow {
                    color: var(--text-tertiary);
                    flex-shrink: 0;
                    transition: transform 0.2s;
                }

                .insight-card:hover .insight-arrow {
                    transform: translateX(2px);
                }

                @media (max-width: 768px) {
                    .insights-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .category-filter {
                        width: 100%;
                        overflow-x: auto;
                    }

                    .insights-grid {
                        grid-template-columns: 1fr;
                    }

                    .insight-card {
                        padding: 12px 14px;
                    }

                    .insight-text {
                        font-size: 0.8rem;
                    }
                }
            `}</style>
        </div>
    )
}
