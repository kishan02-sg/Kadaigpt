import { useState, useEffect } from 'react'
import {
    TrendingUp, TrendingDown, Minus, AlertTriangle,
    Sparkles, ArrowRight, Clock, Target, DollarSign,
    BarChart3, Zap, RefreshCw, Calendar
} from 'lucide-react'

// Multi-language translations
const translations = {
    en: {
        title: "Price Predictions",
        subtitle: "AI-powered market price forecasts",
        nextWeek: "Next 7 Days",
        nextMonth: "Next 30 Days",
        confidence: "Confidence",
        predicted: "Predicted",
        currentPrice: "Current",
        prediction: "Prediction",
        trend: "Trend",
        rising: "Rising",
        falling: "Falling",
        stable: "Stable",
        buyNow: "Buy Now",
        waitToBuy: "Wait to Buy",
        stockUp: "Stock Up",
        priceAlert: "Price Alert",
        setAlert: "Set Price Alert",
        refresh: "Refresh",
        lastUpdated: "Last updated",
        demandFactor: "Demand Factor",
        seasonalImpact: "Seasonal Impact",
        recommendation: "Recommendation",
        reasons: "Why this prediction?",
        high: "High",
        medium: "Medium",
        low: "Low"
    },
    hi: {
        title: "कीमत भविष्यवाणी",
        subtitle: "AI संचालित बाज़ार मूल्य पूर्वानुमान",
        nextWeek: "अगले 7 दिन",
        nextMonth: "अगले 30 दिन",
        confidence: "विश्वास",
        predicted: "अनुमानित",
        currentPrice: "वर्तमान",
        prediction: "भविष्यवाणी",
        trend: "रुझान",
        rising: "बढ़ रहा है",
        falling: "गिर रहा है",
        stable: "स्थिर",
        buyNow: "अभी खरीदें",
        waitToBuy: "खरीदने के लिए इंतज़ार करें",
        stockUp: "स्टॉक करें",
        priceAlert: "मूल्य अलर्ट",
        setAlert: "मूल्य अलर्ट सेट करें",
        refresh: "रिफ्रेश",
        lastUpdated: "अंतिम अपडेट",
        demandFactor: "मांग कारक",
        seasonalImpact: "मौसमी प्रभाव",
        recommendation: "सिफारिश",
        reasons: "यह भविष्यवाणी क्यों?",
        high: "उच्च",
        medium: "मध्यम",
        low: "कम"
    },
    ta: {
        title: "விலை கணிப்புகள்",
        subtitle: "AI இயக்கும் சந்தை விலை கணிப்புகள்",
        nextWeek: "அடுத்த 7 நாட்கள்",
        nextMonth: "அடுத்த 30 நாட்கள்",
        confidence: "நம்பகத்தன்மை",
        predicted: "கணிக்கப்பட்டது",
        currentPrice: "தற்போதைய",
        prediction: "கணிப்பு",
        trend: "போக்கு",
        rising: "உயருகிறது",
        falling: "குறைகிறது",
        stable: "நிலையானது",
        buyNow: "இப்போதே வாங்கு",
        waitToBuy: "வாங்க காத்திரு",
        stockUp: "சேமித்து வை",
        priceAlert: "விலை எச்சரிக்கை",
        setAlert: "விலை எச்சரிக்கை அமை",
        refresh: "புதுப்பி",
        lastUpdated: "கடைசியாக புதுப்பிக்கப்பட்டது",
        demandFactor: "தேவை காரணி",
        seasonalImpact: "பருவகால தாக்கம்",
        recommendation: "பரிந்துரை",
        reasons: "இந்த கணிப்பு ஏன்?",
        high: "அதிக",
        medium: "நடுத்தர",
        low: "குறைவு"
    }
}

// Simulated ML-based price predictions
const generatePredictions = (products) => {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return []
    }

    const factors = [
        'Seasonal demand increase',
        'Festival approaching',
        'Monsoon season impact',
        'Supply chain disruption',
        'Market competition',
        'Agricultural yield changes',
        'Transportation costs rising',
        'Import/export policy changes'
    ]

    return products.filter(p => p && p.price).map(product => {
        const price = product.price || 100
        const change = (Math.random() * 30 - 10) // -10% to +20%
        const trend = change > 2 ? 'rising' : change < -2 ? 'falling' : 'stable'
        const confidence = Math.floor(70 + Math.random() * 25) // 70-95%
        const predictedPrice = Math.round(price * (1 + change / 100))

        // Generate recommendation based on trend
        let recommendation
        if (trend === 'rising') {
            recommendation = 'stockUp'
        } else if (trend === 'falling') {
            recommendation = 'waitToBuy'
        } else {
            recommendation = 'buyNow'
        }

        return {
            id: product.id || Math.random().toString(),
            name: product.name || 'Unknown Product',
            category: product.category || 'General',
            unit: product.unit || 'kg',
            currentPrice: price,
            predictedPrice,
            changePercent: change.toFixed(1),
            trend,
            confidence,
            recommendation,
            demandFactor: ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
            seasonalImpact: Math.random() > 0.5 ? 'Positive' : 'Negative',
            reasons: [
                factors[Math.floor(Math.random() * factors.length)],
                factors[Math.floor(Math.random() * factors.length)]
            ].filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        }
    })
}

// Demo products if none provided
const demoProducts = [
    { id: 1, name: 'Basmati Rice', price: 85, category: 'Grains', unit: 'kg' },
    { id: 2, name: 'Toor Dal', price: 145, category: 'Pulses', unit: 'kg' },
    { id: 3, name: 'Sunflower Oil', price: 165, category: 'Oils', unit: 'L' },
    { id: 4, name: 'Sugar', price: 48, category: 'Essentials', unit: 'kg' },
    { id: 5, name: 'Wheat Flour', price: 42, category: 'Grains', unit: 'kg' },
    { id: 6, name: 'Milk', price: 58, category: 'Dairy', unit: 'L' },
]

export default function PricePredictions({
    products = demoProducts,
    language = 'en',
    onAlertSet = () => { }
}) {
    const [predictions, setPredictions] = useState([])
    const [loading, setLoading] = useState(true)
    const [timeframe, setTimeframe] = useState('week') // week or month
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [lastUpdated, setLastUpdated] = useState(null)
    const [filter, setFilter] = useState('all') // all, rising, falling

    const t = translations[language] || translations.en

    useEffect(() => {
        loadPredictions()
    }, [products, timeframe])

    const loadPredictions = async () => {
        setLoading(true)

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800))

        // In production, this would call your backend ML API
        const preds = generatePredictions(products)
        setPredictions(preds)
        setLastUpdated(new Date())
        setLoading(false)
    }

    const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'rising': return <TrendingUp size={16} className="trend-up" />
            case 'falling': return <TrendingDown size={16} className="trend-down" />
            default: return <Minus size={16} className="trend-stable" />
        }
    }

    const getRecommendationStyle = (rec) => {
        switch (rec) {
            case 'stockUp': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', icon: AlertTriangle }
            case 'waitToBuy': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', icon: Clock }
            case 'buyNow': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', icon: Target }
            default: return { bg: 'transparent', color: 'inherit', icon: Minus }
        }
    }

    const filteredPredictions = predictions.filter(p => {
        if (filter === 'all') return true
        return p.trend === filter
    })

    // Summary stats
    const risingCount = predictions.filter(p => p.trend === 'rising').length
    const fallingCount = predictions.filter(p => p.trend === 'falling').length
    const stableCount = predictions.filter(p => p.trend === 'stable').length

    if (loading) {
        return (
            <div className="price-predictions loading">
                <div className="loading-spinner">
                    <Sparkles size={40} />
                    <p>Analyzing market trends...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="price-predictions">
            {/* Header */}
            <div className="pp-header">
                <div className="pp-title-section">
                    <h2><Sparkles size={22} /> {t.title}</h2>
                    <p>{t.subtitle}</p>
                </div>
                <div className="pp-controls">
                    <div className="timeframe-selector">
                        <button
                            className={timeframe === 'week' ? 'active' : ''}
                            onClick={() => setTimeframe('week')}
                        >
                            {t.nextWeek}
                        </button>
                        <button
                            className={timeframe === 'month' ? 'active' : ''}
                            onClick={() => setTimeframe('month')}
                        >
                            {t.nextMonth}
                        </button>
                    </div>
                    <button className="refresh-btn" onClick={loadPredictions}>
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="pp-summary">
                <div
                    className={`summary-card rising ${filter === 'rising' ? 'active' : ''}`}
                    onClick={() => setFilter(filter === 'rising' ? 'all' : 'rising')}
                >
                    <TrendingUp size={20} />
                    <span className="count">{risingCount}</span>
                    <span className="label">{t.rising}</span>
                </div>
                <div
                    className={`summary-card falling ${filter === 'falling' ? 'active' : ''}`}
                    onClick={() => setFilter(filter === 'falling' ? 'all' : 'falling')}
                >
                    <TrendingDown size={20} />
                    <span className="count">{fallingCount}</span>
                    <span className="label">{t.falling}</span>
                </div>
                <div
                    className={`summary-card stable ${filter === 'stable' ? 'active' : ''}`}
                    onClick={() => setFilter(filter === 'stable' ? 'all' : 'stable')}
                >
                    <Minus size={20} />
                    <span className="count">{stableCount}</span>
                    <span className="label">{t.stable}</span>
                </div>
            </div>

            {/* Predictions List */}
            <div className="pp-list">
                {filteredPredictions.map(pred => {
                    const recStyle = getRecommendationStyle(pred.recommendation)
                    const RecIcon = recStyle.icon

                    return (
                        <div
                            key={pred.id}
                            className={`prediction-card ${pred.trend}`}
                            onClick={() => setSelectedProduct(selectedProduct === pred.id ? null : pred.id)}
                        >
                            <div className="pred-main">
                                <div className="pred-product">
                                    <span className="prod-name">{pred.name}</span>
                                    <span className="prod-category">{pred.category} • {pred.unit}</span>
                                </div>

                                <div className="pred-prices">
                                    <div className="price-current">
                                        <span className="label">{t.currentPrice}</span>
                                        <span className="value">{formatCurrency(pred.currentPrice)}</span>
                                    </div>
                                    <ArrowRight size={16} className="price-arrow" />
                                    <div className="price-predicted">
                                        <span className="label">{t.predicted}</span>
                                        <span className="value">{formatCurrency(pred.predictedPrice)}</span>
                                    </div>
                                </div>

                                <div className="pred-trend">
                                    {getTrendIcon(pred.trend)}
                                    <span className={`trend-percent ${pred.trend}`}>
                                        {pred.changePercent > 0 ? '+' : ''}{pred.changePercent}%
                                    </span>
                                </div>

                                <div
                                    className="pred-recommendation"
                                    style={{ background: recStyle.bg, color: recStyle.color }}
                                >
                                    <RecIcon size={14} />
                                    <span>{t[pred.recommendation]}</span>
                                </div>

                                <div className="pred-confidence">
                                    <div className="conf-bar">
                                        <div
                                            className="conf-fill"
                                            style={{ width: `${pred.confidence}%` }}
                                        />
                                    </div>
                                    <span>{pred.confidence}%</span>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {selectedProduct === pred.id && (
                                <div className="pred-details">
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">{t.demandFactor}</span>
                                            <span className={`detail-value ${pred.demandFactor.toLowerCase()}`}>
                                                {t[pred.demandFactor.toLowerCase()] || pred.demandFactor}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">{t.seasonalImpact}</span>
                                            <span className="detail-value">{pred.seasonalImpact}</span>
                                        </div>
                                    </div>
                                    <div className="detail-reasons">
                                        <span className="reasons-title">{t.reasons}</span>
                                        <ul>
                                            {pred.reasons.map((reason, i) => (
                                                <li key={i}>{reason}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <button
                                        className="set-alert-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onAlertSet(pred)
                                        }}
                                    >
                                        <AlertTriangle size={14} />
                                        {t.setAlert}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Last Updated */}
            {lastUpdated && (
                <div className="pp-footer">
                    <Clock size={12} />
                    <span>{t.lastUpdated}: {lastUpdated.toLocaleTimeString()}</span>
                </div>
            )}

            <style>{`
                .price-predictions {
                    padding: 20px;
                    background: var(--bg-card);
                    border-radius: 16px;
                    border: 1px solid var(--border-subtle);
                }

                .price-predictions.loading {
                    min-height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .loading-spinner {
                    text-align: center;
                    color: var(--primary-500);
                }

                .loading-spinner svg {
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }

                .loading-spinner p {
                    margin-top: 12px;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }

                /* Header */
                .pp-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .pp-title-section h2 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 1.25rem;
                    margin: 0;
                }

                .pp-title-section h2 svg {
                    color: var(--primary-500);
                }

                .pp-title-section p {
                    margin: 4px 0 0;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .pp-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .timeframe-selector {
                    display: flex;
                    background: var(--bg-secondary);
                    border-radius: 8px;
                    padding: 3px;
                }

                .timeframe-selector button {
                    padding: 6px 12px;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .timeframe-selector button.active {
                    background: var(--primary-500);
                    color: white;
                }

                .refresh-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-card);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .refresh-btn:hover {
                    border-color: var(--primary-500);
                    color: var(--primary-500);
                }

                /* Summary */
                .pp-summary {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .summary-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 16px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 2px solid transparent;
                }

                .summary-card.rising {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .summary-card.falling {
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                }

                .summary-card.stable {
                    background: rgba(100, 116, 139, 0.1);
                    color: #64748b;
                }

                .summary-card.active {
                    border-color: currentColor;
                }

                .summary-card .count {
                    font-size: 1.75rem;
                    font-weight: 700;
                    margin: 8px 0 4px;
                }

                .summary-card .label {
                    font-size: 0.75rem;
                    opacity: 0.8;
                }

                /* Predictions List */
                .pp-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .prediction-card {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border-left: 4px solid transparent;
                }

                .prediction-card.rising {
                    border-left-color: #ef4444;
                }

                .prediction-card.falling {
                    border-left-color: #22c55e;
                }

                .prediction-card.stable {
                    border-left-color: #64748b;
                }

                .prediction-card:hover {
                    background: var(--bg-tertiary);
                }

                .pred-main {
                    display: grid;
                    grid-template-columns: 1.5fr 2fr auto auto auto;
                    align-items: center;
                    gap: 16px;
                }

                .prod-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .prod-category {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                }

                .pred-prices {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .price-current,
                .price-predicted {
                    text-align: center;
                }

                .price-current .label,
                .price-predicted .label {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                }

                .price-current .value {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }

                .price-predicted .value {
                    font-size: 1rem;
                    font-weight: 600;
                }

                .price-arrow {
                    color: var(--text-tertiary);
                }

                .pred-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .trend-up { color: #ef4444; }
                .trend-down { color: #22c55e; }
                .trend-stable { color: #64748b; }

                .trend-percent {
                    font-weight: 600;
                    font-size: 0.85rem;
                }

                .trend-percent.rising { color: #ef4444; }
                .trend-percent.falling { color: #22c55e; }
                .trend-percent.stable { color: #64748b; }

                .pred-recommendation {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .pred-confidence {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .conf-bar {
                    width: 50px;
                    height: 4px;
                    background: var(--bg-tertiary);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .conf-fill {
                    height: 100%;
                    background: var(--primary-500);
                    border-radius: 2px;
                }

                .pred-confidence span {
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                }

                /* Details */
                .pred-details {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--border-subtle);
                    animation: expandIn 0.2s ease;
                }

                @keyframes expandIn {
                    from { opacity: 0; max-height: 0; }
                    to { opacity: 1; max-height: 200px; }
                }

                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .detail-item {
                    background: var(--bg-tertiary);
                    padding: 10px;
                    border-radius: 8px;
                }

                .detail-label {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                    margin-bottom: 4px;
                }

                .detail-value {
                    font-weight: 600;
                    font-size: 0.85rem;
                }

                .detail-value.high { color: #ef4444; }
                .detail-value.medium { color: #f59e0b; }
                .detail-value.low { color: #22c55e; }

                .detail-reasons {
                    margin-bottom: 12px;
                }

                .reasons-title {
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                    display: block;
                    margin-bottom: 6px;
                }

                .detail-reasons ul {
                    margin: 0;
                    padding-left: 20px;
                }

                .detail-reasons li {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }

                .set-alert-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    background: var(--primary-500);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .set-alert-btn:hover {
                    background: var(--primary-600);
                }

                /* Footer */
                .pp-footer {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 16px;
                    padding-top: 12px;
                    border-top: 1px solid var(--border-subtle);
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                }

                /* Mobile */
                @media (max-width: 768px) {
                    .pp-header {
                        flex-direction: column;
                    }

                    .pp-summary {
                        gap: 8px;
                    }

                    .summary-card {
                        padding: 12px;
                    }

                    .summary-card .count {
                        font-size: 1.5rem;
                    }

                    .pred-main {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }

                    .pred-prices {
                        justify-content: center;
                    }

                    .pred-trend,
                    .pred-recommendation,
                    .pred-confidence {
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    )
}
