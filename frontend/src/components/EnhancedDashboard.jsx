import { useState, useEffect } from 'react'
import {
    TrendingUp, TrendingDown, DollarSign, Package, Users,
    ShoppingCart, Calendar, Clock, ArrowUpRight, ArrowDownRight,
    Zap, Target, AlertTriangle, CheckCircle, RefreshCw,
    BarChart3, PieChart, Activity, Globe, Mic, Brain
} from 'lucide-react'

// Multi-language support
const translations = {
    en: {
        title: "Dashboard",
        subtitle: "Your store at a glance",
        todaySales: "Today's Sales",
        totalBills: "Total Bills",
        customers: "Customers",
        avgBill: "Average Bill",
        lowStock: "Low Stock Items",
        recentActivity: "Recent Activity",
        aiInsights: "AI Insights",
        quickActions: "Quick Actions",
        viewAll: "View All",
        newBill: "New Bill",
        addProduct: "Add Product",
        viewReports: "View Reports",
        yesterday: "vs yesterday",
        thisWeek: "This Week",
        peakHours: "Peak Hours",
        topProducts: "Top Products",
        alerts: "Alerts",
        predictions: "ML Predictions",
        greeting: {
            morning: "Good Morning",
            afternoon: "Good Afternoon",
            evening: "Good Evening"
        }
    },
    hi: {
        title: "डैशबोर्ड",
        subtitle: "आपकी दुकान एक नज़र में",
        todaySales: "आज की बिक्री",
        totalBills: "कुल बिल",
        customers: "ग्राहक",
        avgBill: "औसत बिल",
        lowStock: "कम स्टॉक आइटम",
        recentActivity: "हाल की गतिविधि",
        aiInsights: "AI अंतर्दृष्टि",
        quickActions: "त्वरित कार्य",
        viewAll: "सभी देखें",
        newBill: "नया बिल",
        addProduct: "प्रोडक्ट जोड़ें",
        viewReports: "रिपोर्ट देखें",
        yesterday: "कल की तुलना में",
        thisWeek: "इस सप्ताह",
        peakHours: "पीक घंटे",
        topProducts: "टॉप प्रोडक्ट्स",
        alerts: "अलर्ट",
        predictions: "ML भविष्यवाणी",
        greeting: {
            morning: "सुप्रभात",
            afternoon: "नमस्कार",
            evening: "शुभ संध्या"
        }
    },
    ta: {
        title: "டாஷ்போர்ட்",
        subtitle: "உங்கள் கடை ஒரு பார்வையில்",
        todaySales: "இன்றைய விற்பனை",
        totalBills: "மொத்த பில்கள்",
        customers: "வாடிக்கையாளர்கள்",
        avgBill: "சராசரி பில்",
        lowStock: "குறைவான ஸ்டாக்",
        recentActivity: "சமீபத்திய செயல்பாடு",
        aiInsights: "AI நுண்ணறிவு",
        quickActions: "விரைவு செயல்கள்",
        viewAll: "அனைத்தும் பார்",
        newBill: "புதிய பில்",
        addProduct: "பொருள் சேர்",
        viewReports: "அறிக்கைகள் பார்",
        yesterday: "நேற்று ஒப்பிடுகையில்",
        thisWeek: "இந்த வாரம்",
        peakHours: "உச்ச நேரங்கள்",
        topProducts: "சிறந்த பொருட்கள்",
        alerts: "எச்சரிக்கைகள்",
        predictions: "ML கணிப்புகள்",
        greeting: {
            morning: "காலை வணக்கம்",
            afternoon: "மதிய வணக்கம்",
            evening: "மாலை வணக்கம்"
        }
    }
}

// Get greeting based on time
const getGreeting = (lang) => {
    const hour = new Date().getHours()
    const t = translations[lang]?.greeting || translations.en.greeting
    if (hour < 12) return t.morning
    if (hour < 17) return t.afternoon
    return t.evening
}

export default function EnhancedDashboard({
    addToast,
    setCurrentPage,
    language = 'en',
    userName = 'Store Owner'
}) {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)
    const [activities, setActivities] = useState([])
    const [insights, setInsights] = useState([])
    const [predictions, setPredictions] = useState(null)
    const [currentTime, setCurrentTime] = useState(new Date())

    const t = translations[language] || translations.en

    useEffect(() => {
        loadDashboardData()
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const loadDashboardData = async () => {
        setLoading(true)

        // Simulated data - replace with actual API calls
        await new Promise(resolve => setTimeout(resolve, 800))

        setStats({
            todaySales: 24580,
            yesterdaySales: 21840,
            totalBills: 47,
            yesterdayBills: 42,
            customers: 38,
            yesterdayCustomers: 35,
            avgBill: 523,
            yesterdayAvgBill: 520,
            lowStockCount: 3,
            weeklyGrowth: 12.5,
            monthlyTarget: 85
        })

        setActivities([
            { id: 1, type: 'sale', message: 'Bill #2847 - ₹680', time: '2 min ago', icon: ShoppingCart },
            { id: 2, type: 'customer', message: 'New customer registered', time: '15 min ago', icon: Users },
            { id: 3, type: 'stock', message: 'Toor Dal - Low stock alert', time: '30 min ago', icon: AlertTriangle },
            { id: 4, type: 'sale', message: 'Bill #2846 - ₹1,240', time: '45 min ago', icon: ShoppingCart },
            { id: 5, type: 'ai', message: 'AI predicted demand spike', time: '1 hr ago', icon: Brain },
        ])

        setInsights([
            {
                id: 1,
                type: 'opportunity',
                title: language === 'en' ? 'Saturday Peak' : language === 'hi' ? 'शनिवार का पीक' : 'சனிக்கிழமை உச்சம்',
                message: language === 'en' ? 'Sales 32% higher on Saturdays. Stock up!' : 'शनिवार को बिक्री 32% अधिक। स्टॉक करें!',
                priority: 'high'
            },
            {
                id: 2,
                type: 'alert',
                title: language === 'en' ? 'Reorder Needed' : language === 'hi' ? 'रीऑर्डर जरूरी' : 'மறு ஆர்டர் தேவை',
                message: language === 'en' ? '3 products below minimum stock' : '3 प्रोडक्ट्स न्यूनतम स्टॉक से कम',
                priority: 'medium'
            },
            {
                id: 3,
                type: 'trend',
                title: language === 'en' ? 'Dairy Growing' : language === 'hi' ? 'डेयरी बढ़ रही है' : 'பால் பொருட்கள் வளர்ச்சி',
                message: language === 'en' ? 'Dairy sales up 18% this week' : 'इस हफ्ते डेयरी बिक्री 18% बढ़ी',
                priority: 'low'
            }
        ])

        setPredictions({
            nextWeekSales: 185000,
            confidence: 87,
            bestDay: language === 'en' ? 'Saturday' : language === 'hi' ? 'शनिवार' : 'சனிக்கிழமை',
            bestProduct: language === 'en' ? 'Rice (Basmati)' : language === 'hi' ? 'चावल (बासमती)' : 'அரிசி (பாஸ்மதி)',
            demandIncrease: ['Rice', 'Milk', 'Sugar']
        })

        setLoading(false)
    }

    const getChangePercent = (current, previous) => {
        if (!previous) return 0
        return ((current - previous) / previous * 100).toFixed(1)
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        )
    }

    const salesChange = getChangePercent(stats.todaySales, stats.yesterdaySales)
    const billsChange = getChangePercent(stats.totalBills, stats.yesterdayBills)
    const customersChange = getChangePercent(stats.customers, stats.yesterdayCustomers)

    return (
        <div className="enhanced-dashboard">
            {/* Header with Greeting */}
            <div className="dashboard-header">
                <div className="greeting-section">
                    <h1 className="greeting-title">
                        {getGreeting(language)}, <span>{userName}</span>! 👋
                    </h1>
                    <p className="greeting-subtitle">{t.subtitle}</p>
                </div>
                <div className="header-info">
                    <div className="current-time">
                        <Clock size={16} />
                        <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="current-date">
                        <Calendar size={16} />
                        <span>{currentTime.toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-IN', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short'
                        })}</span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid-4">
                {/* Today's Sales */}
                <div className="stat-card primary">
                    <div className="stat-icon">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">{t.todaySales}</span>
                        <span className="stat-value">{formatCurrency(stats.todaySales)}</span>
                        <div className={`stat-change ${salesChange >= 0 ? 'positive' : 'negative'}`}>
                            {salesChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            <span>{Math.abs(salesChange)}% {t.yesterday}</span>
                        </div>
                    </div>
                    <div className="stat-ring" style={{ '--progress': stats.monthlyTarget }}>
                        <span>{stats.monthlyTarget}%</span>
                    </div>
                </div>

                {/* Total Bills */}
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <ShoppingCart size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">{t.totalBills}</span>
                        <span className="stat-value">{stats.totalBills}</span>
                        <div className={`stat-change ${billsChange >= 0 ? 'positive' : 'negative'}`}>
                            {billsChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            <span>{Math.abs(billsChange)}%</span>
                        </div>
                    </div>
                </div>

                {/* Customers */}
                <div className="stat-card">
                    <div className="stat-icon green">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">{t.customers}</span>
                        <span className="stat-value">{stats.customers}</span>
                        <div className={`stat-change ${customersChange >= 0 ? 'positive' : 'negative'}`}>
                            {customersChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            <span>{Math.abs(customersChange)}%</span>
                        </div>
                    </div>
                </div>

                {/* Average Bill */}
                <div className="stat-card">
                    <div className="stat-icon purple">
                        <BarChart3 size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">{t.avgBill}</span>
                        <span className="stat-value">{formatCurrency(stats.avgBill)}</span>
                        <div className="stat-change positive">
                            <TrendingUp size={14} />
                            <span>Healthy</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-content-grid">
                {/* AI Insights Panel */}
                <div className="dashboard-card insights-card">
                    <div className="card-header">
                        <div className="header-title">
                            <Brain size={18} />
                            <h3>{t.aiInsights}</h3>
                        </div>
                        <span className="badge badge-ai">AI Powered</span>
                    </div>
                    <div className="insights-list">
                        {insights.map(insight => (
                            <div key={insight.id} className={`insight-item ${insight.priority}`}>
                                <div className="insight-icon">
                                    {insight.type === 'opportunity' ? <Target size={16} /> :
                                        insight.type === 'alert' ? <AlertTriangle size={16} /> :
                                            <TrendingUp size={16} />}
                                </div>
                                <div className="insight-content">
                                    <strong>{insight.title}</strong>
                                    <span>{insight.message}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Predictions Card */}
                <div className="dashboard-card predictions-card">
                    <div className="card-header">
                        <div className="header-title">
                            <Zap size={18} />
                            <h3>{t.predictions}</h3>
                        </div>
                        <span className="confidence-badge">{predictions?.confidence}% Confident</span>
                    </div>
                    <div className="predictions-content">
                        <div className="prediction-main">
                            <span className="pred-label">{language === 'en' ? 'Next Week Forecast' : 'अगले हफ्ते का पूर्वानुमान'}</span>
                            <span className="pred-value">{formatCurrency(predictions?.nextWeekSales || 0)}</span>
                        </div>
                        <div className="prediction-details">
                            <div className="pred-item">
                                <span className="pred-key">{language === 'en' ? 'Best Day' : 'सबसे अच्छा दिन'}</span>
                                <span className="pred-val">{predictions?.bestDay}</span>
                            </div>
                            <div className="pred-item">
                                <span className="pred-key">{language === 'en' ? 'Top Product' : 'टॉप प्रोडक्ट'}</span>
                                <span className="pred-val">{predictions?.bestProduct}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="dashboard-card activity-card">
                    <div className="card-header">
                        <div className="header-title">
                            <Activity size={18} />
                            <h3>{t.recentActivity}</h3>
                        </div>
                        <button className="view-all-btn" onClick={() => setCurrentPage('bills')}>
                            {t.viewAll} →
                        </button>
                    </div>
                    <div className="activity-list">
                        {activities.map(activity => (
                            <div key={activity.id} className={`activity-item ${activity.type}`}>
                                <div className="activity-icon">
                                    <activity.icon size={14} />
                                </div>
                                <div className="activity-content">
                                    <span className="activity-message">{activity.message}</span>
                                    <span className="activity-time">{activity.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="dashboard-card quick-actions-card">
                    <div className="card-header">
                        <div className="header-title">
                            <Zap size={18} />
                            <h3>{t.quickActions}</h3>
                        </div>
                    </div>
                    <div className="quick-actions-grid">
                        <button className="quick-action-btn primary" onClick={() => setCurrentPage('create-bill')}>
                            <ShoppingCart size={20} />
                            <span>{t.newBill}</span>
                        </button>
                        <button className="quick-action-btn green" onClick={() => setCurrentPage('products')}>
                            <Package size={20} />
                            <span>{t.addProduct}</span>
                        </button>
                        <button className="quick-action-btn blue" onClick={() => setCurrentPage('analytics')}>
                            <BarChart3 size={20} />
                            <span>{t.viewReports}</span>
                        </button>
                        <button className="quick-action-btn purple" onClick={() => setCurrentPage('customers')}>
                            <Users size={20} />
                            <span>{t.customers}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert Bar */}
            {stats.lowStockCount > 0 && (
                <div className="low-stock-bar">
                    <div className="lsb-content">
                        <AlertTriangle size={18} />
                        <span>
                            <strong>{stats.lowStockCount} {t.lowStock}</strong> -
                            {language === 'en' ? ' Need immediate restocking' : ' तुरंत रीस्टॉक करें'}
                        </span>
                    </div>
                    <button className="lsb-action" onClick={() => setCurrentPage('products')}>
                        {t.viewAll}
                    </button>
                </div>
            )}

            <style>{`
                .enhanced-dashboard {
                    padding: 24px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .dashboard-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 400px;
                    gap: 16px;
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--border-subtle);
                    border-top-color: var(--primary-500);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Header */
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 28px;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .greeting-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                    color: var(--text-primary);
                }

                .greeting-title span {
                    background: linear-gradient(135deg, #f97316, #ea580c);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .greeting-subtitle {
                    color: var(--text-secondary);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .header-info {
                    display: flex;
                    gap: 20px;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }

                .header-info > div {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                /* Stats Grid */
                .stats-grid-4 {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 24px;
                }

                .stat-card {
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid var(--border-subtle);
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .stat-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
                }

                .stat-card.primary {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    color: white;
                }

                .stat-card.primary .stat-label,
                .stat-card.primary .stat-change {
                    color: rgba(255, 255, 255, 0.85);
                }

                .stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: var(--bg-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-500);
                }

                .stat-card.primary .stat-icon {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                }

                .stat-icon.blue { color: #3b82f6; }
                .stat-icon.green { color: #22c55e; }
                .stat-icon.purple { color: #8b5cf6; }

                .stat-content {
                    flex: 1;
                }

                .stat-label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .stat-value {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 6px;
                }

                .stat-change {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                }

                .stat-change.positive { color: #22c55e; }
                .stat-change.negative { color: #ef4444; }

                .stat-ring {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: conic-gradient(
                        rgba(255,255,255,0.9) calc(var(--progress) * 3.6deg),
                        rgba(255,255,255,0.2) 0
                    );
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    font-weight: 700;
                }

                .stat-ring span {
                    background: rgba(0,0,0,0.3);
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Content Grid */
                .dashboard-content-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }

                .dashboard-card {
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid var(--border-subtle);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .header-title h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .badge-ai {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 0.65rem;
                    font-weight: 600;
                }

                .confidence-badge {
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .view-all-btn {
                    background: none;
                    border: none;
                    color: var(--primary-500);
                    font-size: 0.8rem;
                    cursor: pointer;
                    font-weight: 500;
                }

                /* Insights */
                .insights-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .insight-item {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 10px;
                    background: var(--bg-secondary);
                    border-left: 3px solid;
                }

                .insight-item.high { border-left-color: #ef4444; }
                .insight-item.medium { border-left-color: #f59e0b; }
                .insight-item.low { border-left-color: #22c55e; }

                .insight-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: var(--bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .insight-content {
                    flex: 1;
                }

                .insight-content strong {
                    display: block;
                    font-size: 0.85rem;
                    margin-bottom: 2px;
                }

                .insight-content span {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                /* Predictions */
                .predictions-content {
                    text-align: center;
                }

                .prediction-main {
                    padding: 20px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
                    border-radius: 12px;
                    margin-bottom: 16px;
                }

                .pred-label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }

                .pred-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #8b5cf6;
                }

                .prediction-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .pred-item {
                    padding: 12px;
                    background: var(--bg-secondary);
                    border-radius: 10px;
                }

                .pred-key {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }

                .pred-val {
                    font-weight: 600;
                    font-size: 0.85rem;
                }

                /* Activity */
                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .activity-item {
                    display: flex;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 8px;
                    background: var(--bg-secondary);
                    align-items: center;
                }

                .activity-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .activity-item.sale .activity-icon { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
                .activity-item.customer .activity-icon { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                .activity-item.stock .activity-icon { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .activity-item.ai .activity-icon { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }

                .activity-content {
                    flex: 1;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .activity-message {
                    font-size: 0.8rem;
                }

                .activity-time {
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                }

                /* Quick Actions */
                .quick-actions-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                .quick-action-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 20px 16px;
                    border-radius: 12px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .quick-action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
                }

                .quick-action-btn.primary:hover { background: linear-gradient(135deg, #f97316, #ea580c); color: white; }
                .quick-action-btn.green:hover { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; }
                .quick-action-btn.blue:hover { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
                .quick-action-btn.purple:hover { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }

                /* Low Stock Bar */
                .low-stock-bar {
                    margin-top: 20px;
                    padding: 14px 20px;
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.1));
                    border-radius: 12px;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .lsb-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #f59e0b;
                }

                .lsb-action {
                    padding: 8px 16px;
                    background: #f59e0b;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .lsb-action:hover {
                    background: #d97706;
                }

                /* Mobile Responsive */
                @media (max-width: 1024px) {
                    .stats-grid-4 {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .enhanced-dashboard {
                        padding: 16px;
                    }

                    .dashboard-header {
                        flex-direction: column;
                    }

                    .greeting-title {
                        font-size: 1.4rem;
                    }

                    .stats-grid-4 {
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }

                    .stat-card {
                        padding: 14px;
                    }

                    .stat-value {
                        font-size: 1.25rem;
                    }

                    .stat-ring {
                        display: none;
                    }

                    .dashboard-content-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
