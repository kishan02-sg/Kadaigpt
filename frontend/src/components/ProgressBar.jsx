export default function ProgressBar({
    value = 0,
    max = 100,
    label,
    showValue = true,
    color = 'primary', // primary, success, warning, error, gradient
    size = 'default', // small, default, large
    animated = true,
    striped = false
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    const colors = {
        primary: '#f97316',
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        info: '#3b82f6',
        purple: '#8b5cf6',
        gradient: 'linear-gradient(90deg, #f97316, #ef4444, #f97316)'
    }

    const heights = {
        small: 6,
        default: 10,
        large: 16
    }

    const barColor = colors[color] || colors.primary
    const height = heights[size] || heights.default

    return (
        <div className="progress-container">
            {(label || showValue) && (
                <div className="progress-header">
                    {label && <span className="progress-label">{label}</span>}
                    {showValue && (
                        <span className="progress-value">
                            {value}/{max} ({Math.round(percentage)}%)
                        </span>
                    )}
                </div>
            )}

            <div
                className="progress-track"
                style={{ height: `${height}px` }}
            >
                <div
                    className={`progress-bar ${animated ? 'animated' : ''} ${striped ? 'striped' : ''}`}
                    style={{
                        width: `${percentage}%`,
                        background: barColor
                    }}
                />
            </div>

            <style>{`
                .progress-container {
                    width: 100%;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .progress-label {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .progress-value {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                }

                .progress-track {
                    width: 100%;
                    background: var(--bg-tertiary);
                    border-radius: 999px;
                    overflow: hidden;
                }

                .progress-bar {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .progress-bar.animated {
                    animation: progressGrow 1s ease-out forwards;
                }

                @keyframes progressGrow {
                    from { 
                        width: 0; 
                        opacity: 0.5;
                    }
                    to { 
                        opacity: 1;
                    }
                }

                .progress-bar.striped {
                    background-image: linear-gradient(
                        45deg,
                        rgba(255, 255, 255, 0.15) 25%,
                        transparent 25%,
                        transparent 50%,
                        rgba(255, 255, 255, 0.15) 50%,
                        rgba(255, 255, 255, 0.15) 75%,
                        transparent 75%,
                        transparent
                    );
                    background-size: 1rem 1rem;
                    animation: stripedMove 1s linear infinite;
                }

                @keyframes stripedMove {
                    from { background-position: 1rem 0; }
                    to { background-position: 0 0; }
                }
            `}</style>
        </div>
    )
}

// Circular progress variant
export function CircularProgress({
    value = 0,
    max = 100,
    size = 80,
    strokeWidth = 8,
    color = '#f97316',
    showValue = true,
    label
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percentage / 100) * circumference

    return (
        <div className="circular-progress" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                {/* Background circle */}
                <circle
                    className="circle-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    className="circle-progress"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>

            {(showValue || label) && (
                <div className="circular-content">
                    {showValue && (
                        <span className="circular-value">{Math.round(percentage)}%</span>
                    )}
                    {label && (
                        <span className="circular-label">{label}</span>
                    )}
                </div>
            )}

            <style>{`
                .circular-progress {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .circle-bg {
                    stroke: var(--bg-tertiary);
                }

                .circle-progress {
                    transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    animation: circularGrow 1s ease-out forwards;
                }

                @keyframes circularGrow {
                    from { 
                        stroke-dashoffset: ${circumference};
                    }
                }

                .circular-content {
                    position: absolute;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                .circular-value {
                    font-size: ${size * 0.2}px;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .circular-label {
                    font-size: ${size * 0.12}px;
                    color: var(--text-tertiary);
                    margin-top: 2px;
                }
            `}</style>
        </div>
    )
}
