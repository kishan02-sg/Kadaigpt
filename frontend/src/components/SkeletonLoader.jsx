// Pro-level skeleton loading states

export function SkeletonCard({ count = 1 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton-card">
                    <div className="skeleton-header">
                        <div className="skeleton skeleton-avatar"></div>
                        <div className="skeleton-info">
                            <div className="skeleton skeleton-title"></div>
                            <div className="skeleton skeleton-subtitle"></div>
                        </div>
                    </div>
                    <div className="skeleton skeleton-body"></div>
                    <div className="skeleton skeleton-footer"></div>
                </div>
            ))}
        </>
    )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
    return (
        <div className="skeleton-table">
            <div className="skeleton-table-header">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="skeleton skeleton-th"></div>
                ))}
            </div>
            {Array.from({ length: rows }).map((_, row) => (
                <div key={row} className="skeleton-table-row">
                    {Array.from({ length: cols }).map((_, col) => (
                        <div key={col} className="skeleton skeleton-td"></div>
                    ))}
                </div>
            ))}
        </div>
    )
}

export function SkeletonStats({ count = 4 }) {
    return (
        <div className="skeleton-stats-grid">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton-stat-card">
                    <div className="skeleton skeleton-stat-value"></div>
                    <div className="skeleton skeleton-stat-label"></div>
                </div>
            ))}
        </div>
    )
}

export function SkeletonChart() {
    return (
        <div className="skeleton-chart">
            <div className="skeleton-chart-bars">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div
                        key={i}
                        className="skeleton skeleton-bar"
                        style={{ height: `${40 + Math.random() * 40}%` }}
                    ></div>
                ))}
            </div>
        </div>
    )
}

export function SkeletonDashboard() {
    return (
        <div className="skeleton-dashboard">
            <SkeletonStats count={4} />
            <div className="skeleton-dashboard-main">
                <SkeletonChart />
                <SkeletonCard count={3} />
            </div>
        </div>
    )
}

// Add these styles to your App.css or include as a style tag
export const skeletonStyles = `
    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }

    .skeleton {
        background: linear-gradient(
            90deg,
            var(--bg-tertiary) 25%,
            rgba(255, 255, 255, 0.1) 37%,
            var(--bg-tertiary) 63%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: var(--radius-sm);
    }

    .skeleton-card {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        padding: 20px;
        margin-bottom: 16px;
    }

    .skeleton-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .skeleton-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
    }

    .skeleton-info {
        flex: 1;
    }

    .skeleton-title {
        height: 16px;
        width: 60%;
        margin-bottom: 8px;
    }

    .skeleton-subtitle {
        height: 12px;
        width: 40%;
    }

    .skeleton-body {
        height: 60px;
        margin-bottom: 12px;
    }

    .skeleton-footer {
        height: 32px;
        width: 120px;
    }

    .skeleton-table {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    .skeleton-table-header {
        display: flex;
        gap: 16px;
        padding: 16px 20px;
        background: var(--bg-tertiary);
    }

    .skeleton-th {
        flex: 1;
        height: 16px;
    }

    .skeleton-table-row {
        display: flex;
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .skeleton-td {
        flex: 1;
        height: 20px;
    }

    .skeleton-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .skeleton-stat-card {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        padding: 24px;
    }

    .skeleton-stat-value {
        height: 32px;
        width: 80%;
        margin-bottom: 8px;
    }

    .skeleton-stat-label {
        height: 14px;
        width: 50%;
    }

    .skeleton-chart {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        padding: 24px;
        height: 300px;
    }

    .skeleton-chart-bars {
        display: flex;
        align-items: flex-end;
        justify-content: space-around;
        height: 100%;
        gap: 8px;
    }

    .skeleton-bar {
        flex: 1;
        max-width: 60px;
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    }

    .skeleton-dashboard {
        padding: 24px;
    }

    .skeleton-dashboard-main {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
    }

    @media (max-width: 768px) {
        .skeleton-dashboard-main {
            grid-template-columns: 1fr;
        }
    }
`

export default { SkeletonCard, SkeletonTable, SkeletonStats, SkeletonChart, SkeletonDashboard }
