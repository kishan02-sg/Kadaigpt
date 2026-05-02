import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const formatNumber = (num, type = 'number') => {
    if (type === 'currency') {
        return `₹${num.toLocaleString('en-IN')}`
    }
    if (type === 'percent') {
        return `${num}%`
    }
    return num.toLocaleString('en-IN')
}

export default function StatsCard({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    type = 'number', // 'number', 'currency', 'percent'
    color = 'primary', // 'primary', 'success', 'warning', 'info', 'error'
    size = 'default', // 'small', 'default', 'large'
    animated = true,
    onClick
}) {
    const getTrendIcon = () => {
        if (change > 0) return <TrendingUp size={14} />
        if (change < 0) return <TrendingDown size={14} />
        return <Minus size={14} />
    }

    const getTrendClass = () => {
        if (change > 0) return 'positive'
        if (change < 0) return 'negative'
        return 'neutral'
    }

    const colorMap = {
        primary: { bg: 'rgba(249, 115, 22, 0.12)', accent: '#f97316' },
        success: { bg: 'rgba(34, 197, 94, 0.12)', accent: '#22c55e' },
        warning: { bg: 'rgba(234, 179, 8, 0.12)', accent: '#eab308' },
        info: { bg: 'rgba(59, 130, 246, 0.12)', accent: '#3b82f6' },
        error: { bg: 'rgba(239, 68, 68, 0.12)', accent: '#ef4444' },
        purple: { bg: 'rgba(139, 92, 246, 0.12)', accent: '#8b5cf6' },
    }

    const colors = colorMap[color] || colorMap.primary

    return (
        <div
            className={`stats-card ${size} ${animated ? 'animated' : ''} ${onClick ? 'clickable' : ''}`}
            onClick={onClick}
        >
            {Icon && (
                <div
                    className="stats-icon"
                    style={{ background: colors.bg, color: colors.accent }}
                >
                    <Icon size={size === 'large' ? 28 : size === 'small' ? 20 : 24} />
                </div>
            )}

            <div className="stats-content">
                <span className="stats-label">{title}</span>
                <span className="stats-value">{formatNumber(value, type)}</span>
            </div>

            {change !== undefined && (
                <div className={`stats-change ${getTrendClass()}`}>
                    {getTrendIcon()}
                    <span>{Math.abs(change)}%</span>
                    {changeLabel && <span className="change-label">{changeLabel}</span>}
                </div>
            )}

            <style>{`
                .stats-card {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    position: relative;
                    transition: all 0.2s;
                }

                .stats-card.animated {
                    animation: cardFadeIn 0.4s ease forwards;
                }

                @keyframes cardFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .stats-card.clickable {
                    cursor: pointer;
                }

                .stats-card.clickable:hover {
                    border-color: var(--primary-400);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                }

                .stats-card.small {
                    padding: 14px 16px;
                    gap: 12px;
                }

                .stats-card.large {
                    padding: 24px;
                    gap: 20px;
                }

                .stats-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .stats-card.small .stats-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                }

                .stats-card.large .stats-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 16px;
                }

                .stats-content {
                    flex: 1;
                    min-width: 0;
                }

                .stats-label {
                    display: block;
                    font-size: 0.8125rem;
                    color: var(--text-tertiary);
                    margin-bottom: 4px;
                }

                .stats-card.small .stats-label {
                    font-size: 0.75rem;
                }

                .stats-value {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--text-primary);
                }

                .stats-card.small .stats-value {
                    font-size: 1.25rem;
                }

                .stats-card.large .stats-value {
                    font-size: 2rem;
                }

                .stats-change {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 20px;
                }

                .stats-change.positive {
                    background: rgba(34, 197, 94, 0.12);
                    color: #22c55e;
                }

                .stats-change.negative {
                    background: rgba(239, 68, 68, 0.12);
                    color: #ef4444;
                }

                .stats-change.neutral {
                    background: var(--bg-tertiary);
                    color: var(--text-tertiary);
                }

                .change-label {
                    display: none;
                }

                @media (min-width: 1200px) {
                    .change-label {
                        display: inline;
                        font-weight: 400;
                        opacity: 0.8;
                    }
                }

                @media (max-width: 768px) {
                    .stats-card {
                        padding: 16px;
                        gap: 12px;
                    }

                    .stats-icon {
                        width: 48px;
                        height: 48px;
                    }

                    .stats-value {
                        font-size: 1.25rem;
                    }

                    .stats-change {
                        font-size: 0.75rem;
                        padding: 3px 8px;
                    }
                }
            `}</style>
        </div>
    )
}
