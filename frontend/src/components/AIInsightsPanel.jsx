import { useState, useEffect } from 'react'
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Users, Package, Clock, Zap, ArrowRight, RefreshCw, Brain } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function AIInsightsPanel({ addToast }) {
    const [predictions, setPredictions] = useState(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState(null)

    useEffect(() => {
        loadPredictions()
    }, [])

    const loadPredictions = async () => {
        setLoading(true)
        try {
            const data = await realDataService.getAIPredictions()
            setPredictions(data)
            setLastUpdated(new Date())
        } catch (error) {
            console.error('Failed to load predictions:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="ai-insights-panel loading">
                <div className="ai-loading">
                    <Brain className="pulse" size={32} />
                    <span>AI is analyzing your business data...</span>
                </div>
                <style>{`
                    .ai-loading {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        padding: 48px;
                        color: var(--text-secondary);
                    }
                    .ai-loading .pulse {
                        animation: pulse 2s ease-in-out infinite;
                        color: var(--primary-500);
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.1); }
                    }
                `}</style>
            </div>
        )
    }

    if (!predictions) {
        return (
            <div className="ai-insights-panel empty">
                <Sparkles size={48} />
                <h3>Start creating bills to unlock AI insights!</h3>
                <p>Our AI needs some data to analyze trends and make predictions.</p>
            </div>
        )
    }

    const { summary, seasonality, customerInsights, inventory, forecasts, actionItems } = predictions

    return (
        <div className="ai-insights-panel">
            <style>{`
                .ai-insights-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    padding: 24px;
                }
                .ai-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                }
                .ai-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ai-title h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0;
                    background: linear-gradient(135deg, #7c3aed, #ec4899);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .ai-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1));
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--primary-500);
                }
                .refresh-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 0.8125rem;
                    transition: all 0.2s;
                }
                .refresh-btn:hover {
                    background: var(--bg-secondary);
                    color: var(--primary-500);
                }
                
                .insights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 16px;
                    margin-bottom: 24px;
                }
                
                .insight-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 16px;
                    transition: all 0.2s;
                }
                .insight-card:hover {
                    border-color: var(--primary-400);
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1);
                }
                .insight-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                .insight-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    color: white;
                }
                .insight-icon.trend { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .insight-icon.peak { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .insight-icon.customer { background: linear-gradient(135deg, #3b82f6, #2563eb); }
                .insight-icon.forecast { background: linear-gradient(135deg, #7c3aed, #6366f1); }
                .insight-icon.stock { background: linear-gradient(135deg, #ef4444, #dc2626); }
                
                .insight-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .insight-label {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }
                .insight-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8125rem;
                    margin-top: 8px;
                }
                .insight-trend.up { color: #22c55e; }
                .insight-trend.down { color: #ef4444; }
                
                .action-items {
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.05));
                    border: 1px solid rgba(124, 58, 237, 0.2);
                    border-radius: 12px;
                    padding: 20px;
                }
                .action-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    color: var(--primary-500);
                    margin-bottom: 12px;
                }
                .action-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .action-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: var(--bg-card);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    color: var(--text-primary);
                }
                .action-item-icon {
                    color: var(--primary-500);
                }
                
                .forecast-section {
                    margin-top: 20px;
                    padding: 20px;
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .forecast-item {
                    text-align: center;
                }
                .forecast-label {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .forecast-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--primary-500);
                }
                .confidence-badge {
                    display: inline-flex;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .confidence-badge.high {
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                }
                .confidence-badge.medium {
                    background: rgba(245, 158, 11, 0.15);
                    color: #f59e0b;
                }
                .confidence-badge.low {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                }
            `}</style>

            <div className="ai-header">
                <div className="ai-title">
                    <Brain size={28} style={{ color: '#7c3aed' }} />
                    <h2>AI Business Insights</h2>
                    <span className="ai-badge">
                        <Sparkles size={12} />
                        Real-time Analysis
                    </span>
                </div>
                <button className="refresh-btn" onClick={loadPredictions}>
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            <div className="insights-grid">
                <div className="insight-card">
                    <div className="insight-header">
                        <div className="insight-icon trend">
                            {summary?.trend === 'up' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <span className="insight-label">Weekly Trend</span>
                    </div>
                    <div className="insight-value">{summary?.weeklyGrowth > 0 ? '+' : ''}{summary?.weeklyGrowth || 0}%</div>
                    <div className={`insight-trend ${summary?.trend || 'up'}`}>
                        {summary?.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{summary?.trend === 'up' ? 'Growing' : 'Declining'} vs last week</span>
                    </div>
                </div>

                <div className="insight-card">
                    <div className="insight-header">
                        <div className="insight-icon peak">
                            <Clock size={18} />
                        </div>
                        <span className="insight-label">Peak Business</span>
                    </div>
                    <div className="insight-value">{seasonality?.peakDay || 'Saturday'}</div>
                    <span className="insight-label">at {seasonality?.peakHour || '11:00'}</span>
                </div>

                <div className="insight-card">
                    <div className="insight-header">
                        <div className="insight-icon customer">
                            <Users size={18} />
                        </div>
                        <span className="insight-label">VIP Customers</span>
                    </div>
                    <div className="insight-value">{customerInsights?.vipContribution || 0}%</div>
                    <span className="insight-label">of revenue from top 5</span>
                </div>

                <div className="insight-card">
                    <div className="insight-header">
                        <div className="insight-icon stock">
                            <Package size={18} />
                        </div>
                        <span className="insight-label">Stock Alerts</span>
                    </div>
                    <div className="insight-value">{inventory?.lowStockCount || 0}</div>
                    <span className="insight-label">items need restocking</span>
                </div>
            </div>

            {/* Forecasts */}
            <div className="forecast-section">
                <div className="forecast-item">
                    <div className="forecast-label">Next Week Revenue</div>
                    <div className="forecast-value">₹{(forecasts?.nextWeekRevenue || 0).toLocaleString()}</div>
                </div>
                <div className="forecast-item">
                    <div className="forecast-label">Next Month Estimate</div>
                    <div className="forecast-value">₹{(forecasts?.nextMonthRevenue || 0).toLocaleString()}</div>
                </div>
                <div className="forecast-item">
                    <div className="forecast-label">Avg Daily Sales</div>
                    <div className="forecast-value">₹{(summary?.avgDailySales || 0).toLocaleString()}</div>
                </div>
                <div className="forecast-item">
                    <div className="forecast-label">Confidence</div>
                    <span className={`confidence-badge ${forecasts?.confidence || 'low'}`}>
                        {forecasts?.confidence === 'high' ? '🎯 High' : forecasts?.confidence === 'medium' ? '📊 Medium' : '📈 Building...'}
                    </span>
                </div>
            </div>

            {/* Action Items */}
            {actionItems && actionItems.length > 0 && (
                <div className="action-items">
                    <div className="action-title">
                        <Lightbulb size={18} />
                        AI Recommendations
                    </div>
                    <div className="action-list">
                        {actionItems.map((item, i) => (
                            <div key={i} className="action-item">
                                <ArrowRight size={16} className="action-item-icon" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
