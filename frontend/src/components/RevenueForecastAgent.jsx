import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Calendar, Target, Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, Zap, Brain, BarChart3 } from 'lucide-react'
import realDataService from '../services/realDataService'

export default function RevenueForecastAgent({ addToast }) {
    const [loading, setLoading] = useState(true)
    const [historicalData, setHistoricalData] = useState([])
    const [predictions, setPredictions] = useState(null)
    const [confidenceLevel, setConfidenceLevel] = useState(0)

    useEffect(() => {
        generateForecast()
    }, [])

    const generateForecast = async () => {
        setLoading(true)
        try {
            const bills = await realDataService.getBills()

            const now = new Date()

            // Group sales by day for last 30 days
            const dailySales = {}
            const dayLabels = []

            for (let i = 29; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
                const dateKey = date.toISOString().split('T')[0]
                dailySales[dateKey] = 0
                dayLabels.push({
                    date: dateKey,
                    dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    dayNum: date.getDate()
                })
            }

            // Populate with actual sales
            bills.forEach(bill => {
                const billDate = new Date(bill.created_at || bill.createdAt)
                const dateKey = billDate.toISOString().split('T')[0]
                if (dailySales.hasOwnProperty(dateKey)) {
                    dailySales[dateKey] += bill.total || 0
                }
            })

            // Convert to array
            const salesArray = dayLabels.map(d => ({
                ...d,
                sales: dailySales[d.date]
            }))

            setHistoricalData(salesArray)

            // AI Prediction Algorithm (Simple moving average + trend + seasonality)
            const lastWeekSales = salesArray.slice(-7)
            const prevWeekSales = salesArray.slice(-14, -7)

            const lastWeekTotal = lastWeekSales.reduce((sum, d) => sum + d.sales, 0)
            const prevWeekTotal = prevWeekSales.reduce((sum, d) => sum + d.sales, 0)

            // Calculate growth rate
            const growthRate = prevWeekTotal > 0
                ? (lastWeekTotal - prevWeekTotal) / prevWeekTotal
                : 0

            // Day-of-week patterns
            const dayPatterns = {}
            const dayTotals = {}
            const dayCounts = {}

            salesArray.forEach(d => {
                if (!dayTotals[d.dayName]) {
                    dayTotals[d.dayName] = 0
                    dayCounts[d.dayName] = 0
                }
                dayTotals[d.dayName] += d.sales
                dayCounts[d.dayName]++
            })

            for (const day in dayTotals) {
                dayPatterns[day] = dayCounts[day] > 0 ? dayTotals[day] / dayCounts[day] : 0
            }

            // Generate next 7 days prediction
            const avgDailySales = lastWeekTotal / 7
            const futurePredictions = []

            for (let i = 1; i <= 7; i++) {
                const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
                const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'short' })

                // Apply trend + seasonality
                const basePrediction = avgDailySales * (1 + growthRate * (i / 7))
                const seasonalFactor = dayPatterns[dayName] > 0
                    ? dayPatterns[dayName] / (Object.values(dayPatterns).reduce((a, b) => a + b, 0) / 7)
                    : 1

                const prediction = Math.round(basePrediction * seasonalFactor)

                futurePredictions.push({
                    date: futureDate.toISOString().split('T')[0],
                    dayName,
                    dayNum: futureDate.getDate(),
                    prediction,
                    lower: Math.round(prediction * 0.8),
                    upper: Math.round(prediction * 1.2)
                })
            }

            // Calculate totals
            const nextWeekTotal = futurePredictions.reduce((sum, d) => sum + d.prediction, 0)
            const nextMonthEstimate = nextWeekTotal * 4 // Rough estimate

            // Peak day detection
            const peakDay = futurePredictions.reduce((peak, d) =>
                d.prediction > (peak?.prediction || 0) ? d : peak, null
            )

            // Calculate confidence based on data availability
            const dataPoints = salesArray.filter(d => d.sales > 0).length
            const confidence = Math.min(95, 50 + (dataPoints * 1.5))

            setPredictions({
                nextWeek: {
                    total: nextWeekTotal,
                    daily: futurePredictions,
                    peakDay
                },
                nextMonth: nextMonthEstimate,
                growthRate: growthRate * 100,
                trend: growthRate >= 0 ? 'up' : 'down',
                seasonality: dayPatterns
            })

            setConfidenceLevel(Math.round(confidence))

        } catch (error) {
            console.error('Forecast error:', error)
        } finally {
            setLoading(false)
        }
    }

    // Simple bar chart visualization
    const maxHistorical = Math.max(...historicalData.map(d => d.sales), 1)
    const maxPredicted = predictions?.nextWeek?.daily
        ? Math.max(...predictions.nextWeek.daily.map(d => d.upper || d.prediction), 1)
        : 0

    if (loading) {
        return (
            <div className="forecast-agent loading">
                <style>{forecastStyles}</style>
                <Brain size={32} className="pulse" style={{ color: '#7c3aed' }} />
                <p>AI Analyzing Sales Patterns...</p>
            </div>
        )
    }

    return (
        <div className="forecast-agent">
            <style>{forecastStyles}</style>

            <div className="agent-header">
                <div className="agent-title">
                    <TrendingUp size={22} style={{ color: '#22c55e' }} />
                    <h3>Revenue Forecast AI</h3>
                    <span className="ai-badge"><Brain size={12} /> ML Powered</span>
                </div>
                <div className="confidence-badge">
                    {confidenceLevel}% confident
                </div>
            </div>

            {/* Prediction Summary */}
            <div className="forecast-summary">
                <div className="summary-card primary">
                    <Calendar size={20} />
                    <div className="summary-content">
                        <span className="summary-value">₹{(predictions?.nextWeek?.total || 0).toLocaleString()}</span>
                        <span className="summary-label">Next 7 Days</span>
                    </div>
                </div>
                <div className="summary-card secondary">
                    <Target size={20} />
                    <div className="summary-content">
                        <span className="summary-value">₹{(predictions?.nextMonth || 0).toLocaleString()}</span>
                        <span className="summary-label">Monthly Estimate</span>
                    </div>
                </div>
                <div className={`summary-card ${predictions?.trend === 'up' ? 'success' : 'danger'}`}>
                    {predictions?.trend === 'up' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    <div className="summary-content">
                        <span className="summary-value">{predictions?.growthRate?.toFixed(1) || 0}%</span>
                        <span className="summary-label">Weekly Trend</span>
                    </div>
                </div>
            </div>

            {/* Mini Chart */}
            <div className="forecast-chart">
                <div className="chart-header">
                    <span>Last 14 Days → Next 7 Days</span>
                    <span className="chart-legend">
                        <span className="legend-item historical">Historical</span>
                        <span className="legend-item predicted">Predicted</span>
                    </span>
                </div>
                <div className="chart-bars">
                    {/* Historical (last 14 days) */}
                    {historicalData.slice(-14).map((d, i) => (
                        <div key={d.date} className="bar-container historical">
                            <div
                                className="bar"
                                style={{ height: `${Math.max(2, (d.sales / maxHistorical) * 100)}%` }}
                            />
                            <span className="bar-label">{d.dayNum}</span>
                        </div>
                    ))}
                    {/* Divider */}
                    <div className="chart-divider">
                        <Sparkles size={12} />
                    </div>
                    {/* Predictions */}
                    {predictions?.nextWeek?.daily?.map((d, i) => (
                        <div key={d.date} className="bar-container predicted">
                            <div
                                className="bar"
                                style={{ height: `${Math.max(2, (d.prediction / maxPredicted) * 100)}%` }}
                            />
                            <span className="bar-label">{d.dayNum}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Peak Day Alert */}
            {predictions?.nextWeek?.peakDay && (
                <div className="peak-alert">
                    <Zap size={16} />
                    <span>
                        <strong>Peak Day:</strong> {predictions.nextWeek.peakDay.dayName} - Expected ₹{predictions.nextWeek.peakDay.prediction.toLocaleString()}
                    </span>
                </div>
            )}

            {/* Day Patterns */}
            <div className="patterns-section">
                <h5>Day-of-Week Patterns</h5>
                <div className="patterns-grid">
                    {Object.entries(predictions?.seasonality || {}).map(([day, avg]) => (
                        <div key={day} className="pattern-item">
                            <span className="pattern-day">{day}</span>
                            <div className="pattern-bar">
                                <div
                                    className="pattern-fill"
                                    style={{
                                        width: `${Math.min(100, (avg / Math.max(...Object.values(predictions?.seasonality || {}), 1)) * 100)}%`
                                    }}
                                />
                            </div>
                            <span className="pattern-value">₹{Math.round(avg).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const forecastStyles = `
    .forecast-agent {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 20px;
    }

    .forecast-agent.loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        min-height: 300px;
        color: var(--text-secondary);
    }

    .agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 10px;
    }

    .agent-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .agent-title h3 {
        margin: 0;
        font-size: 1.125rem;
    }

    .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1));
        border-radius: 100px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #7c3aed;
    }

    .confidence-badge {
        padding: 6px 12px;
        background: rgba(34, 197, 94, 0.1);
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #22c55e;
    }

    .forecast-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
    }

    .summary-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        border-radius: 12px;
    }

    .summary-card.primary {
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(99, 102, 241, 0.1));
        color: #7c3aed;
    }

    .summary-card.secondary {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
    }

    .summary-card.success {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
    }

    .summary-card.danger {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    .summary-value {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
    }

    .summary-label {
        font-size: 0.6875rem;
        opacity: 0.8;
    }

    .forecast-chart {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
    }

    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .chart-legend {
        display: flex;
        gap: 12px;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .legend-item::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .legend-item.historical::before {
        background: var(--primary-500);
    }

    .legend-item.predicted::before {
        background: #22c55e;
    }

    .chart-bars {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 80px;
    }

    .bar-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
    }

    .bar {
        width: 100%;
        border-radius: 2px 2px 0 0;
        transition: height 0.3s;
    }

    .bar-container.historical .bar {
        background: var(--primary-500);
    }

    .bar-container.predicted .bar {
        background: linear-gradient(to top, #22c55e, #4ade80);
    }

    .bar-label {
        font-size: 0.5rem;
        color: var(--text-tertiary);
        margin-top: 4px;
    }

    .chart-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 100%;
        color: #7c3aed;
    }

    .peak-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.02));
        border: 1px solid rgba(245, 158, 11, 0.2);
        border-radius: 10px;
        font-size: 0.8125rem;
        color: #f59e0b;
        margin-bottom: 16px;
    }

    .patterns-section h5 {
        font-size: 0.875rem;
        margin: 0 0 12px;
        color: var(--text-secondary);
    }

    .patterns-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pattern-item {
        display: grid;
        grid-template-columns: 40px 1fr 60px;
        align-items: center;
        gap: 12px;
    }

    .pattern-day {
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .pattern-bar {
        height: 6px;
        background: var(--bg-tertiary);
        border-radius: 3px;
        overflow: hidden;
    }

    .pattern-fill {
        height: 100%;
        background: linear-gradient(90deg, #7c3aed, #3b82f6);
        border-radius: 3px;
        transition: width 0.5s;
    }

    .pattern-value {
        font-size: 0.75rem;
        text-align: right;
        color: var(--text-primary);
        font-weight: 600;
    }

    .pulse {
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    @media (max-width: 600px) {
        .forecast-summary {
            grid-template-columns: 1fr;
        }
    }
`
